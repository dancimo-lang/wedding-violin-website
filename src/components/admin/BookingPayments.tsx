'use client';

import { useEffect, useState } from 'react';

type PaymentRow = {
  id: string;
  method: string;
  amountLabel: string;
  transactionNumber: string;
  paidOn: string;
  status: string;
  kind: string;
};

type OpenRow = {
  id: string;
  kind: string;
  amountLabel: string;
  bookingCode: string;
};

export function BookingPayments({ bookingId }: { bookingId: string }) {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [open, setOpen] = useState<OpenRow[]>([]);
  const [obligationId, setObligationId] = useState('');
  const [method, setMethod] = useState('zelle');
  const [transactionNumber, setTransactionNumber] = useState('');
  const [payerName, setPayerName] = useState('');
  const [paidOn, setPaidOn] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const response = await fetch(`/api/admin/payments?bookingId=${encodeURIComponent(bookingId)}`, { cache: 'no-store' });
    const payload = (await response.json()) as { payments?: PaymentRow[]; openObligations?: OpenRow[]; error?: string };
    if (!response.ok) {
      setError(payload.error || 'Payments could not be loaded.');
      return;
    }
    setPayments(payload.payments ?? []);
    const nextOpen = payload.openObligations ?? [];
    setOpen(nextOpen);
    setObligationId((current) => (nextOpen.some((row) => row.id === current) ? current : nextOpen[0]?.id || ''));
  };

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/payments?bookingId=${encodeURIComponent(bookingId)}`, { cache: 'no-store' })
      .then(async (response) => {
        const payload = (await response.json()) as { payments?: PaymentRow[]; openObligations?: OpenRow[]; error?: string };
        if (cancelled) return;
        if (!response.ok) {
          setError(payload.error || 'Payments could not be loaded.');
          return;
        }
        setPayments(payload.payments ?? []);
        const nextOpen = payload.openObligations ?? [];
        setOpen(nextOpen);
        setObligationId(nextOpen[0]?.id || '');
      })
      .catch(() => {
        if (!cancelled) setError('Payments could not be loaded.');
      });
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  const record = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin/payments/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, obligationId, method, transactionNumber, payerName, paidOn }),
      });
      const payload = (await response.json()) as { error?: string; emailSent?: boolean; duplicate?: boolean };
      if (!response.ok) {
        setError(payload.error || 'The payment could not be recorded.');
      } else if (payload.duplicate) {
        setMessage('That transaction number is already recorded.');
      } else {
        setMessage(payload.emailSent ? 'Payment recorded and the email was sent.' : 'Payment recorded.');
        setTransactionNumber('');
        await load();
      }
    } catch {
      setError('The payment could not be recorded.');
    }
    setBusy(false);
  };

  return (
    <section className="mt-8 rounded-xl bg-white p-6 shadow">
      <h3 className="text-xl font-bold text-gray-900">Payments</h3>
      {payments.length === 0 ? <p className="mt-3 text-sm text-gray-600">No payments recorded yet.</p> : null}
      {payments.length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-600">
                <th className="py-2 pr-4">Method</th>
                <th className="py-2 pr-4">Amount</th>
                <th className="py-2 pr-4">Transaction</th>
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2">Kind</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((row) => (
                <tr key={row.id} className="border-b border-gray-100">
                  <td className="py-2 pr-4">{row.method}</td>
                  <td className="py-2 pr-4">{row.amountLabel}</td>
                  <td className="py-2 pr-4">{row.transactionNumber || '—'}</td>
                  <td className="py-2 pr-4">{row.paidOn}</td>
                  <td className="py-2 pr-4">{row.status}</td>
                  <td className="py-2">{row.kind}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <h4 className="mt-6 font-semibold text-gray-900">Record a payment</h4>
      {open.length === 0 ? <p className="mt-2 text-sm text-gray-600">Nothing is open on this booking.</p> : null}
      {open.length > 0 ? (
        <form
          className="mt-3 grid gap-3 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            void record();
          }}
        >
          <label className="text-sm text-gray-700">
            Open payment
            <select className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" value={obligationId} onChange={(event) => setObligationId(event.target.value)}>
              {open.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.kind} {row.amountLabel} ({row.bookingCode})
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-gray-700">
            Method
            <select className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" value={method} onChange={(event) => setMethod(event.target.value)}>
              <option value="zelle">Zelle</option>
              <option value="stripe_ach">Bank account</option>
              <option value="stripe_card">Card</option>
              <option value="manual">Other</option>
            </select>
          </label>
          <label className="text-sm text-gray-700">
            Transaction number
            <input className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" value={transactionNumber} onChange={(event) => setTransactionNumber(event.target.value)} />
          </label>
          <label className="text-sm text-gray-700">
            Payer name
            <input className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" value={payerName} onChange={(event) => setPayerName(event.target.value)} />
          </label>
          <label className="text-sm text-gray-700">
            Date paid
            <input type="date" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" value={paidOn} onChange={(event) => setPaidOn(event.target.value)} />
          </label>
          <div className="flex items-end">
            <button type="submit" disabled={busy} className="rounded-lg bg-blue-700 px-4 py-2 text-white disabled:bg-blue-400">
              {busy ? 'Saving...' : 'Record payment'}
            </button>
          </div>
        </form>
      ) : null}
      {message ? <p className="mt-3 text-sm text-green-800">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
