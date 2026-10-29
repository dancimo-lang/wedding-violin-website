'use client';

import { useSyncExternalStore } from 'react';
import { PaymentOptions } from '@/components/payments/PaymentOptions';

function usePayToken(): string | null {
  return useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener('popstate', onStoreChange);
      return () => window.removeEventListener('popstate', onStoreChange);
    },
    () => new URLSearchParams(window.location.search).get('t') ?? '',
    () => null,
  );
}

function useSearchParam(name: string): string {
  return useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener('popstate', onStoreChange);
      return () => window.removeEventListener('popstate', onStoreChange);
    },
    () => new URLSearchParams(window.location.search).get(name) ?? '',
    () => '',
  );
}

export function PayClient() {
  const token = usePayToken();
  const paid = useSearchParam('paid') === '1';
  const canceled = useSearchParam('canceled') === '1';
  const sessionId = useSearchParam('session_id');
  const returnHint = paid ? 'paid' : canceled ? 'canceled' : null;

  return (
    <section className="py-10">
      <div className="container mx-auto px-4">
        <article className="pay-sheet mx-auto max-w-3xl rounded-xl bg-white p-6 shadow md:p-10">
          <h1 className="text-3xl font-bold">Pay Daniel Cimo</h1>
          {token == null ? <p className="mt-6">Loading payment details...</p> : null}
          {token === '' ? <p className="mt-6">This payment link is missing.</p> : null}
          {token ? <PaymentOptions token={token} sessionId={sessionId} returnHint={returnHint} /> : null}
        </article>
      </div>
    </section>
  );
}
