'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { ArrowLeft, Save } from 'lucide-react';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const LEAD_STATUSES = [
  'New Inquiry',
  'Needs Information',
  'Quote Sent',
  'Awaiting Response',
  'Contract Sent',
  'Awaiting Retainer',
  'Lost',
] as const;

export default function NewLeadPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    client_id: '',
    status: 'New Inquiry',
    event_date: '',
    venue_name: '',
    venue_address: '',
    service_type: '',
    package_interest: '',
    performance_start_time: '',
    performance_end_time: '',
    estimated_duration_hours: '',
    guest_count: '',
    budget_range: '',
    how_they_found_us: '',
    message: '',
    quoted_price: '',
    next_follow_up_date: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    // First create or find the client
    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .upsert({
        email: formData.client_id,
        name: formData.client_id.split('@')[0] || 'Unknown',
      })
      .select()
      .single();

    if (clientError) {
      setError('Failed to create client');
      setSaving(false);
      return;
    }

    // Then create the lead
    const { error: leadError } = await supabase.from('leads').insert({
      client_id: clientData.id,
      status: formData.status,
      event_date: formData.event_date || null,
      venue_name: formData.venue_name || null,
      venue_address: formData.venue_address || null,
      service_type: formData.service_type || null,
      package_interest: formData.package_interest || null,
      performance_start_time: formData.performance_start_time || null,
      performance_end_time: formData.performance_end_time || null,
      estimated_duration_hours: formData.estimated_duration_hours ? parseFloat(formData.estimated_duration_hours) : null,
      guest_count: formData.guest_count ? parseInt(formData.guest_count) : null,
      budget_range: formData.budget_range || null,
      how_they_found_us: formData.how_they_found_us || null,
      message: formData.message || null,
      quoted_price: formData.quoted_price ? parseFloat(formData.quoted_price) : null,
      next_follow_up_date: formData.next_follow_up_date || null,
    });

    if (leadError) {
      setError('Failed to create lead');
    } else {
      router.push('/admin/leads');
    }
    setSaving(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/leads"
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft size={20} />
          </Link>
          <h2 className="text-3xl font-bold text-gray-900">New Lead</h2>
        </div>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg"
        >
          <Save size={20} />
          {saving ? 'Creating...' : 'Create Lead'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Client Email *
            </label>
            <input
              type="email"
              name="client_id"
              value={formData.client_id}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
              placeholder="client@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
            >
              {LEAD_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Event Date
            </label>
            <input
              type="date"
              name="event_date"
              value={formData.event_date}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Service Type
            </label>
            <input
              type="text"
              name="service_type"
              value={formData.service_type}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
              placeholder="e.g., Wedding Ceremony"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Package Interest
            </label>
            <input
              type="text"
              name="package_interest"
              value={formData.package_interest}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
              placeholder="e.g., Ceremony + Cocktail Hour"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Venue Name
            </label>
            <input
              type="text"
              name="venue_name"
              value={formData.venue_name}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Venue Address
            </label>
            <input
              type="text"
              name="venue_address"
              value={formData.venue_address}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Performance Start Time
            </label>
            <input
              type="time"
              name="performance_start_time"
              value={formData.performance_start_time}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Performance End Time
            </label>
            <input
              type="time"
              name="performance_end_time"
              value={formData.performance_end_time}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Estimated Duration (hours)
            </label>
            <input
              type="number"
              name="estimated_duration_hours"
              value={formData.estimated_duration_hours}
              onChange={handleChange}
              step="0.5"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Guest Count
            </label>
            <input
              type="number"
              name="guest_count"
              value={formData.guest_count}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Budget Range
            </label>
            <input
              type="text"
              name="budget_range"
              value={formData.budget_range}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
              placeholder="e.g., $1,000 - $2,000"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              How They Found Us
            </label>
            <input
              type="text"
              name="how_they_found_us"
              value={formData.how_they_found_us}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quoted Price ($)
            </label>
            <input
              type="number"
              name="quoted_price"
              value={formData.quoted_price}
              onChange={handleChange}
              step="0.01"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Next Follow-up Date
            </label>
            <input
              type="date"
              name="next_follow_up_date"
              value={formData.next_follow_up_date}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Message
            </label>
            <textarea
              name="message"
              value={formData.message}
              onChange={handleChange}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
              placeholder="Client's message or notes..."
            />
          </div>
        </div>
      </form>
    </div>
  );
}
