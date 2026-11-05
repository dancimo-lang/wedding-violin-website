'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAdminRecordId } from '@/lib/admin-record';
import { ArrowLeft } from 'lucide-react';
import { ConflictList, Timeline, type ActivityItem } from '@/components/admin/Timeline';
import { LeadFields, SubmittedDetails } from '@/components/admin/LeadFields';
import { fetchGoogleStatus, loadGoogleBusy, statusToExternalState, type GoogleBusyRow } from '@/lib/google/browser';
import { postBookingStatus } from '@/lib/booking-status-client';
import { agreementForStorage, calendarPerformanceTimes, formValueFromDraft, mergeAgreement } from '@/lib/contracts/agreement-details';
import { draftFromRecords, leadWritePayload, type ClientRecord, type LeadDraft } from '@/lib/leads';
import {
  blockToOccupancy,
  bookingToOccupancy,
  DEFAULT_SCHEDULE_SETTINGS,
  evaluateAvailability,
  googleBusyChip,
  publicExternalOccupancies,
  rosterWarning,
  type ExternalCalendarState,
  type Occupancy,
  type ScheduleSettings,
} from '@/lib/schedule/availability';
import { addCalendarDays, venueRef } from '@/lib/schedule/time';
import { AdminButton, adminButtonClass } from '@/components/admin/AdminButton';
import { ContractPanel } from '@/components/admin/ContractPanel';
import { DeleteLeadButton } from '@/components/admin/DeleteLeadButton';
import { createClient } from '@/lib/supabase/client';

function supabase() {
  return createClient();
}

type LinkedBooking = {
  id: string;
  status: string;
  total_price: number;
};

