'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { ConflictList, Timeline, type ActivityItem } from '@/components/admin/Timeline';
import { LeadFields, SubmittedDetails } from '@/components/admin/LeadFields';
import { draftFromRecords, leadWritePayload, type ClientRecord, type LeadDraft } from '@/lib/leads';
import {
  blockToOccupancy,
  bookingToOccupancy,
  DEFAULT_SCHEDULE_SETTINGS,
  evaluateAvailability,
  rosterWarning,
  type Occupancy,
  type ScheduleSettings,
} from '@/lib/schedule/availability';
import { addCalendarDays, venueRef } from '@/lib/schedule/time';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

type LinkedBooking = {
  id: string;
  status: string;
  total_price: number;
};

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  const leadId = params.id;
  const [draft, setDraft] = useState<LeadDraft | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [details, setDetails] = useState<unknown>(null);
  const [archivedAt, setArchivedAt] = useState<string | null>(null);
  const [events, setEvents] = useState<ActivityItem[]>([]);
  const [booking, setBooking] = useState<LinkedBooking | null>(null);
  const [original, setOriginal] = useState<LeadDraft | null>(null);
  const [occupancies, setOccupancies] = useState<Occupancy[]>([]);
  const [settings, setSettings] = useState<ScheduleSettings>(DEFAULT_SCHEDULE_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [{ data: lead, error: leadError }, { data: activity }, { data: bookings }] = await Promise.all([
        supabase.from('leads').select('*, clients(*)').eq('id', leadId).single(),
        supabase.from('activity_events').select('id, event_type, title, body, occurred_at').eq('lead_id', leadId).order('occurred_at', { ascending: false }),
        supabase.from('bookings').select('id, status, total_price').eq('lead_id', leadId).neq('status', 'Cancelled').order('created_at', { ascending: false }).limit(1),
      ]);
      if (cancelled) return;
      if (leadError || !lead) {
        setError('Could not load this lead.');
        setLoading(false);
        return;
      }
      const client = (lead.clients || null) as ClientRecord | null;
      const nextDraft = draftFromRecords(lead, client);
      setDraft(nextDraft);
      setOriginal(nextDraft);
      setClientId(client?.id || lead.client_id);
      setDetails(lead.inquiry_details);
      setArchivedAt(lead.archived_at);
      setEvents((activity || []) as ActivityItem[]);
      setBooking((bookings && bookings[0]) || null);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  const eventDate = draft?.eventDate || '';

  useEffect(() => {
    if (!eventDate) return;
    let cancelled = false;
    async function loadCalendar() {
      const from = addCalendarDays(eventDate, -1);
      const to = addCalendarDays(eventDate, 1);
      const [settingsResult, bookingsResult, blocksResult] = await Promise.all([
        supabase.from('business_settings').select('setup_buffer_minutes, breakdown_buffer_minutes, travel_buffer_minutes, performer_count').eq('id', 1).maybeSingle(),
        supabase.from('bookings').select('id, status, event_date, performance_start_time, performance_end_time, venue_name, venue_address, performers_needed').gte('event_date', from).lte('event_date', to),
        supabase.from('availability_blocks').select('id, block_type, start_date, end_date, start_time, end_time, all_day').lte('start_date', to).gte('end_date', from),
      ]);
      if (cancelled) return;
      if (settingsResult.data) {
        setSettings({
          setupBufferMinutes: settingsResult.data.setup_buffer_minutes,
          breakdownBufferMinutes: settingsResult.data.breakdown_buffer_minutes,
          travelBufferMinutes: settingsResult.data.travel_buffer_minutes,
          performerCount: settingsResult.data.performer_count,
        });
      }
      setOccupancies([
        ...(bookingsResult.data || []).flatMap((row) => {
          const occupancy = bookingToOccupancy(row);
          return occupancy ? [occupancy] : [];
        }),
        ...(blocksResult.data || []).map(blockToOccupancy),
      ]);
    }
    loadCalendar();
    return () => {
      cancelled = true;
    };
  }, [eventDate]);

  const conflicts = useMemo(() => {
    if (!draft?.eventDate) return [];
    const assessment = evaluateAvailability(
      {
        date: draft.eventDate,
        startTime: draft.performanceStart,
        endTime: draft.performanceEnd,
        venue: venueRef(draft.venueAddress, draft.venueName),
        excludeId: booking?.id,
      },
      occupancies,
      settings,
    );
    const roster = rosterWarning(Number(draft.performersNeeded), settings);
    return roster ? [...assessment.reasons, roster] : assessment.reasons;
  }, [draft, occupancies, settings, booking?.id]);

  const refreshEvents = async () => {
    const { data } = await supabase
      .from('activity_events')
      .select('id, event_type, title, body, occurred_at')
      .eq('lead_id', leadId)
      .order('occurred_at', { ascending: false });
    setEvents((data || []) as ActivityItem[]);
  };

  const save = async () => {
    if (!draft || !clientId || !original) return;
    const payload = leadWritePayload(draft);
    if (!payload.ok) {
      setError(payload.error);
      return;
    }
    setSaving(true);
    setError('');
    const { error: clientError } = await supabase.from('clients').update(payload.client).eq('id', clientId);
    const { error: leadError } = await supabase.from('leads').update(payload.lead).eq('id', leadId);
    if (clientError || leadError) {
      setError('Could not save this lead.');
      setSaving(false);
      return;
    }
    const changes: string[] = [];
    if (original.status !== draft.status) changes.push(`Status changed from ${original.status} to ${draft.status}.`);
    if (original.contractStatus !== draft.contractStatus) changes.push(`Contract status is now ${draft.contractStatus}.`);
    if (original.paymentStatus !== draft.paymentStatus) changes.push(`Payment status is now ${draft.paymentStatus}.`);
    if (changes.length > 0) {
      await supabase.from('activity_events').insert({
        lead_id: leadId,
        booking_id: booking?.id || null,
        event_type: 'status_change',
        title: 'Record updated',
        body: changes.join(' '),
      });
      await refreshEvents();
    }
    setOriginal(draft);
    setSaving(false);
  };

  const placeHold = async (status: 'Tentative' | 'Confirmed' | 'Cancelled') => {
    if (!draft || !clientId) return;
    if (!draft.eventDate && status !== 'Cancelled') {
      setError('Add an event date before placing this on the calendar.');
      return;
    }
    setSaving(true);
    setError('');
    const payload = leadWritePayload(draft);
    if (!payload.ok) {
      setError(payload.error);
      setSaving(false);
      return;
    }
    await supabase.from('clients').update(payload.client).eq('id', clientId);
    await supabase.from('leads').update({
      ...payload.lead,
      status: status === 'Confirmed' ? 'Confirmed' : payload.lead.status,
    }).eq('id', leadId);
    if (status === 'Confirmed') setDraft({ ...draft, status: 'Confirmed' });

    const bookingFields = {
      client_id: clientId,
      lead_id: leadId,
      status,
      event_date: draft.eventDate,
      venue_name: payload.lead.venue_name,
      venue_address: payload.lead.venue_address,
      service_type: payload.lead.service_type || 'Performance',
      performance_start_time: payload.lead.performance_start_time,
      performance_end_time: payload.lead.performance_end_time,
      performers_needed: payload.lead.performers_needed,
      total_price: payload.lead.quoted_price ?? booking?.total_price ?? 0,
      special_requests: payload.lead.message,
    };
    let bookingId = booking?.id || null;
    if (bookingId) {
      const { error: updateError } = await supabase.from('bookings').update(bookingFields).eq('id', bookingId);
      if (updateError) {
        setError('Could not update the calendar hold.');
        setSaving(false);
        return;
      }
    } else {
      const { data, error: insertError } = await supabase.from('bookings').insert(bookingFields).select('id, status, total_price').single();
      if (insertError || !data) {
        setError('Could not add this to the calendar.');
        setSaving(false);
        return;
      }
      bookingId = data.id;
    }
    if (!bookingId) {
      setError('Could not add this to the calendar.');
      setSaving(false);
      return;
    }
    if (status === 'Cancelled') setBooking(null);
    else setBooking({ id: bookingId, status, total_price: bookingFields.total_price });
    await supabase.from('activity_events').insert({
      lead_id: leadId,
      booking_id: bookingId,
      event_type: 'calendar',
      title:
        status === 'Confirmed'
          ? 'Booking confirmed. This time now blocks the calendar.'
          : status === 'Tentative'
            ? 'Tentative hold placed on the calendar.'
            : 'Calendar hold cancelled.',
      body: draft.eventDate,
    });
    await refreshEvents();
    setSaving(false);
  };

  const archive = async (restore: boolean) => {
    const next = restore ? null : new Date().toISOString();
    const { error: archiveError } = await supabase.from('leads').update({ archived_at: next }).eq('id', leadId);
    if (archiveError) {
      setError('Could not update the archive.');
      return;
    }
    setArchivedAt(next);
    await supabase.from('activity_events').insert({
      lead_id: leadId,
      event_type: 'status_change',
      title: restore ? 'Lead restored' : 'Lead archived',
      body: restore ? null : 'Archiving hides the lead. A confirmed booking still blocks the calendar until it is cancelled.',
    });
    await refreshEvents();
  };

  if (loading) return <div className="text-gray-600">Loading lead...</div>;
  if (!draft) return <div className="text-gray-600">{error || 'Lead not found.'}</div>;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
        <div className="flex items-center gap-4">
          <Link href="/admin/leads" className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft size={20} /></Link>
          <div>
            <h2 className="text-3xl font-bold text-gray-900">{draft.clientName || 'Lead'}</h2>
            {archivedAt && <p className="text-sm text-gray-500">Archived</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => archive(Boolean(archivedAt))} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-800">
            {archivedAt ? 'Restore' : 'Archive'}
          </button>
          <button type="button" onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
      {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-6">{error}</div>}
      <ConflictList reasons={conflicts} />
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <LeadFields draft={draft} onChange={setDraft} />
        <div className="flex flex-wrap gap-2 mt-6">
          <button type="button" onClick={() => placeHold('Tentative')} className="px-4 py-2 rounded-lg bg-amber-100 text-amber-950">Place tentative hold</button>
          <button type="button" onClick={() => placeHold('Confirmed')} className="px-4 py-2 rounded-lg bg-green-700 text-white">Confirm and block calendar</button>
          {booking && (
            <button type="button" onClick={() => placeHold('Cancelled')} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-800">Cancel calendar hold</button>
          )}
          {booking && (
            <Link href={`/admin/bookings/${booking.id}`} className="px-4 py-2 text-blue-700">
              Open {booking.status.toLowerCase()} booking
            </Link>
          )}
        </div>
        <p className="text-sm text-gray-600 mt-3">
          Confirming a booking blocks that time. A tentative hold stays visible and makes the public date check ask for a personal confirmation. Times are Pacific Time.
        </p>
      </div>
      <SubmittedDetails details={details} />
      <Timeline
        events={events}
        onAdd={async ({ channel, body }) => {
          const note = channel === 'note';
          const { error: insertError } = await supabase.from('activity_events').insert({
            lead_id: leadId,
            booking_id: booking?.id || null,
            event_type: note ? 'note' : 'communication',
            title: note ? 'Note' : channel.replace('_', ' '),
            body,
            metadata: { channel },
          });
          if (insertError) return 'Could not add that to the timeline.';
          await refreshEvents();
          return null;
        }}
      />
    </div>
  );
}
