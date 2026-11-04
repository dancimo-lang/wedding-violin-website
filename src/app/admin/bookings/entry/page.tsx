'use client';

import { useState, useEffect } from 'react';
import { useAdminRecordId } from '@/lib/admin-record';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { ArrowLeft, Ban, Save } from 'lucide-react';
import { ConflictList, Timeline, type ActivityItem } from '@/components/admin/Timeline';
import { friendlyWriteError, postBookingStatus } from '@/lib/booking-status-client';
import { fetchGoogleStatus, loadGoogleBusy, statusToExternalState, type GoogleBusyRow } from '@/lib/google/browser';
import { BookingPayments } from '@/components/admin/BookingPayments';
import { ExistingPaymentRecord } from '@/components/admin/ExistingPaymentRecord';
import { ContractPanel } from '@/components/admin/ContractPanel';
import { AgreementFields, FieldLabel, FormSection } from '@/components/admin/AgreementFields';
import { AdminButton } from '@/components/admin/AdminButton';
import {
  AGREEMENT_FIELD_IDS,
  agreementForStorage,
  calendarPerformanceTimes,
  emptyAgreement,
  mergeAgreement,
  readAgreement,
  type AgreementDetails,
  type AgreementFormValue,
} from '@/lib/contracts/agreement-details';
import { loadAgreementNote, saveAgreementNote } from '@/lib/contracts/agreement-store';
import { guessPackageId, isPackageId } from '@/lib/contracts/packages';
import { fieldClass } from '@/lib/leads';
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
import { clientLabel, firstClient, type ClientInfo } from '@/lib/bookings/client-label';

function supabase() {
  return createClient();
}

const BOOKING_STATUSES = ['Tentative', 'Confirmed', 'Completed'] as const;

type Booking = {
  id: string;
  lead_id: string | null;
  client_id: string;
  status: string;
  event_date: string;
  venue_name: string | null;
  venue_address: string | null;
  service_type: string;
  performance_start_time: string | null;
  performance_end_time: string | null;
  setup_time: string | null;
  breakdown_time: string | null;
  travel_buffer_hours: number | null;
  total_price: number;
  retainer_amount: number | null;
  retainer_due_date: string | null;
  balance_due_date: string | null;
  special_requests: string | null;
  performers_needed?: number | null;
};

function timeValue(value: string | null) {
  return value ? value.slice(0, 5) : '';
}

