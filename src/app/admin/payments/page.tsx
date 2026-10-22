'use client';

import { useEffect, useState } from 'react';

type Candidate = { id: string; bookingCode: string; kind: string; amountLabel: string };
type Receipt = {
  id: string;
  senderName: string;
  amountLabel: string;
  sentOn: string | null;
  memo: string;
  code: string | null;
  transactionNumber: string;
  candidates: Candidate[];
};

export default function UnmatchedPaymentsPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState('');

  const applyPayload = (payload: { receipts?: Receipt[]; error?: string }, ok: boolean) => {
    if (!ok) {
      setError(payload.error || 'Unmatched Zelle payments could not be loaded.');
      return;
    }
    setReceipts(payload.receipts ?? []);
  };

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/payments?queue=unmatched', { cache: 'no-store' })
      .then(async (response) => {
        const payload = (await response.json()) as { receipts?: Receipt[]; error?: string };
        if (!cancelled) applyPayload(payload, response.ok);
      })
      .catch(() => {
        if (!cancelled) setError('Unmatched Zelle payments could not be loaded.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const assign = async (receiptId: string, obligationId: string) => {
    setBusyId(receiptId);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin/payments/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiptId, obligationId }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) setError(payload.error || 'That payment could not be assigned.');
      else {
        setMessage('Assigned. The couple is emailed when mail is configured.');
        const refreshed = await fetch('/api/admin/payments?queue=unmatched', { cache: 'no-store' });
        applyPayload((await refreshed.json()) as { receipts?: Receipt[]; error?: string }, refreshed.ok);
      }
    } catch {
      setError('That payment could not be assigned.');
    }
    setBusyId('');
  };

  return (
    <div>
      <h2 className="mb-2 text-3xl font-bold text-gray-900">Zelle payments</h2>
      <p className="mb-6 max-w-2xl text-sm text-gray-600">
        Payments with a booking code that did not match an open retainer or balance. Lesson payments with no code are stored and are not listed here.
      </p>
      {message ? <p className="mb-4 text-sm text-green-800">{message}</p> : null}
      {error ? <p className="mb-4 text-sm text-red-700">{error}</p> : null}
      {receipts.length === 0 ? <p className="text-gray-600">No unmatched Zelle payments.</p> : null}
      <div className="space-y-4">
        {receipts.map((row) => (
          <article key={row.id} className="rounded-xl bg-white p-5 shadow">
            <p className="font-semibold text-gray-900">
              {row.amountLabel} from {row.senderName || 'Unknown'}
            </p>
            <p className="mt-1 text-sm text-gray-700">Transaction {row.transactionNumber}</p>
            <p className="text-sm text-gray-700">Sent {row.sentOn || 'on an unknown date'}</p>
            <p className="text-sm text-gray-700">Memo: {row.memo || 'None'}</p>
            <p className="text-sm text-gray-700">Code: {row.code || 'None'}</p>
            {row.candidates.length === 0 ? <p className="mt-3 text-sm text-gray-600">No open payment is this exact amount.</p> : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {row.candidates.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  disabled={busyId === row.id}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  onClick={() => void assign(row.id, candidate.id)}
                >
                  Assign to {candidate.bookingCode} {candidate.kind}
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
