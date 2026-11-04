'use client';

import { useEffect, useState } from 'react';
import { EXISTING_PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from '@/lib/bookings/existing-booking';

type View = {
  existing: boolean;
  bookingCode: string;
  totalCents: number;
  paidCents: number;
  owedCents: number;
  balanceDueDate: string | null;
  paymentLink: string | null;
  canReplace: boolean;
  blockedReason: string | null;
};

function dollars(cents: number) {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function ExistingPaymentRecord({ bookingId }: { bookingId: string }) {
  const [view, setView] = useState<View | null>(null);
  const [amountPaid, setAmountPaid] = useState('0');
  const [balanceDueDate, setBalanceDueDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const response = await fetch(`/api/admin/bookings/existing/payment?bookingId=${encodeURIComponent(bookingId)}`, { cache: 'no-store' });
    const payload = (await response.json()) as View & { error?: string };
    if (!response.ok) {
      setError(payload.error || 'The payment record could not be loaded.');
      return;
    }
    if (!payload.existing) {
      setView(null);
      return;
    }
    setView(payload);
    setAmountPaid((payload.paidCents / 100).toFixed(2));
    setBalanceDueDate(payload.balanceDueDate || '');
  };

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/bookings/existing/payment?bookingId=${encodeURIComponent(bookingId)}`, { cache: 'no-store' })
      .then(async (response) => {
        const payload = (await response.json()) as View & { error?: string };
        if (cancelled) return;
        if (!response.ok || !payload.existing) return;
        setView(payload);
        setAmountPaid((payload.paidCents / 100).toFixed(2));
        setBalanceDueDate(payload.balanceDueDate || '');
      })
      .catch(() => {
        if (!cancelled) setError('The payment record could not be loaded.');
      });
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  if (!view) return null;

  const save = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin/bookings/existing/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, amountPaid, balanceDueDate, paymentMethod, action: 'replace' }),
      });
      const payload = (await response.json()) as { error?: string; owedCents?: number; paymentLink?: string | null };
      if (!response.ok) {
        setError(payload.error || 'The payment record could not be saved.');
      } else {
        setMessage(
          payload.owedCents
            ? `Saved. Still owed ${dollars(payload.owedCents)}. No email was sent.`
            : 'Saved. Nothing is still owed. No email was sent.',
        );
        await load();
      }
    } catch {
      setError('The payment record could not be saved.');
    }
    setBusy(false);
  };

  const makeLink = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin/bookings/existing/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, action: 'link' }),
      });
      const payload = (await response.json()) as { error?: string; paymentLink?: string };
      if (!response.ok || !payload.paymentLink) {
        setError(payload.error || 'The payment link could not be created.');
      } else {
        setView({ ...view, paymentLink: payload.paymentLink });
        setMessage('Payment link ready. No email was sent.');
      }
    } catch {
      setError('The payment link could not be created.');
    }
    setBusy(false);
  };

  const copy = async () => {
    if (!view.paymentLink) return;
    try {
      await navigator.clipboard.writeText(view.paymentLink);
      setMessage('Payment link copied. No email was sent.');
    } catch {
      setError('The link could not be copied. Select it and copy it by hand.');
    }
  };

  return (
    <section className="mt-8 rounded-xl bg-white p-6 shadow">
      <h3 className="text-xl font-bold text-gray-900">Outside payment</h3>
      <p className="mt-1 text-sm text-gray-600">
        This wedding was added as an existing booking. Changing the amount already paid replaces that record. It does not email the client.
      </p>
      <p className="mt-3 text-sm text-gray-800">
        Total {dollars(view.totalCents)}. Recorded as paid {dollars(view.paidCents)}. Still owed {dollars(view.owedCents)}.
        {view.bookingCode ? ` Booking code ${view.bookingCode}.` : ''}
      </p>
      {view.paymentLink ? (
        <div className="mt-3">
          <p className="text-sm text-gray-700">Payment link</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <input readOnly className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm" value={view.paymentLink} />
            <button type="button" onClick={() => void copy()} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
              Copy
            </button>
          </div>
        </div>
      ) : view.owedCents > 0 ? (
        <button type="button" disabled={busy} onClick={() => void makeLink()} className="mt-3 rounded-lg border border-blue-700 px-4 py-2 text-sm text-blue-800 disabled:opacity-60">
          {busy ? 'Working...' : 'Create payment link'}
        </button>
      ) : null}
      {view.canReplace ? (
        <form
          className="mt-4 grid gap-3 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <label className="text-sm text-gray-700">
            Amount already paid ($)
            <input className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" inputMode="decimal" value={amountPaid} onChange={(event) => setAmountPaid(event.target.value)} />
          </label>
          <label className="text-sm text-gray-700">
            Balance due date
            <input type="date" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" value={balanceDueDate} onChange={(event) => setBalanceDueDate(event.target.value)} />
          </label>
          <label className="text-sm text-gray-700">
            Method for the amount already paid
            <select className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
              <option value="">Not recorded</option>
              {EXISTING_PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>{PAYMENT_METHOD_LABELS[method]}</option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button type="submit" disabled={busy} className="rounded-lg bg-blue-700 px-4 py-2 text-white disabled:bg-blue-400">
              {busy ? 'Saving...' : 'Save payment record'}
            </button>
          </div>
        </form>
      ) : view.blockedReason ? (
        <p className="mt-3 text-sm text-gray-700">{view.blockedReason}</p>
      ) : null}
      {message ? <p className="mt-3 text-sm text-green-800">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
