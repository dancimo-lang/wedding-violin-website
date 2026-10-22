'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

type DashboardLead = {
  id: string;
  client_id: string | null;
  service_type: string | null;
  event_date: string | null;
  status: string;
  created_at: string;
};

type DashboardBooking = {
  id: string;
  venue_name: string | null;
  service_type: string;
  event_date: string;
  status: string;
  total_price: number;
};

export default function AdminDashboard() {
  const [leads, setLeads] = useState<DashboardLead[]>([]);
  const [bookings, setBookings] = useState<DashboardBooking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      const [
        { data: leadsData },
        { data: bookingsData },
      ] = await Promise.all([
        supabase.from('leads').select('*').order('created_at', { ascending: false }),
        supabase.from('bookings').select('*').order('event_date', { ascending: true }),
      ]);
      if (cancelled) return;
      setLeads((leadsData || []) as DashboardLead[]);
      setBookings((bookingsData || []) as DashboardBooking[]);
      setLoading(false);
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, []);

  const leadCount = leads?.length || 0;
  const bookingCount = bookings?.length || 0;
  const newLeads = leads?.filter((l) => l.status === 'New Inquiry').length || 0;
  const confirmedBookings = bookings?.filter((b) => b.status === 'Confirmed').length || 0;

  if (loading) {
    return <div className="text-gray-600">Loading dashboard...</div>;
  }

  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-900 mb-8">Dashboard Overview</h2>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow p-6">
          <div className="text-sm text-gray-600 mb-2">Total Leads</div>
          <div className="text-3xl font-bold text-gray-900">{leadCount}</div>
        </div>
        <div className="bg-white rounded-xl shadow p-6">
          <div className="text-sm text-gray-600 mb-2">New Inquiries</div>
          <div className="text-3xl font-bold text-blue-600">{newLeads}</div>
        </div>
        <div className="bg-white rounded-xl shadow p-6">
          <div className="text-sm text-gray-600 mb-2">Total Bookings</div>
          <div className="text-3xl font-bold text-gray-900">{bookingCount}</div>
        </div>
        <div className="bg-white rounded-xl shadow p-6">
          <div className="text-sm text-gray-600 mb-2">Confirmed Events</div>
          <div className="text-3xl font-bold text-green-600">{confirmedBookings}</div>
        </div>
      </div>

      {/* Recent Leads */}
      <div className="bg-white rounded-xl shadow p-6 mb-8">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Recent Leads</h3>
        {leads && leads.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Name</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Service</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Event Date</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Created</th>
                </tr>
              </thead>
              <tbody>
                {leads.slice(0, 5).map((lead) => (
                  <tr key={lead.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm">
                      <a href={`/admin/leads/${lead.id}`} className="text-blue-600 hover:text-blue-700">
                        {lead.client_id || 'Unknown'}
                      </a>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{lead.service_type || '-'}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{lead.event_date || '-'}</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                        {lead.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {new Date(lead.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No leads yet</p>
        )}
      </div>

      {/* Upcoming Bookings */}
      <div className="bg-white rounded-xl shadow p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Upcoming Bookings</h3>
        {bookings && bookings.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Venue</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Service</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Event Date</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Total</th>
                </tr>
              </thead>
              <tbody>
                {bookings.slice(0, 5).map((booking) => (
                  <tr key={booking.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm text-gray-900">{booking.venue_name || '-'}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{booking.service_type}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{booking.event_date}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        booking.status === 'Confirmed' 
                          ? 'bg-green-100 text-green-800'
                          : booking.status === 'Cancelled'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {booking.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900">${booking.total_price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No bookings yet</p>
        )}
      </div>
    </div>
  );
}
