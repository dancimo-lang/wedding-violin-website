'use client';

import { useEffect, useState } from 'react';
import { PaymentDetails, type PaymentView } from './PaymentDetails';

export function PaymentOptions({ token, notice }: { token: string; notice?: string }) {
  const [view, setView] = useState<PaymentView | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const response = await fetch(`/api/payments/view?t=${encodeURIComponent(token)}`, { cache: 'no-store' });
      const payload = (await response.json()) as PaymentView & { error?: string };
      if (cancelled) return;
      if (!response.ok) {
        setError(payload.error || 'Payments could not be loaded.');
        setView(null);
        return;
      }
      setView(payload);
    }
    load().catch(() => {
      if (!cancelled) setError('Payments could not be loaded.');
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (error) return <p className="mt-6 text-sm">{error}</p>;
  if (!view) return <p className="mt-6 text-sm">Loading payment details...</p>;

  return (
    <PaymentDetails
      view={view}
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
