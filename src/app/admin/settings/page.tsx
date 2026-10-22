'use client';

import { useEffect, useState } from 'react';
import { GoogleConnectionCard } from '@/components/admin/GoogleConnectionCard';
import { fetchGoogleStatus, requestGoogleSync } from '@/lib/google/browser';
import { DISCONNECTED_GOOGLE_STATUS, type GoogleStatusView } from '@/lib/google/status';
import { fieldClass } from '@/lib/leads';
import { createClient } from '@/lib/supabase/client';

function supabase() {
  return createClient();
}

const NOTICES: Record<string, string> = {
  connected: 'Google Calendar is connected.',
  reconnect: 'Google needs to be connected again.',
  missing: 'The Google keys are not on the server yet.',
  denied: 'Google access was not allowed.',
  error: 'Google Calendar could not be connected. Try again.',
};

export default function SettingsPage() {
  const [setup, setSetup] = useState('30');
  const [breakdown, setBreakdown] = useState('15');
  const [travel, setTravel] = useState('90');
  const [performers, setPerformers] = useState('1');
  const [autoCountersign, setAutoCountersign] = useState(false);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [google, setGoogle] = useState<GoogleStatusView>(DISCONNECTED_GOOGLE_STATUS);
  const [googleNotice, setGoogleNotice] = useState('');
  const [googlePending, setGooglePending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await supabase()
        .from('business_settings')
        .select('setup_buffer_minutes, breakdown_buffer_minutes, travel_buffer_minutes, performer_count, auto_countersign_contracts')
        .eq('id', 1)
        .maybeSingle();
      if (cancelled || !data) return;
      setSetup(String(data.setup_buffer_minutes));
      setBreakdown(String(data.breakdown_buffer_minutes));
      setTravel(String(data.travel_buffer_minutes));
      setPerformers(String(data.performer_count));
      setAutoCountersign(data.auto_countersign_contracts === true);
    }
    load();
    fetchGoogleStatus().then((status) => {
      if (cancelled) return;
      setGoogle(status);
      const flag = new URLSearchParams(window.location.search).get('google') || '';
      if (NOTICES[flag]) setGoogleNotice(NOTICES[flag]);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    const payload = {
      setup_buffer_minutes: Number(setup),
      breakdown_buffer_minutes: Number(breakdown),
      travel_buffer_minutes: Number(travel),
      performer_count: Number(performers),
      auto_countersign_contracts: autoCountersign,
      updated_at: new Date().toISOString(),
    };
    if ([payload.setup_buffer_minutes, payload.breakdown_buffer_minutes, payload.travel_buffer_minutes].some((value) => !Number.isInteger(value) || value < 0 || value > 720) || !Number.isInteger(payload.performer_count) || payload.performer_count < 1 || payload.performer_count > 12) {
      setMessage('Use whole minutes from 0 to 720, and a roster from 1 to 12.');
      setSaving(false);
      return;
    }
    const { error } = await supabase().from('business_settings').update(payload).eq('id', 1);
    setMessage(error ? 'Could not save settings.' : 'Saved. The calendar uses these buffers from now on.');
    setSaving(false);
  };

  return (
    <>
    <form onSubmit={save} className="max-w-xl bg-white rounded-xl shadow p-6 space-y-4">
      <h2 className="text-3xl font-bold text-gray-900">Calendar settings</h2>
      <p className="text-sm text-gray-600">
        All event times are Pacific Time (San Luis Obispo). Travel time is a single buffer you choose, not a driving-distance calculation. Raise it if you often drive farther than an hour and a half. Two events at the same street address do not use the travel buffer. Daniel is part of every event, so two events still cannot overlap even when the roster is larger than one. The roster is the largest group you can bring to one event.
      </p>
      <label className="block text-sm text-gray-700">Setup buffer, minutes before the performance
        <input className={`${fieldClass} mt-1`} value={setup} onChange={(event) => setSetup(event.target.value)} />
      </label>
      <label className="block text-sm text-gray-700">Breakdown buffer, minutes after the performance
        <input className={`${fieldClass} mt-1`} value={breakdown} onChange={(event) => setBreakdown(event.target.value)} />
      </label>
      <label className="block text-sm text-gray-700">Travel buffer between different venues, minutes
        <input className={`${fieldClass} mt-1`} value={travel} onChange={(event) => setTravel(event.target.value)} />
      </label>
      <label className="block text-sm text-gray-700">Musicians you can bring, including yourself
        <input className={`${fieldClass} mt-1`} value={performers} onChange={(event) => setPerformers(event.target.value)} />
      </label>
      <label className="flex items-start gap-3 text-sm text-gray-700">
        <input type="checkbox" className="mt-1" checked={autoCountersign} onChange={(event) => setAutoCountersign(event.target.checked)} />
        <span>When a client signs an agreement, record Daniel Cimo as the musician signature at the same time. Leave this off to countersign from the lead or booking.</span>
      </label>
      <button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg">
        {saving ? 'Saving...' : 'Save settings'}
      </button>
      {message && <p className="text-sm text-gray-800">{message}</p>}
    </form>
    <GoogleConnectionCard
      view={google}
      notice={googleNotice}
      pending={googlePending}
      onSync={async () => {
        setGooglePending(true);
        setGoogleNotice('');
        await requestGoogleSync();
        setGoogle(await fetchGoogleStatus());
        setGoogleNotice('Sync finished. If Google still needs attention, the status above will say so.');
        setGooglePending(false);
      }}
      onDisconnect={async () => {
        setGooglePending(true);
        setGoogleNotice('');
        const response = await fetch('/api/admin/google/disconnect', { method: 'POST' });
        setGoogle(await fetchGoogleStatus());
        setGoogleNotice(response.ok ? 'Google Calendar is disconnected.' : 'Google Calendar could not be disconnected.');
        setGooglePending(false);
      }}
    />
    </>
  );
}
