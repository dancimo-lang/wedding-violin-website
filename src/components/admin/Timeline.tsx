'use client';

import { useState } from 'react';
import { fieldClass } from '@/lib/leads';

export type ActivityItem = {
  id: string;
  event_type: string;
  title: string;
  body: string | null;
  occurred_at: string;
};

const TYPE_LABELS: Record<string, string> = {
  inquiry: 'Inquiry',
  note: 'Note',
  status_change: 'Status',
  communication: 'Communication',
  quote: 'Quote',
  contract: 'Contract',
  payment: 'Payment',
  email: 'Email',
  calendar: 'Calendar',
};

const CHANNELS = [
  { value: 'note', label: 'Internal note' },
  { value: 'phone', label: 'Phone call' },
  { value: 'email', label: 'Email' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'in_person', label: 'In person' },
  { value: 'other', label: 'Other' },
];

export function Timeline({
  events,
  onAdd,
}: {
  events: ActivityItem[];
  onAdd: (input: { channel: string; body: string }) => Promise<string | null>;
}) {
  const [channel, setChannel] = useState('note');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!body.trim()) return;
    setSaving(true);
    setError('');
    const message = await onAdd({ channel, body: body.trim() });
    setSaving(false);
    if (message) {
      setError(message);
      return;
    }
    setBody('');
  };

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-1">Timeline</h3>
      <p className="text-sm text-gray-600 mb-4">
        Inquiries, notes, status changes, and conversations live here. Quotes, contracts, payments, and automated emails will be added to this same list later.
      </p>
      <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-[180px_1fr_auto] gap-3 mb-6">
        <select className={fieldClass} value={channel} onChange={(event) => setChannel(event.target.value)}>
          {CHANNELS.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </select>
        <input
          className={fieldClass}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="What happened?"
        />
        <button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg">
          {saving ? 'Adding...' : 'Add'}
        </button>
      </form>
      {error && <p className="text-sm text-red-700 mb-4">{error}</p>}
      {events.length === 0 ? (
        <p className="text-sm text-gray-500">Nothing on the timeline yet.</p>
      ) : (
        <ol className="space-y-4">
          {events.map((item) => (
            <li key={item.id} className="border-l-2 border-blue-200 pl-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-blue-700">
                  {TYPE_LABELS[item.event_type] || item.event_type}
                </span>
                <span className="text-sm font-medium text-gray-900">{item.title}</span>
                <time className="text-xs text-gray-500">
                  {new Date(item.occurred_at).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })} PT
                </time>
              </div>
              {item.body && <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{item.body}</p>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function ConflictList({ reasons, googleBusy = [] }: { reasons: string[]; googleBusy?: string[] }) {
  if (reasons.length === 0 && googleBusy.length === 0) return null;
  return (
    <div className="space-y-3 mb-6">
      {reasons.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-950 px-4 py-3 rounded-lg">
          <p className="font-medium mb-1">Check the calendar before relying on this time</p>
          <ul className="list-disc pl-5 text-sm space-y-1">
            {reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      )}
      {googleBusy.length > 0 && (
        <div className="bg-gray-100 border border-gray-300 text-gray-700 px-4 py-3 rounded-lg">
          <p className="font-medium mb-1">Busy on Google Calendar</p>
          <ul className="list-disc pl-5 text-sm space-y-1">
            {googleBusy.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
