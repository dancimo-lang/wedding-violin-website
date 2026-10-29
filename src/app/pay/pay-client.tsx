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

function useFlag(name: string): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener('popstate', onStoreChange);
      return () => window.removeEventListener('popstate', onStoreChange);
    },
    () => new URLSearchParams(window.location.search).get(name) === '1',
    () => false,
  );
}

export function PayClient() {
  const token = usePayToken();
  const paid = useFlag('paid');
  const canceled = useFlag('canceled');
  const notice = paid
    ? 'If you paid by card, a receipt email follows shortly. A bank payment can take a few business days, and the receipt is sent when it clears.'
    : canceled
      ? 'The card or bank payment was canceled. You can pay by Zelle, or try again.'
      : undefined;

  return (
    <section className="py-10">
      <div className="container mx-auto px-4">
        <article className="pay-sheet mx-auto max-w-3xl rounded-xl bg-white p-6 shadow md:p-10">
          <h1 className="text-3xl font-bold">Pay Daniel Cimo</h1>
          {token == null ? <p className="mt-6">Loading payment details...</p> : null}
          {token === '' ? <p className="mt-6">This payment link is missing.</p> : null}
          {token ? <PaymentOptions token={token} notice={notice} /> : null}
        </article>
      </div>
    </section>
  );
}