function optionalNumber(value: string): number | null {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const inputClass = `${fieldClass} mt-1 font-normal`;

export default function BookingDetailPage() {
  const recordId = useAdminRecordId('bookings');
  const [booking, setBooking] = useState<Booking | null>(null);
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [savedStatus, setSavedStatus] = useState('');
  const [events, setEvents] = useState<ActivityItem[]>([]);
  const [occupancies, setOccupancies] = useState<Occupancy[]>([]);
  const [googleLabels, setGoogleLabels] = useState<string[]>([]);
  const [externalState, setExternalState] = useState<ExternalCalendarState>('disconnected');
  const [settings, setSettings] = useState<ScheduleSettings>(DEFAULT_SCHEDULE_SETTINGS);
  const [loadedId, setLoadedId] = useState('');
  const [saving, setSaving] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [savedRevision, setSavedRevision] = useState(0);
  const [agreement, setAgreement] = useState<AgreementDetails>(emptyAgreement());
  const [clientDraft, setClientDraft] = useState({ name: '', email: '', phone: '', partner: '' });

  useEffect(() => {
    if (!recordId) return;

    let cancelled = false;
    const bookingId = recordId;

    async function fetchBooking() {
      const { data, error } = await supabase()
        .from('bookings')
        .select('*, clients(name, partner_name, email, phone)')
        .eq('id', bookingId)
        .single();

      if (cancelled) return;
      if (error) {
        setError('Failed to load booking');
      } else {
        const { clients, ...row } = data as Booking & { clients: ClientInfo | ClientInfo[] | null };
        const clientInfo = firstClient(clients);
        setClient(clientInfo);
        setClientDraft({
          name: clientInfo?.name || '',
          email: clientInfo?.email || '',
          phone: clientInfo?.phone || '',
          partner: clientInfo?.partner_name || '',
        });
        const bookingRow = row as Booking;
        setBooking(bookingRow);
        setSavedStatus(bookingRow.status);
        setAgreement(await loadBookingAgreement(bookingRow));
      }
      const { data: activity } = await supabase()
        .from('activity_events')
        .select('id, event_type, title, body, occurred_at')
        .eq('booking_id', bookingId)
        .order('occurred_at', { ascending: false });
      if (!cancelled) setEvents((activity || []) as ActivityItem[]);
      if (!cancelled) setLoadedId(bookingId);
    }

    fetchBooking();
    return () => {
      cancelled = true;
    };
  }, [recordId]);

  useEffect(() => {
    if (!booking?.event_date) return;
    let cancelled = false;
    const eventDate = booking.event_date;
    async function loadNearby() {
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
      setGoogleLabels(busyRows.flatMap((row: GoogleBusyRow) => {
        const chip = googleBusyChip(row, eventDate);
        return chip ? [`${chip.time} · ${chip.label}`] : [];
      }));
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
    loadNearby();
    return () => {
      cancelled = true;
    };
  }, [booking?.event_date]);

  const refreshEvents = async (id: string) => {
    const { data } = await supabase()
      .from('activity_events')
      .select('id, event_type, title, body, occurred_at')
      .eq('booking_id', id)
      .order('occurred_at', { ascending: false });
    setEvents((data || []) as ActivityItem[]);
  };

  const bookingFields = (current: Booking) => ({
    event_date: current.event_date,
    venue_name: current.venue_name || null,
    venue_address: current.venue_address || null,
    service_type: current.service_type,
    performance_start_time: current.performance_start_time || null,
    performance_end_time: current.performance_end_time || null,
    setup_time: current.setup_time || null,
    breakdown_time: current.breakdown_time || null,
    travel_buffer_hours: current.travel_buffer_hours,
    total_price: current.total_price,
    retainer_amount: current.retainer_amount,
    retainer_due_date: current.retainer_due_date || null,
    balance_due_date: current.balance_due_date || null,
    special_requests: current.special_requests || null,
    performers_needed: current.performers_needed || 1,
  });

  const agreementValue: AgreementFormValue = {
    ...agreement,
    packageId: isPackageId(agreement.packageId) ? agreement.packageId : 'A',
    eventDate: booking?.event_date || '',
    ceremonyStart: agreement.ceremonyStart || timeValue(booking?.performance_start_time || null),
    ceremonyEnd: agreement.ceremonyEnd || timeValue(booking?.performance_end_time || null),
    venueName: booking?.venue_name || '',
    venueAddress: booking?.venue_address || '',
  };

  const onAgreementChange = (next: AgreementFormValue) => {
    if (!booking) return;
    const span = calendarPerformanceTimes(next);
    setBooking({
      ...booking,
      event_date: next.eventDate,
      venue_name: next.venueName,
      venue_address: next.venueAddress,
      performance_start_time: span.start || null,
      performance_end_time: span.end || null,
    });
    setAgreement({
      packageId: next.packageId,
      ceremonyStart: next.ceremonyStart,
      ceremonyEnd: next.ceremonyEnd,
      preludeStart: next.preludeStart,
      preludeEnd: next.preludeEnd,
      cocktailStart: next.cocktailStart,
      cocktailEnd: next.cocktailEnd,
      receptionStart: next.receptionStart,
      receptionEnd: next.receptionEnd,
      otherDetails: next.otherDetails,
      travelFee: next.travelFee,
      additionalFees: next.additionalFees,
      additionalFeesDescription: next.additionalFeesDescription,
      discount: next.discount,
      eventType: next.eventType,
      performanceDescription: next.performanceDescription,
      performanceFee: next.performanceFee,
    });
  };

  const handleSave = async () => {
    if (!booking) return;
    const email = clientDraft.email.trim().toLowerCase();
    if (!clientDraft.name.trim()) {
      setError('Enter the client name.');
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter a valid email, or leave it blank.');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');

    if (savedStatus !== booking.status) {
      const result = await postBookingStatus({
        action: 'apply_booking',
        bookingId: booking.id,
        leadId: booking.lead_id,
        status: booking.status,
        fields: bookingFields(booking),
      });
      if (!result.ok) {
        setError(result.error);
        setSaving(false);
        return;
      }
      setSavedStatus(booking.status);
    } else {
      const { error: saveError } = await supabase()
        .from('bookings')
        .update({
          ...bookingFields(booking),
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.id);
      if (saveError) {
        setError(friendlyWriteError(saveError.message, 'Failed to save booking'));
        setSaving(false);
        return;
      }
    }

    const { error: clientError } = await supabase()
      .from('clients')
      .update({
        name: clientDraft.name.trim(),
        email: email || null,
        phone: clientDraft.phone.trim() || null,
        partner_name: clientDraft.partner.trim() || null,
      })
      .eq('id', booking.client_id);
    if (clientError) {
      setError('Could not save the client.');
      setSaving(false);
      return;
    }
    setClient({
      name: clientDraft.name.trim(),
      email: email || null,
      phone: clientDraft.phone.trim() || null,
      partner_name: clientDraft.partner.trim() || null,
    });

    const stored = agreementForStorage(agreementValue);
    setAgreement(stored);
    const agreementError = await persistBookingAgreement(booking, stored);
    if (agreementError) {
      setError(agreementError);
      setSaving(false);
      return;
    }
    setNotice('Saved. Create contract below uses these saved details.');
    setSavedRevision((value) => value + 1);
    setSaving(false);
  };

  const handleCancel = async () => {
    if (!booking) return;
    setSaving(true);
    setError('');
    const result = await postBookingStatus({
      action: 'apply_booking',
      bookingId: booking.id,
      leadId: booking.lead_id,
      status: 'Cancelled',
      reason: cancelReason,
    });
    if (!result.ok) {
      setError(result.error);
      setSaving(false);
      return;
    }
    setBooking({ ...booking, status: 'Cancelled' });
    setSavedStatus('Cancelled');
    setCancelOpen(false);
    setCancelReason('');
    await refreshEvents(booking.id);
    setSaving(false);
  };

  const handleRestore = async () => {
    if (!booking) return;
    if (!window.confirm('Restore this booking? It goes back on the calendar only if that time is still free.')) return;
    setSaving(true);
    setError('');
    const result = await postBookingStatus({
      action: 'restore_booking',
      bookingId: booking.id,
    });
    if (!result.ok) {
      setError(result.error);
      setSaving(false);
      return;
    }
    const restored = result.bookingStatus || 'Tentative';
    setBooking({ ...booking, status: restored });
    setSavedStatus(restored);
    await refreshEvents(booking.id);
    setSaving(false);
  };

  if (recordId == null || (recordId && loadedId !== recordId)) {
    return <div className="p-8 text-center text-gray-500">Loading booking...</div>;
  }

  if (!booking) {
    return <div className="p-8 text-center text-gray-500">Booking not found</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/bookings"
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Booking Details</h2>
            <p className="text-lg text-gray-800">{clientLabel(client, booking.client_id)}</p>
            {(client?.email || client?.phone) && (
              <p className="text-sm text-gray-600">
                {[client?.email, client?.phone].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {booking.status === 'Cancelled' ? (
            <AdminButton type="button" variant="secondary" onClick={handleRestore} disabled={saving}>
              Restore booking
            </AdminButton>
          ) : (
            <AdminButton type="button" variant="danger" onClick={() => setCancelOpen(true)}>
              <Ban size={20} />
              Cancel booking
            </AdminButton>
          )}
          <AdminButton type="button" onClick={handleSave} disabled={saving}>
            <Save size={20} />
            {saving ? 'Saving...' : 'Save'}
          </AdminButton>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}
      {notice && <div className="bg-green-50 text-green-800 px-4 py-3 rounded-lg mb-6">{notice}</div>}

      {booking.status === 'Cancelled' && (
        <div className="mb-6 rounded-lg bg-gray-100 px-4 py-3 text-gray-700">
          This booking is cancelled. It stays on the timeline and does not block the calendar.
        </div>
      )}

      {cancelOpen && (
        <div className="mb-6 rounded-xl border border-red-200 bg-white p-4">
          <p className="text-gray-800 mb-3">
            Cancel this booking? The record and its timeline stay. The date comes off the calendar, and the Google event is cleared.
          </p>
          <label className="block text-sm font-medium text-gray-700 mb-2">Reason, optional</label>
          <textarea
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
            rows={3}
            maxLength={500}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 mb-3"
          />
          <div className="flex gap-2">
            <AdminButton type="button" variant="danger" onClick={handleCancel} disabled={saving}>
              {saving ? 'Cancelling...' : 'Cancel booking'}
            </AdminButton>
            <AdminButton type="button" variant="secondary" onClick={() => setCancelOpen(false)}>
              Keep booking
            </AdminButton>
          </div>
        </div>
      )}

      <div id="record-details" className={`rounded-xl shadow p-6 ${booking.status === 'Cancelled' ? 'bg-gray-50 text-gray-600' : 'bg-white'}`}>
        <AgreementFields
          value={agreementValue}
          onChange={onAgreementChange}
          leadId={booking.lead_id}
          bookingId={booking.id}
          afterPackage={
            <FormSection title="Client">
              <div className="grid gap-4 md:grid-cols-2">
                <FieldLabel label="Client 1" required>
                  <input
                    id={AGREEMENT_FIELD_IDS.client1}
                    className={inputClass}
                    maxLength={200}
                    value={clientDraft.name}
                    onChange={(event) => setClientDraft({ ...clientDraft, name: event.target.value })}
                  />
                </FieldLabel>
                <FieldLabel label="Client 2, if any">
                  <input
                    id={AGREEMENT_FIELD_IDS.client2}
                    className={inputClass}
                    maxLength={200}
                    value={clientDraft.partner}
                    onChange={(event) => setClientDraft({ ...clientDraft, partner: event.target.value })}
                  />
                </FieldLabel>
                <FieldLabel label="Email" required>
                  <input
                    id={AGREEMENT_FIELD_IDS.email}
                    type="email"
                    className={inputClass}
                    value={clientDraft.email}
                    onChange={(event) => setClientDraft({ ...clientDraft, email: event.target.value })}
                  />
                </FieldLabel>
                <FieldLabel label="Phone">
                  <input
                    className={inputClass}
                    value={clientDraft.phone}
                    onChange={(event) => setClientDraft({ ...clientDraft, phone: event.target.value })}
                  />
                </FieldLabel>
              </div>
            </FormSection>
          }
        />
        <div className="mt-4">
          <FormSection title="Booking">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FieldLabel label="Status">
                {booking.status === 'Cancelled' ? (
                  <p className="mt-1 px-4 py-2 rounded-lg bg-gray-200 font-normal text-gray-700">Cancelled</p>
                ) : (
                  <select
                    value={booking.status}
                    onChange={(event) => setBooking({ ...booking, status: event.target.value })}
                    className={inputClass}
                  >
                    {BOOKING_STATUSES.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                )}
              </FieldLabel>
              <FieldLabel label="Musicians needed">
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={booking.performers_needed || 1}
                  onChange={(event) => setBooking({ ...booking, performers_needed: Number(event.target.value) })}
                  className={inputClass}
                />
              </FieldLabel>
              <FieldLabel label="Service type" required>
                <input
                  type="text"
                  value={booking.service_type}
                  onChange={(event) => setBooking({ ...booking, service_type: event.target.value })}
                  className={inputClass}
                />
              </FieldLabel>
              <FieldLabel label="Total price ($)" required>
                <input
                  type="number"
                  value={booking.total_price}
                  onChange={(event) => setBooking({ ...booking, total_price: Number(event.target.value) })}
                  step="0.01"
                  className={inputClass}
                />
              </FieldLabel>
              <FieldLabel label="Setup time">
                <input type="time" value={timeValue(booking.setup_time)} onChange={(event) => setBooking({ ...booking, setup_time: event.target.value })} className={inputClass} />
              </FieldLabel>
              <FieldLabel label="Breakdown time">
                <input type="time" value={timeValue(booking.breakdown_time)} onChange={(event) => setBooking({ ...booking, breakdown_time: event.target.value })} className={inputClass} />
              </FieldLabel>
              <FieldLabel label="Travel buffer (hours)">
                <input
                  type="number"
                  value={booking.travel_buffer_hours ?? ''}
                  onChange={(event) => setBooking({ ...booking, travel_buffer_hours: optionalNumber(event.target.value) })}
                  step="0.5"
                  className={inputClass}
                />
              </FieldLabel>
              <FieldLabel label="Retainer amount ($)">
                <input
                  type="number"
                  value={booking.retainer_amount ?? ''}
                  onChange={(event) => setBooking({ ...booking, retainer_amount: optionalNumber(event.target.value) })}
                  step="0.01"
                  className={inputClass}
                />
              </FieldLabel>
              <FieldLabel label="Retainer due date">
                <input type="date" value={booking.retainer_due_date || ''} onChange={(event) => setBooking({ ...booking, retainer_due_date: event.target.value })} className={inputClass} />
              </FieldLabel>
              <FieldLabel label="Balance due date">
                <input type="date" value={booking.balance_due_date || ''} onChange={(event) => setBooking({ ...booking, balance_due_date: event.target.value })} className={inputClass} />
              </FieldLabel>
              <div className="md:col-span-2">
                <FieldLabel label="Special requests">
                  <textarea
                    value={booking.special_requests || ''}
                    onChange={(event) => setBooking({ ...booking, special_requests: event.target.value })}
                    rows={4}
                    className={inputClass}
                  />
                </FieldLabel>
              </div>
            </div>
          </FormSection>
        </div>
      </div>
      <ContractPanel bookingId={booking.id} leadId={booking.lead_id} savedRevision={savedRevision} />
      <ExistingPaymentRecord bookingId={booking.id} />
      <BookingPayments bookingId={booking.id} />
      <div className="mt-6">
        <BookingConflicts booking={booking} occupancies={occupancies} settings={settings} googleBusy={googleLabels} externalState={externalState} />
        <Timeline
          events={events}
          onAdd={async ({ channel, body }) => {
            const note = channel === 'note';
            const { error: insertError } = await supabase().from('activity_events').insert({
              booking_id: booking.id,
              lead_id: booking.lead_id,
              event_type: note ? 'note' : 'communication',
              title: note ? 'Note' : channel.replace('_', ' '),
              body,
              metadata: { channel },
            });
            if (insertError) return 'Could not add that to the timeline.';
            const { data } = await supabase()
              .from('activity_events')
              .select('id, event_type, title, body, occurred_at')
              .eq('booking_id', booking.id)
              .order('occurred_at', { ascending: false });
            setEvents((data || []) as ActivityItem[]);
            return null;
          }}
        />
      </div>
    </div>
  );
}

function BookingConflicts({
  booking,
  occupancies,
  settings,
  googleBusy,
  externalState,
}: {
  booking: Booking;
  occupancies: Occupancy[];
  settings: ScheduleSettings;
  googleBusy: string[];
  externalState: ExternalCalendarState;
}) {
  const assessment = evaluateAvailability(
    {
      date: booking.event_date,
      startTime: booking.performance_start_time,
      endTime: booking.performance_end_time,
      venue: venueRef(booking.venue_address, booking.venue_name),
      excludeId: booking.id,
    },
    occupancies,
    settings,
    undefined,
    externalState,
  );
  const roster = rosterWarning(booking.performers_needed || 1, settings);
  const reasons = roster ? [...assessment.reasons, roster] : assessment.reasons;
  return <ConflictList reasons={booking.status === 'Cancelled' ? [] : reasons} googleBusy={googleBusy} />;
}

async function loadBookingAgreement(booking: Booking): Promise<AgreementDetails> {
  if (booking.lead_id) {
    const { data: lead } = await supabase()
      .from('leads')
      .select('inquiry_details, package_interest, requested_services, service_type, quoted_price')
      .eq('id', booking.lead_id)
      .maybeSingle();
    const stored = readAgreement(lead?.inquiry_details);
    if (isPackageId(stored.packageId)) return stored;
    const quoted = lead?.quoted_price;
    return {
      ...stored,
      packageId: guessPackageId({
        packageInterest: typeof lead?.package_interest === 'string' ? lead.package_interest : '',
        service:
          (typeof lead?.requested_services === 'string' && lead.requested_services) ||
          (typeof lead?.service_type === 'string' && lead.service_type) ||
          booking.service_type,
        quotedPrice: typeof quoted === 'number' ? quoted : booking.total_price,
      }),
    };
  }
  const stored = await loadAgreementNote(supabase(), booking.id);
  if (isPackageId(stored.packageId)) return stored;
  return {
    ...stored,
    packageId: guessPackageId({ service: booking.service_type, quotedPrice: booking.total_price }),
  };
}

async function persistBookingAgreement(booking: Booking, details: AgreementDetails): Promise<string | null> {
  if (booking.lead_id) {
    const { data: lead, error: readError } = await supabase()
      .from('leads')
      .select('inquiry_details')
      .eq('id', booking.lead_id)
      .maybeSingle();
    if (readError) return 'Could not save these details on the lead.';
    const { error } = await supabase()
      .from('leads')
      .update({
        event_date: booking.event_date || null,
        venue_name: booking.venue_name,
        venue_address: booking.venue_address,
        performance_start_time: booking.performance_start_time,
        performance_end_time: booking.performance_end_time,
        inquiry_details: mergeAgreement(lead?.inquiry_details, details),
        updated_at: new Date().toISOString(),
      })
      .eq('id', booking.lead_id);
    return error ? 'Could not save these details on the lead.' : null;
  }
  return saveAgreementNote(supabase(), booking.id, details);
}
