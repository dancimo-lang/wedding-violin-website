'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';

const supabase = createClient();

const BOOKING_STATUSES = ['Tentative', 'Confirmed', 'Cancelled', 'Completed'] as const;

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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
      }
      setLoading(false);
    }

    fetchBooking();
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  const handleSave = async () => {
    if (!booking) return;
    setSaving(true);
    setError('');

    const { error } = await supabase
      .from('bookings')
      .update({
        status: booking.status,
        event_date: booking.event_date,
        venue_name: booking.venue_name || null,
        venue_address: booking.venue_address || null,
        service_type: booking.service_type,
        performance_start_time: booking.performance_start_time || null,
        performance_end_time: booking.performance_end_time || null,
        setup_time: booking.setup_time || null,
        breakdown_time: booking.breakdown_time || null,
        travel_buffer_hours: booking.travel_buffer_hours,
        total_price: booking.total_price,
        retainer_amount: booking.retainer_amount,
        retainer_due_date: booking.retainer_due_date || null,
        balance_due_date: booking.balance_due_date || null,
        special_requests: booking.special_requests || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', booking.id);

    if (error) {
      setError('Failed to save booking');
    } else {
      router.push('/admin/bookings');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!booking || !confirm('Are you sure you want to delete this booking?')) return;

    const { error } = await supabase.from('bookings').delete().eq('id', booking.id);

    if (error) {
      setError('Failed to delete booking');
    } else {
      router.push('/admin/bookings');
    }
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
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
          >
            <Trash2 size={20} />
            Delete
          </button>
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

      <div className="bg-white rounded-xl shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
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
    </div>
  );
}
