'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { adminButtonClass } from '@/components/admin/AdminButton';
import { Plus } from 'lucide-react';
import { clientLabel, firstClient, type ClientInfo } from '@/lib/bookings/client-label';
import { inTab, isPastEvent, todayInPacific, type BookingTab } from '@/lib/bookings/archive';
import { postBookingStatus } from '@/lib/booking-status-client';

function supabase() {
  return createClient();
}

type Booking = {
  id: string;
  lead_id: string | null;
  client_id: string;
  status: string;
  event_date: string;
  venue_name: string | null;
  service_type: string;
  total_price: number;
  created_at: string;
  clients: ClientInfo | ClientInfo[] | null;
};

function rowLabel(booking: Booking): string {
  return clientLabel(firstClient(booking.clients), booking.client_id);
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [showCancelled, setShowCancelled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<BookingTab>('upcoming');
  const [openDue, setOpenDue] = useState<Record<string, number>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const today = todayInPacific();

  useEffect(() => {
    let cancelled = false;

    async function fetchBookings() {
      setLoading(true);
      const { data, error } = await supabase()
        .from('bookings')
        .select('*, clients(name, partner_name, email)')
        .order('event_date', { ascending: true });

      if (cancelled) return;
      if (error) {
        console.error('Error fetching bookings:', error);
      } else {
        setBookings((data || []) as Booking[]);
      }
      // Open retainer/balance amounts still owed, from the existing payment records.
      const { data: obligations, error: obligationError } = await supabase()
        .from('payment_obligations')
        .select('booking_id, amount_cents')
        .eq('status', 'open');
      if (cancelled) return;
      if (obligationError) {
        console.error('Error fetching open payments:', obligationError);
      } else {
        const due: Record<string, number> = {};
        for (const row of (obligations || []) as { booking_id: string; amount_cents: number }[]) {
          due[row.booking_id] = (due[row.booking_id] || 0) + Number(row.amount_cents || 0);
        }
        setOpenDue(due);
      }
      setLoading(false);
    }

    fetchBookings();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeBookings = showCancelled
    ? bookings
    : bookings.filter((booking) => booking.status !== 'Cancelled');
  const tabBookings = activeBookings.filter((booking) => inTab(booking.event_date, tab, today));
  // Past events read newest first; upcoming stay soonest first.
  const visibleBookings = tab === 'past' ? [...tabBookings].reverse() : tabBookings;
  const hasBalanceDue = (booking: Booking) =>
    booking.status !== 'Cancelled' && (openDue[booking.id] || 0) > 0;
  const pastWithBalance = activeBookings.filter(
    (booking) => isPastEvent(booking.event_date, today) && hasBalanceDue(booking),
  ).length;

  async function setCompleted(booking: Booking, completed: boolean) {
    setBusyId(booking.id);
    setActionError('');
    const result = await postBookingStatus({
      action: 'apply_booking',
      bookingId: booking.id,
      leadId: booking.lead_id,
      status: completed ? 'Completed' : 'Confirmed',
    });
    if (result.ok) {
      const nextStatus = result.bookingStatus || (completed ? 'Completed' : 'Confirmed');
      setBookings((rows) => rows.map((row) => (row.id === booking.id ? { ...row, status: nextStatus } : row)));
    } else {
      setActionError(result.error);
    }
    setBusyId(null);
  }

  const tabs: { id: BookingTab; label: string }[] = [
    { id: 'upcoming', label: 'Upcoming' },
    { id: 'past', label: 'Past' },
    { id: 'all', label: 'All' },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Confirmed':
        return 'bg-green-100 text-green-800';
      case 'Tentative':
        return 'bg-yellow-100 text-yellow-800';
      case 'Cancelled':
        return 'bg-gray-200 text-gray-600';
      case 'Completed':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8 gap-4">
        <h2 className="text-3xl font-bold text-gray-900">Bookings</h2>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={showCancelled}
            onChange={(event) => setShowCancelled(event.target.checked)}
          />
          Show cancelled
        </label>
        <Link
          href="/admin/calendar"
          className={adminButtonClass('primary', 'md', 'gap-2')}
        >
          <Plus size={20} />
          Add on calendar
        </Link>
        <Link
          href="/admin/bookings/existing"
          className={adminButtonClass('secondary', 'md', 'gap-2')}
        >
          <Plus size={20} />
          Add existing booking
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4" role="tablist" aria-label="Booking dates">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={adminButtonClass(tab === item.id ? 'primary' : 'secondary', 'sm', 'gap-2')}
          >
            {item.label}
            {item.id === 'past' && pastWithBalance > 0 && (
              <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-800">
                {pastWithBalance} balance due
              </span>
            )}
          </button>
        ))}
      </div>

      {actionError && (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{actionError}</p>
      )}

      <div className="bg-white rounded-xl shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading bookings...</div>
        ) : visibleBookings.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {bookings.length === 0
              ? 'No bookings yet. Convert a lead to a booking to get started.'
              : tab === 'upcoming'
                ? 'No upcoming bookings. Past events are under the Past tab.'
                : tab === 'past'
                  ? 'No past bookings.'
                  : 'No open bookings. Show cancelled to see bookings that were taken off the calendar.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-600">Couple</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-600">Venue</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-600">Service</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-600">Event Date</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-600">Status</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-600">Total</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleBookings.map((booking) => (
                  <tr
                    key={booking.id}
                    className={
                      booking.status === 'Cancelled'
                        ? 'border-b border-gray-100 bg-gray-50 text-gray-500'
                        : 'border-b border-gray-100 hover:bg-gray-50'
                    }
                  >
                    <td className="py-4 px-6 text-sm text-gray-900">{rowLabel(booking)}</td>
                    <td className="py-4 px-6 text-sm text-gray-600">{booking.venue_name || '-'}</td>
                    <td className="py-4 px-6 text-sm text-gray-600">{booking.service_type}</td>
                    <td className="py-4 px-6 text-sm text-gray-600">{booking.event_date}</td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(booking.status)}`}>
                        {booking.status}
                      </span>
                      {isPastEvent(booking.event_date, today) && hasBalanceDue(booking) && (
                        <span
                          className="ml-2 inline-flex px-3 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800"
                          title="Open retainer or balance in payment records"
                        >
                          Balance due ${(openDue[booking.id] / 100).toFixed(2)}
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-900">${booking.total_price}</td>
                    <td className="py-4 px-6">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/admin/bookings/${booking.id}`}
                          className={adminButtonClass('secondary', 'sm')}
                        >
                          View
                        </Link>
                        {booking.status === 'Completed' ? (
                          <button
                            type="button"
                            disabled={busyId === booking.id}
                            onClick={() => setCompleted(booking, false)}
                            className={adminButtonClass('secondary', 'sm')}
                            title="Undo: set this booking back to Confirmed"
                          >
                            {busyId === booking.id ? 'Saving...' : 'Undo completed'}
                          </button>
                        ) : booking.status !== 'Cancelled' && isPastEvent(booking.event_date, today) ? (
                          <button
                            type="button"
                            disabled={busyId === booking.id}
                            onClick={() => setCompleted(booking, true)}
                            className={adminButtonClass('secondary', 'sm')}
                          >
                            {busyId === booking.id ? 'Saving...' : 'Mark completed'}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