export default function LeadDetailPage() {
  const router = useRouter();
  const recordId = useAdminRecordId('leads');
  const leadId = recordId ?? '';
  const [draft, setDraft] = useState<LeadDraft | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [details, setDetails] = useState<unknown>(null);
  const [archivedAt, setArchivedAt] = useState<string | null>(null);
  const [events, setEvents] = useState<ActivityItem[]>([]);
  const [booking, setBooking] = useState<LinkedBooking | null>(null);
  const [original, setOriginal] = useState<LeadDraft | null>(null);
  const [occupancies, setOccupancies] = useState<Occupancy[]>([]);
  const [googleLabels, setGoogleLabels] = useState<string[]>([]);
  const [externalState, setExternalState] = useState<ExternalCalendarState>('disconnected');
  const [settings, setSettings] = useState<ScheduleSettings>(DEFAULT_SCHEDULE_SETTINGS);
  const [loadedId, setLoadedId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [savedRevision, setSavedRevision] = useState(0);

  useEffect(() => {
    if (!recordId) return;

    let cancelled = false;
    const leadId = recordId;
    async function load() {
      const [{ data: lead, error: leadError }, { data: activity }, { data: bookings }] = await Promise.all([
        supabase().from('leads').select('*, clients(*)').eq('id', leadId).single(),
        supabase().from('activity_events').select('id, event_type, title, body, occurred_at').eq('lead_id', leadId).order('occurred_at', { ascending: false }),
        supabase().from('bookings').select('id, status, total_price').eq('lead_id', leadId).order('created_at', { ascending: false }),
      ]);
      if (cancelled) return;
      if (leadError || !lead) {
        setError('Could not load this lead.');
        setLoadedId(leadId);
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
      const bookingRows = (bookings || []) as LinkedBooking[];
      setBooking(bookingRows.find((row) => row.status !== 'Cancelled') || bookingRows[0] || null);
      setLoadedId(leadId);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [recordId]);

  const eventDate = draft?.eventDate || '';

  useEffect(() => {
    if (!eventDate) return;
    let cancelled = false;
    async function loadCalendar() {
      const from = addCalendarDays(eventDate, -1);
      const to = addCalendarDays(eventDate, 1);
      const [settingsResult, bookingsResult, blocksResult, googleStatus, busyRows] = await Promise.all([
        supabase().from('business_settings').select('setup_buffer_minutes, breakdown_buffer_minutes, travel_buffer_minutes, performer_count').eq('id', 1).maybeSingle(),
        supabase().from('bookings').select('id, status, event_date, performance_start_time, performance_end_time, venue_name, venue_address, performers_needed').gte('event_date', from).lte('event_date', to),
        supabase().from('availability_blocks').select('id, block_type, start_date, end_date, start_time, end_time, all_day').lte('start_date', to).gte('end_date', from),
        fetchGoogleStatus(),
        loadGoogleBusy(supabase(), from, to),
      ]);
      if (cancelled) return;
      const state = statusToExternalState(googleStatus);
      setExternalState(state);
      setGoogleLabels(busyLabels(busyRows, eventDate));
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
        ...publicExternalOccupancies(state, busyRows),
      ]);
    }
    loadCalendar();
    return () => {
      cancelled = true;
    };
  }, [eventDate]);

  const conflicts = useMemo(() => {
    if (!draft?.eventDate) return [];
    const span = calendarPerformanceTimes(formValueFromDraft(draft));
    const assessment = evaluateAvailability(
      {
        date: draft.eventDate,
        startTime: span.start,
        endTime: span.end,
        venue: venueRef(draft.venueAddress, draft.venueName),
        excludeId: booking?.id,
      },
      occupancies,
      settings,
      undefined,
      externalState,
    );
    const roster = rosterWarning(Number(draft.performersNeeded), settings);
    return roster ? [...assessment.reasons, roster] : assessment.reasons;
  }, [draft, externalState, occupancies, settings, booking?.id]);

  const refreshEvents = async () => {
    const { data } = await supabase()
      .from('activity_events')
      .select('id, event_type, title, body, occurred_at')
      .eq('lead_id', leadId)
      .order('occurred_at', { ascending: false });
    setEvents((data || []) as ActivityItem[]);
  };

  const save = async () => {
    if (!draft || !clientId || !original || saving) return;
    setSaving(true);
    setError('');
    setNotice('');
    const written = await writeLeadRecord(draft, clientId, leadId);
    if (!written.ok) {
      setError(written.error);
      setSaving(false);
      return;
    }
    if (written.clientError || written.leadError) {
      setError('Could not save this lead.');
      setSaving(false);
      return;
    }
    setDetails(written.inquiry_details);
    const payload = written.payload;
    const status = written.status;
    let nextDraft = draft;
    let nextBooking = booking;
    if (original.status !== status) {
      const result = await postBookingStatus({
        action: 'set_lead_status',
        leadId,
        status,
        fields: bookingFieldsFromLead(payload.lead, booking?.total_price ?? null),
      });
      if (!result.ok) {
        setError(result.error);
        setSavedRevision((value) => value + 1);
        setSaving(false);
        return;
      }
      nextDraft = { ...draft, status: result.leadStatus || status };
      if (result.bookingId) {
        nextBooking = {
          id: result.bookingId,
          status: result.bookingStatus || status,
          total_price: payload.lead.quoted_price ?? booking?.total_price ?? 0,
        };
      } else if (result.bookingStatus === 'Cancelled' && booking) {
        nextBooking = { ...booking, status: 'Cancelled' };
      }
      setDraft(nextDraft);
      setBooking(nextBooking);
    }
    const changes: string[] = [];
    if (original.contractStatus !== draft.contractStatus) changes.push(`Contract status is now ${draft.contractStatus}.`);
    if (original.paymentStatus !== draft.paymentStatus) changes.push(`Payment status is now ${draft.paymentStatus}.`);
    if (changes.length > 0) {
      await supabase().from('activity_events').insert({
        lead_id: leadId,
        booking_id: nextBooking?.id || null,
        event_type: 'status_change',
        title: 'Record updated',
        body: changes.join(' '),
      });
      await refreshEvents();
    }
    if (nextBooking && nextBooking.status !== 'Cancelled') {
      await syncBookingEvent(nextBooking.id, payload.lead);
    }
    setOriginal(nextDraft);
    setNotice('Saved. Create contract below uses these saved details.');
    setSavedRevision((value) => value + 1);
    void fetch(`/api/admin/leads/${leadId}/call-reminder`, { method: 'POST' }).catch(() => undefined);
    setSaving(false);
  };

  const placeHold = async (status: 'Tentative' | 'Confirmed' | 'Cancelled') => {
    if (!draft || !clientId) return;
    if (!draft.eventDate && status !== 'Cancelled') {
      setError('Add an event date before placing this on the calendar.');
      return;
    }
    if (status === 'Cancelled') {
      if (!booking || booking.status === 'Cancelled') return;
      if (!window.confirm('Cancel this booking? It stays on the timeline and leaves the calendar.')) return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    const written = await writeLeadRecord(draft, clientId, leadId);
    if (!written.ok) {
      setError(written.error);
      setSaving(false);
      return;
    }
    if (written.clientError || written.leadError) {
      setError('Could not save this lead.');
      setSaving(false);
      return;
    }
    setDetails(written.inquiry_details);
    const payload = written.payload;
    const leadStatus = written.status;
    const fields = {
      client_id: clientId,
      lead_id: leadId,
      ...bookingFieldsFromLead(payload.lead, booking?.total_price ?? null),
    };
    const result = await postBookingStatus({
      action: 'apply_booking',
      bookingId: booking?.id || null,
      leadId,
      status,
      fields,
    });
    if (!result.ok) {
      setError(result.error);
      setSaving(false);
      return;
    }
    const nextStatus = result.leadStatus || (status === 'Confirmed' ? 'Confirmed' : leadStatus);
    const nextDraft = { ...draft, status: nextStatus };
    setDraft(nextDraft);
    setOriginal(nextDraft);
    if (result.bookingId) {
      setBooking({
        id: result.bookingId,
        status: result.bookingStatus || status,
        total_price: fields.total_price,
      });
    }
    await refreshEvents();
    setNotice('Saved. Create contract below uses these saved details.');
    setSavedRevision((value) => value + 1);
    void fetch(`/api/admin/leads/${leadId}/call-reminder`, { method: 'POST' }).catch(() => undefined);
    setSaving(false);
  };

  const restoreBooking = async () => {
    if (!booking) return;
    if (!window.confirm('Restore this booking? It goes back on the calendar only if that time is still free.')) return;
    setSaving(true);
    setError('');
    const result = await postBookingStatus({ action: 'restore_booking', bookingId: booking.id, leadId });
    if (!result.ok) {
      setError(result.error);
      setSaving(false);
      return;
    }
    setBooking({ ...booking, status: result.bookingStatus || 'Tentative' });
    if (result.leadStatus && draft) {
      const nextDraft = { ...draft, status: result.leadStatus };
      setDraft(nextDraft);
      setOriginal(nextDraft);
    }
    await refreshEvents();
    setSaving(false);
  };

  const archive = async (restore: boolean) => {
    setError('');
    const result = await postBookingStatus({
      action: restore ? 'restore_lead' : 'archive_lead',
      leadId,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setArchivedAt(restore ? null : new Date().toISOString());
    await refreshEvents();
  };

  if (recordId == null || (recordId && loadedId !== recordId)) {
    return <div className="text-gray-600">Loading lead...</div>;
  }
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
          <AdminButton type="button" variant="secondary" onClick={() => archive(Boolean(archivedAt))}>
            {archivedAt ? 'Restore lead' : 'Archive'}
          </AdminButton>
          <AdminButton type="button" onClick={save} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </AdminButton>
        </div>
      </div>
      {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-6">{error}</div>}
      {notice && <div className="bg-green-50 text-green-800 px-4 py-3 rounded-lg mb-6">{notice}</div>}
      <ConflictList reasons={conflicts} googleBusy={googleLabels} />
      <div id="record-details" className="bg-white rounded-xl shadow p-6 mb-6">
        <LeadFields draft={draft} onChange={setDraft} leadId={leadId} bookingId={booking?.id} />
        <div className="flex flex-wrap gap-2 mt-6">
          <AdminButton type="button" variant="secondary" onClick={() => placeHold('Tentative')}>Place tentative hold</AdminButton>
          <AdminButton type="button" onClick={() => placeHold('Confirmed')}>Confirm and block calendar</AdminButton>
          {booking && booking.status !== 'Cancelled' && (
            <AdminButton type="button" variant="danger" onClick={() => placeHold('Cancelled')}>Cancel booking</AdminButton>
          )}
          {booking && booking.status === 'Cancelled' && (
            <AdminButton type="button" variant="secondary" onClick={restoreBooking}>Restore booking</AdminButton>
          )}
          {booking && (
            <Link href={`/admin/bookings/${booking.id}`} className={adminButtonClass('secondary')}>
              Open {booking.status.toLowerCase()} booking
            </Link>
          )}
        </div>
        <p className="text-sm text-gray-600 mt-3">
          Confirming a booking blocks that time and marks this lead Confirmed. Cancelling keeps the timeline, frees the date, and marks the lead Lost unless another booking is still on the calendar. A tentative hold stays visible and makes the public date check ask for a personal confirmation. Times are Pacific Time.
        </p>
      </div>
      <ContractPanel leadId={leadId} savedRevision={savedRevision} />
      <SubmittedDetails details={details} />
      <Timeline
        events={events}
        onAdd={async ({ channel, body }) => {
          const note = channel === 'note';
          const { error: insertError } = await supabase().from('activity_events').insert({
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
      <DeleteLeadButton
        leadId={leadId}
        clientName={draft.clientName}
        placement="section"
        onDeleted={() => router.push('/admin/leads')}
      />
    </div>
  );
}

async function writeLeadRecord(draft: LeadDraft, clientId: string, leadId: string) {
  const payload = leadWritePayload(draft);
  if (!payload.ok) return payload;
  const { data: row } = await supabase().from('leads').select('inquiry_details').eq('id', leadId).maybeSingle();
  const form = formValueFromDraft(draft);
  const span = calendarPerformanceTimes(form);
  const inquiry_details = mergeAgreement(row?.inquiry_details, agreementForStorage(form));
  const { status, ...leadFields } = payload.lead;
  leadFields.performance_start_time = span.start || null;
  leadFields.performance_end_time = span.end || null;
  const { error: clientError } = await supabase().from('clients').update(payload.client).eq('id', clientId);
  const { error: leadError } = await supabase().from('leads').update({ ...leadFields, inquiry_details }).eq('id', leadId);
  return { ok: true as const, payload, status, inquiry_details, clientError, leadError };
}

async function syncBookingEvent(
  bookingId: string,
  lead: {
    event_date: string | null;
    venue_name: string | null;
    venue_address: string | null;
    performance_start_time: string | null;
    performance_end_time: string | null;
  },
) {
  await supabase()
    .from('bookings')
    .update({
      event_date: lead.event_date,
      venue_name: lead.venue_name,
      venue_address: lead.venue_address,
      performance_start_time: lead.performance_start_time,
      performance_end_time: lead.performance_end_time,
      updated_at: new Date().toISOString(),
    })
    .eq('id', bookingId);
}

function bookingFieldsFromLead(
  lead: {
    event_date: string | null;
    venue_name: string | null;
    venue_address: string | null;
    service_type: string | null;
    performance_start_time: string | null;
    performance_end_time: string | null;
    performers_needed: number;
    quoted_price: number | null;
    message: string | null;
  },
  currentPrice: number | null,
) {
  return {
    event_date: lead.event_date,
    venue_name: lead.venue_name,
    venue_address: lead.venue_address,
    service_type: lead.service_type || 'Performance',
    performance_start_time: lead.performance_start_time,
    performance_end_time: lead.performance_end_time,
    performers_needed: lead.performers_needed,
    total_price: lead.quoted_price ?? currentPrice ?? 0,
    special_requests: lead.message,
  };
}

function busyLabels(rows: GoogleBusyRow[], date: string): string[] {
  return rows.flatMap((row) => {
    const chip = googleBusyChip(row, date);
    return chip ? [`${chip.time} · ${chip.label}`] : [];
  });
}
