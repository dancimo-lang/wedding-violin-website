'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';

const supabase = createClient();

const LEAD_STATUSES = [
  'New Inquiry',
  'Needs Information',
  'Quote Sent',
  'Awaiting Response',
  'Contract Sent',
  'Awaiting Retainer',
  'Lost',
] as const;

type Note = {
  id: string;
  note_type: string;
  content: string;
  created_at: string;
};

type Lead = {
  id: string;
  client_id: string;
  status: string;
  event_date: string | null;
  venue_name: string | null;
  venue_address: string | null;
  service_type: string | null;
  package_interest: string | null;
  performance_start_time: string | null;
  performance_end_time: string | null;
  estimated_duration_hours: number | null;
  guest_count: number | null;
  budget_range: string | null;
  how_they_found_us: string | null;
  message: string | null;
  quoted_price: number | null;
  next_follow_up_date: string | null;
};

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [lead, setLead] = useState<Lead | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const leadId = params.id;

  useEffect(() => {
    let cancelled = false;

    async function fetchLead() {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .single();

      if (cancelled) return;
      if (error) {
        setError('Failed to load lead');
      } else {
        setLead(data as Lead);
      }
      setLoading(false);
    }

    async function fetchNotes() {
      const { data } = await supabase
        .from('notes')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });
      if (!cancelled) setNotes((data || []) as Note[]);
    }

    fetchLead();
    fetchNotes();
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  const handleSave = async () => {
    if (!lead) return;
    setSaving(true);
    setError('');

    const { error } = await supabase
      .from('leads')
      .update({
        status: lead.status,
        event_date: lead.event_date || null,
        venue_name: lead.venue_name || null,
        venue_address: lead.venue_address || null,
        service_type: lead.service_type || null,
        package_interest: lead.package_interest || null,
        performance_start_time: lead.performance_start_time || null,
        performance_end_time: lead.performance_end_time || null,
        estimated_duration_hours: lead.estimated_duration_hours,
        guest_count: lead.guest_count,
        budget_range: lead.budget_range || null,
        how_they_found_us: lead.how_they_found_us || null,
        message: lead.message || null,
        quoted_price: lead.quoted_price,
        next_follow_up_date: lead.next_follow_up_date || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', lead.id);

    if (error) {
      setError('Failed to save lead');
    } else {
      router.push('/admin/leads');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!lead || !confirm('Are you sure you want to delete this lead?')) return;

    const { error } = await supabase.from('leads').delete().eq('id', lead.id);

    if (error) {
      setError('Failed to delete lead');
    } else {
      router.push('/admin/leads');
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !lead) return;

    const { data: claims } = await supabase.auth.getClaims();
    const { error } = await supabase.from('notes').insert({
      lead_id: lead.id,
      note_type: 'Internal',
      content: newNote,
      is_private: false,
      created_by: claims?.claims?.sub ?? null,
    });

    if (error) {
      setError('Failed to add note');
    } else {
      setNewNote('');
      const { data } = await supabase
        .from('notes')
        .select('*')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: false });
      setNotes((data || []) as Note[]);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading lead...</div>;
  }

  if (!lead) {
    return <div className="p-8 text-center text-gray-500">Lead not found</div>;
  }

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
          <h2 className="text-3xl font-bold text-gray-900">Lead Details</h2>
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
              value={lead.status}
              onChange={(e) => setLead({ ...lead, status: e.target.value })}
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
              value={lead.event_date || ''}
              onChange={(e) => setLead({ ...lead, event_date: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Service Type
            </label>
            <input
              type="text"
              value={lead.service_type || ''}
              onChange={(e) => setLead({ ...lead, service_type: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Package Interest
            </label>
            <input
              type="text"
              value={lead.package_interest || ''}
              onChange={(e) => setLead({ ...lead, package_interest: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Venue Name
            </label>
            <input
              type="text"
              value={lead.venue_name || ''}
              onChange={(e) => setLead({ ...lead, venue_name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Venue Address
            </label>
            <input
              type="text"
              value={lead.venue_address || ''}
              onChange={(e) => setLead({ ...lead, venue_address: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Performance Start Time
            </label>
            <input
              type="time"
              value={lead.performance_start_time || ''}
              onChange={(e) => setLead({ ...lead, performance_start_time: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Performance End Time
            </label>
            <input
              type="time"
              value={lead.performance_end_time || ''}
              onChange={(e) => setLead({ ...lead, performance_end_time: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Estimated Duration (hours)
            </label>
            <input
              type="number"
              value={lead.estimated_duration_hours || ''}
              onChange={(e) => setLead({ ...lead, estimated_duration_hours: Number(e.target.value) })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Guest Count
            </label>
            <input
              type="number"
              value={lead.guest_count || ''}
              onChange={(e) => setLead({ ...lead, guest_count: Number(e.target.value) })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Budget Range
            </label>
            <input
              type="text"
              value={lead.budget_range || ''}
              onChange={(e) => setLead({ ...lead, budget_range: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quoted Price
            </label>
            <input
              type="number"
              value={lead.quoted_price || ''}
              onChange={(e) => setLead({ ...lead, quoted_price: Number(e.target.value) })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Next Follow-up Date
            </label>
            <input
              type="date"
              value={lead.next_follow_up_date || ''}
              onChange={(e) => setLead({ ...lead, next_follow_up_date: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              How They Found Us
            </label>
            <input
              type="text"
              value={lead.how_they_found_us || ''}
              onChange={(e) => setLead({ ...lead, how_they_found_us: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Message
            </label>
            <textarea
              value={lead.message || ''}
              onChange={(e) => setLead({ ...lead, message: e.target.value })}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>
        </div>
      </div>

      {/* Notes Section */}
      <div className="bg-white rounded-xl shadow p-6 mt-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Notes</h3>
        
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Add a note..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 placeholder:text-gray-500"
            onKeyPress={(e) => e.key === 'Enter' && handleAddNote()}
          />
          <button
            onClick={handleAddNote}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
          >
            Add
          </button>
        </div>

        <div className="space-y-3">
          {notes.length === 0 ? (
            <p className="text-gray-500 text-sm">No notes yet</p>
          ) : (
            notes.map((note) => (
              <div key={note.id} className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-500 uppercase">
                    {note.note_type}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(note.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-gray-700">{note.content}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
