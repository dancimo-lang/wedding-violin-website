'use client';

import { useEffect, useState } from 'react';
import { CONFIRM_POLL_MS, CONFIRM_TIMEOUT_MS, CONFIRM_TIMEOUT_NOTICE } from '@/lib/payments/checkout-notice';
import { PaymentDetails, type PaymentView } from './PaymentDetails';

export function PaymentOptions({
  token,
  notice,
  sessionId,
  returnHint,
}: {
  token: string;
  notice?: string;
  sessionId?: string;
  returnHint?: 'paid' | 'canceled' | null;
}) {
  const [view, setView] = useState<PaymentView | null>(null);
  const [error, setError] = useState('');
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const started = Date.now();

    async function load() {
      setTimedOut(false);
      const params = new URLSearchParams({ t: token });
      if (sessionId) params.set('session_id', sessionId);
      if (returnHint) params.set('return', returnHint);
      try {
        const response = await fetch(`/api/payments/view?${params}`, { cache: 'no-store' });
        const payload = (await response.json()) as PaymentView & { error?: string };
        if (cancelled) return;
        if (!response.ok) {
          setError(payload.error || 'Payments could not be loaded.');
          setView(null);
          return;
        }
        setError('');
        setView(payload);
        const waiting = Boolean(payload.checkout?.pendingConfirmation);
        if (waiting && Date.now() - started < CONFIRM_TIMEOUT_MS) {
          timer = setTimeout(() => {
            void load();
          }, CONFIRM_POLL_MS);
        } else {
          setTimedOut(waiting);
        }
      } catch {
        if (!cancelled) setError('Payments could not be loaded.');
      }
    }

    void load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [token, sessionId, returnHint]);

  if (error) return <p className="mt-6 text-sm">{error}</p>;
  if (!view) return <p className="mt-6 text-sm">Loading payment details...</p>;

  const shown =
    timedOut && view.checkout?.pendingConfirmation
      ? {
          ...view,
          checkout: { ...view.checkout, message: CONFIRM_TIMEOUT_NOTICE, pendingConfirmation: false },
        }
      : view;

  return (
    <PaymentDetails
      view={shown}
      notice={notice}
      onCheckout={async (obligationId, method) => {
        const response = await fetch('/api/payments/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, obligationId, method }),
        });
        const payload = (await response.json()) as { url?: string; error?: string };
        if (!response.ok || !payload.url) throw new Error(payload.error || 'checkout');
        return payload.url;
      }}
    />
  );
}
