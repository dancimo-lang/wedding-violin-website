'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { Plus } from 'lucide-react';

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

type ClientInfo = {
  name: string | null;
  partner_name: string | null;
  email: string | null;
};

function clientLabel(booking: Booking): string {
  const client = Array.isArray(booking.clients) ? booking.clients[0] : booking.clients;
  const names = [client?.name, client?.partner_name]
    .map((value) => value?.trim())
    .filter(Boolean);
  if (names.length > 0) return names.join(' & ');
  if (client?.email?.trim()) return client.email.trim();
  return booking.client_id ? booking.client_id.slice(0, 8) : '-';
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [showCancelled, setShowCancelled] = useState(false);
  const [loading, setLoading] = useState(true);

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
      setLoading(false);
    }

    fetchBookings();
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleBookings = showCancelled
    ? bookings
    : bookings.filter((booking) => booking.status !== 'Cancelled');

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
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
        >
          <Plus size={20} />
          Add on calendar
        </Link>
        <Link
          href="/admin/bookings/existing"
          className="flex items-center gap-2 border border-blue-600 text-blue-700 hover:bg-blue-50 px-4 py-2 rounded-lg"
        >
          <Plus size={20} />
          Add existing booking
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading bookings...</div>
        ) : visibleBookings.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {bookings.length === 0
              ? 'No bookings yet. Convert a lead to a booking to get started.'
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
                    <td className="py-4 px-6 text-sm text-gray-900">{clientLabel(booking)}</td>
                    <td className="py-4 px-6 text-sm text-gray-600">{booking.venue_name || '-'}</td>
                    <td className="py-4 px-6 text-sm text-gray-600">{booking.service_type}</td>
                    <td className="py-4 px-6 text-sm text-gray-600">{booking.event_date}</td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(booking.status)}`}>
                        {booking.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-900">${booking.total_price}</td>
                    <td className="py-4 px-6">
                      <Link
                        href={`/admin/bookings/${booking.id}`}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        View
                      </Link>
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
