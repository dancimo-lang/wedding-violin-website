'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { ArrowLeft, Ban, Save } from 'lucide-react';
import { ConflictList, Timeline, type ActivityItem } from '@/components/admin/Timeline';
import { friendlyWriteError, postBookingStatus } from '@/lib/booking-status-client';
import { fetchGoogleStatus, loadGoogleBusy, statusToExternalState, type GoogleBusyRow } from '@/lib/google/browser';
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

const supabase = createClient();

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

export default function BookingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [savedStatus, setSavedStatus] = useState('');
  const [events, setEvents] = useState<ActivityItem[]>([]);
  const [occupancies, setOccupancies] = useState<Occupancy[]>([]);
  const [googleLabels, setGoogleLabels] = useState<string[]>([]);
  const [externalState, setExternalState] = useState<ExternalCalendarState>('disconnected');
  const [settings, setSettings] = useState<ScheduleSettings>(DEFAULT_SCHEDULE_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [error, setError] = useState('');

  const bookingId = params.id;

  useEffect(() => {
    let cancelled = false;

    async function fetchBooking() {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', bookingId)
        .single();

      if (cancelled) return;
      if (error) {
        setError('Failed to load booking');
      } else {
        setBooking(data as Booking);
        setSavedStatus((data as Booking).status);
      }
      const { data: activity } = await supabase
        .from('activity_events')
        .select('id, event_type, title, body, occurred_at')
        .eq('booking_id', bookingId)
        .order('occurred_at', { ascending: false });
      if (!cancelled) setEvents((activity || []) as ActivityItem[]);
      setLoading(false);
    }

    fetchBooking();
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  useEffect(() => {
    if (!booking?.event_date) return;
    let cancelled = false;
    const eventDate = booking.event_date;
    async function loadNearby() {
      const from = addCalendarDays(eventDate, -1);
      const to = addCalendarDays(eventDate, 1);
      const [settingsResult, bookingsResult, blocksResult, googleStatus, busyRows] = await Promise.all([
        supabase.from('business_settings').select('setup_buffer_minutes, breakdown_buffer_minutes, travel_buffer_minutes, performer_count').eq('id', 1).maybeSingle(),
        supabase.from('bookings').select('id, status, event_date, performance_start_time, performance_end_time, venue_name, venue_address, performers_needed').gte('event_date', from).lte('event_date', to),
        supabase.from('availability_blocks').select('id, block_type, start_date, end_date, start_time, end_time, all_day').lte('start_date', to).gte('end_date', from),
        fetchGoogleStatus(),
        loadGoogleBusy(supabase, from, to),
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
    const { data } = await supabase
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

  const handleSave = async () => {
    if (!booking) return;
    setSaving(true);
    setError('');

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
      router.push('/admin/bookings');
      return;
    }

    const { error: saveError } = await supabase
      .from('bookings')
      .update({
        ...bookingFields(booking),
        updated_at: new Date().toISOString(),
      })
      .eq('id', booking.id);

    if (saveError) {
      setError(friendlyWriteError(saveError.message, 'Failed to save booking'));
    } else {
      router.push('/admin/bookings');
    }
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

  if (loading) {
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
          <h2 className="text-3xl font-bold text-gray-900">Booking Details</h2>
        </div>
        <div className="flex gap-2">
          {booking.status === 'Cancelled' ? (
            <button
              type="button"
              onClick={handleRestore}
              disabled={saving}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-800"
            >
              Restore booking
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setCancelOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-red-700 hover:bg-red-50 rounded-lg"
            >
              <Ban size={20} />
              Cancel booking
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg"
          >
            <Save size={20} />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

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
            <button
              type="button"
              onClick={handleCancel}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-red-700 text-white disabled:bg-red-400"
            >
              {saving ? 'Cancelling...' : 'Cancel booking'}
            </button>
            <button
              type="button"
              onClick={() => setCancelOpen(false)}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-800"
            >
              Keep booking
            </button>
          </div>
        </div>
      )}

      <div className={`rounded-xl shadow p-6 ${booking.status === 'Cancelled' ? 'bg-gray-50 text-gray-600' : 'bg-white'}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            {booking.status === 'Cancelled' ? (
              <p className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700">Cancelled</p>
            ) : (
              <select
                value={booking.status}
                onChange={(e) => setBooking({ ...booking, status: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
              >
                {BOOKING_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Event Date *
            </label>
            <input
              type="date"
              value={booking.event_date}
              onChange={(e) => setBooking({ ...booking, event_date: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Musicians needed
            </label>
            <input
              type="number"
              min={1}
              max={12}
              value={booking.performers_needed || 1}
              onChange={(e) => setBooking({ ...booking, performers_needed: Number(e.target.value) })}
              className={fieldClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Service Type *
            </label>
            <input
              type="text"
              value={booking.service_type}
              onChange={(e) => setBooking({ ...booking, service_type: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Total Price ($) *
            </label>
            <input
              type="number"
              value={booking.total_price}
              onChange={(e) => setBooking({ ...booking, total_price: Number(e.target.value) })}
              step="0.01"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Venue Name
            </label>
            <input
              type="text"
              value={booking.venue_name || ''}
              onChange={(e) => setBooking({ ...booking, venue_name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Venue Address
            </label>
            <input
              type="text"
              value={booking.venue_address || ''}
              onChange={(e) => setBooking({ ...booking, venue_address: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Performance Start Time
            </label>
            <input
              type="time"
              value={timeValue(booking.performance_start_time)}
              onChange={(e) => setBooking({ ...booking, performance_start_time: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Performance End Time
            </label>
            <input
              type="time"
              value={timeValue(booking.performance_end_time)}
              onChange={(e) => setBooking({ ...booking, performance_end_time: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Setup Time
            </label>
            <input
              type="time"
              value={timeValue(booking.setup_time)}
              onChange={(e) => setBooking({ ...booking, setup_time: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Breakdown Time
            </label>
            <input
              type="time"
              value={timeValue(booking.breakdown_time)}
              onChange={(e) => setBooking({ ...booking, breakdown_time: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Travel Buffer (hours)
            </label>
            <input
              type="number"
              value={booking.travel_buffer_hours ?? ''}
              onChange={(e) => setBooking({ ...booking, travel_buffer_hours: optionalNumber(e.target.value) })}
              step="0.5"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Retainer Amount ($)
            </label>
            <input
              type="number"
              value={booking.retainer_amount ?? ''}
              onChange={(e) => setBooking({ ...booking, retainer_amount: optionalNumber(e.target.value) })}
              step="0.01"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Retainer Due Date
            </label>
            <input
              type="date"
              value={booking.retainer_due_date || ''}
              onChange={(e) => setBooking({ ...booking, retainer_due_date: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Balance Due Date
            </label>
            <input
              type="date"
              value={booking.balance_due_date || ''}
              onChange={(e) => setBooking({ ...booking, balance_due_date: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Special Requests
            </label>
            <textarea
              value={booking.special_requests || ''}
              onChange={(e) => setBooking({ ...booking, special_requests: e.target.value })}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>
        </div>
      </div>
      <div className="mt-6">
        <BookingConflicts booking={booking} occupancies={occupancies} settings={settings} googleBusy={googleLabels} externalState={externalState} />
        <Timeline
          events={events}
          onAdd={async ({ channel, body }) => {
            const note = channel === 'note';
            const { error: insertError } = await supabase.from('activity_events').insert({
              booking_id: booking.id,
              lead_id: booking.lead_id,
              event_type: note ? 'note' : 'communication',
              title: note ? 'Note' : channel.replace('_', ' '),
              body,
              metadata: { channel },
            });
            if (insertError) return 'Could not add that to the timeline.';
            const { data } = await supabase
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
