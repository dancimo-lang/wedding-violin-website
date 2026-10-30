'use client';

import { useState } from 'react';

const MESSAGES = {
  appears_available: 'This date appears available. Send the inquiry below and Daniel will confirm it personally.',
  unavailable: 'This date is unavailable.',
  requires_manual_confirmation: 'This date needs Daniel to confirm it personally. Send the inquiry below and he will check.',
} as const;

export function AvailabilityCheck() {
  const [date, setDate] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState<'idle' | 'ok' | 'no' | 'maybe' | 'wait'>('idle');
  const [checking, setChecking] = useState(false);

  const check = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!date) return;
    setChecking(true);
    setMessage('');
    const params = new URLSearchParams({ date });
    if (start) params.set('start', start);
    if (end) params.set('end', end);
    try {
      const response = await fetch(`/api/availability?${params.toString()}`);
      const body = (await response.json()) as { result?: keyof typeof MESSAGES; error?: string };
      if (response.status === 429) {
        setTone('wait');
        setMessage(body.error || 'Please wait a little while before checking another date.');
      } else if (body.result && body.result in MESSAGES) {
        setTone(body.result === 'appears_available' ? 'ok' : body.result === 'unavailable' ? 'no' : 'maybe');
        setMessage(MESSAGES[body.result]);
      } else {
        setTone('maybe');
        setMessage(MESSAGES.requires_manual_confirmation);
      }
    } catch {
      setTone('maybe');
      setMessage(MESSAGES.requires_manual_confirmation);
    }
    setChecking(false);
  };

  const toneClass =
    tone === 'ok'
      ? 'bg-green-50 text-green-800'
      : tone === 'no'
        ? 'bg-red-50 text-red-800'
        : tone === 'idle'
          ? ''
          : 'bg-amber-50 text-amber-900';

  return (
    <form onSubmit={check} className="bg-white rounded-2xl shadow-xl p-8 mb-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Check a date</h2>
      <p className="text-gray-600 mb-6">
        Times are Pacific Time. Add a start and end for a closer answer. This is a first look only, and Daniel confirms every date himself.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <label className="block text-sm font-medium text-gray-700">
          Date
          <input
            type="date"
            required
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="mt-2 w-full px-4 py-3 border border-gray-300 rounded-lg text-black"
          />
        </label>
        <label className="block text-sm font-medium text-gray-700">
          Start <span className="text-gray-400">(optional)</span>
          <input
            type="time"
            value={start}
            onChange={(event) => setStart(event.target.value)}
            className="mt-2 w-full px-4 py-3 border border-gray-300 rounded-lg text-black"
          />
        </label>
        <label className="block text-sm font-medium text-gray-700">
          End <span className="text-gray-400">(optional)</span>
          <input
            type="time"
            value={end}
            onChange={(event) => setEnd(event.target.value)}
            className="mt-2 w-full px-4 py-3 border border-gray-300 rounded-lg text-black"
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={checking}
        className="mt-6 bg-amber-700 hover:bg-amber-800 disabled:bg-amber-400 text-white px-6 py-3 rounded-full font-semibold"
      >
        {checking ? 'Checking...' : 'Check this date'}
      </button>
      {message && <p className={`mt-4 px-4 py-3 rounded-lg text-sm ${toneClass}`}>{message}</p>}
    </form>
  );
}
