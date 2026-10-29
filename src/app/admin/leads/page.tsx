'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { DeleteLeadButton } from '@/components/admin/DeleteLeadButton';
import { fieldClass, LEAD_STATUSES, sourceLabel, statusClass } from '@/lib/leads';

function supabase() {
  return createClient();
}

type LeadRow = {
  id: string;
  status: string;
  event_date: string | null;
  venue_name: string | null;
  requested_services: string | null;
  service_type: string | null;
  inquiry_source: string | null;
  next_follow_up_date: string | null;
  created_at: string;
  archived_at: string | null;
  message: string | null;
  clients: { name: string; email: string | null; phone: string | null; partner_name: string | null } | null;
};

type SortKey = 'name' | 'event_date' | 'status' | 'follow_up' | 'created_at';

export default function LeadsPage() {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [source, setSource] = useState('all');
  const [showArchived, setShowArchived] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data, error } = await supabase()
        .from('leads')
        .select('id, status, event_date, venue_name, requested_services, service_type, inquiry_source, next_follow_up_date, created_at, archived_at, message, clients(name, email, phone, partner_name)')
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (error) console.error('Error fetching leads');
      setLeads((data || []) as unknown as LeadRow[]);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = leads.filter((lead) => {
      if (!showArchived && lead.archived_at) return false;
      if (status !== 'all' && lead.status !== status) return false;
      if (source !== 'all' && lead.inquiry_source !== source) return false;
      if (!term) return true;
      const client = lead.clients;
      const haystack = [
        client?.name,
        client?.email,
        client?.phone,
        client?.partner_name,
        lead.venue_name,
        lead.requested_services,
        lead.service_type,
        lead.message,
        lead.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });

    const value = (lead: LeadRow) => {
      if (sortKey === 'name') return lead.clients?.name || '';
      if (sortKey === 'event_date') return lead.event_date || '';
      if (sortKey === 'status') return lead.status;
      if (sortKey === 'follow_up') return lead.next_follow_up_date || '';
      return lead.created_at;
    };
    return filtered.sort((a, b) => {
      const left = value(a);
      const right = value(b);
      if (!left && right) return 1;
      if (left && !right) return -1;
      const compared = left.localeCompare(right);
      return sortAsc ? compared : -compared;
    });
  }, [leads, search, status, source, showArchived, sortKey, sortAsc]);

  const sortBy = (key: SortKey) => {
    if (sortKey === key) setSortAsc((current) => !current);
    else {
      setSortKey(key);
      setSortAsc(key === 'name' || key === 'event_date');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-bold text-gray-900">Leads</h2>
        <Link href="/admin/leads/new" className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
          <Plus size={20} />
          Add Lead
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow p-6 mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <input className={`${fieldClass} md:col-span-2`} placeholder="Search name, email, phone, venue, or service" value={search} onChange={(event) => setSearch(event.target.value)} />
        <select className={fieldClass} value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">All statuses</option>
          {LEAD_STATUSES.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <select className={fieldClass} value={source} onChange={(event) => setSource(event.target.value)}>
          <option value="all">All sources</option>
          <option value="phone">Phone</option>
          <option value="email">Email</option>
          <option value="instagram">Instagram</option>
          <option value="referral">Referral</option>
          <option value="website">Website</option>
        </select>
        <label className="md:col-span-4 flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />
          Show archived records
        </label>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading leads...</div>
        ) : visible.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No leads match.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <SortHeader label="Client" active={sortKey === 'name'} onClick={() => sortBy('name')} />
                  <th className="text-left py-4 px-4 text-sm font-medium text-gray-600">Service</th>
                  <SortHeader label="Event date" active={sortKey === 'event_date'} onClick={() => sortBy('event_date')} />
                  <SortHeader label="Status" active={sortKey === 'status'} onClick={() => sortBy('status')} />
                  <SortHeader label="Follow-up" active={sortKey === 'follow_up'} onClick={() => sortBy('follow_up')} />
                  <th className="text-left py-4 px-4 text-sm font-medium text-gray-600">Source</th>
                  <th className="py-4 px-4"><span className="sr-only">Delete</span></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((lead) => (
                  <tr key={lead.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <Link href={`/admin/leads/${lead.id}`} className="text-blue-700 font-medium">
                        {lead.clients?.name || 'Unnamed client'}
                        {lead.archived_at ? ' (archived)' : ''}
                      </Link>
                      <div className="text-xs text-gray-500">{lead.clients?.email || lead.clients?.phone || ''}</div>
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-700">{lead.requested_services || lead.service_type || '—'}</td>
                    <td className="py-4 px-4 text-sm text-gray-700">{lead.event_date || '—'}</td>
                    <td className="py-4 px-4">
                      <span className={`inline-flex px-3 py-1 text-xs font-medium rounded-full ${statusClass(lead.status)}`}>{lead.status}</span>
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-700">{lead.next_follow_up_date || '—'}</td>
                    <td className="py-4 px-4 text-sm text-gray-700">{sourceLabel(lead.inquiry_source)}</td>
                    <td className="py-4 px-4 text-right">
                      <DeleteLeadButton
                        leadId={lead.id}
                        clientName={lead.clients?.name || 'Unnamed client'}
                        placement="row"
                        onDeleted={() => setLeads((current) => current.filter((row) => row.id !== lead.id))}
                      />
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

function SortHeader({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <th className="text-left py-4 px-4 text-sm font-medium text-gray-600">
      <button type="button" onClick={onClick} className={active ? 'text-blue-700' : ''}>
        {label}
      </button>
    </th>
  );
}
