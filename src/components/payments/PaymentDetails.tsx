'use client';

import Image from 'next/image';
import { useState } from 'react';

export type PaymentView = {
  bookingCode: string;
  instruction: string;
  qrUrl: string | null;
  qrAlt: string;
  qrCaption: string;
  stripeReady: boolean;
  due: {
    id: string;
    kind: 'retainer' | 'balance';
    amountLabel: string;
    dueLabel: string;
  } | null;
  balanceNote: string | null;
  cardFeeLabel: string | null;
  achFeeLabel: string | null;
  achButton: string | null;
  cardButton: string | null;
  paid: { kind: 'retainer' | 'balance'; amountLabel: string }[];
  paidInFull: boolean;
  checkout: {
    tone: 'success' | 'pending' | 'failed' | 'neutral' | 'waiting';
    message: string;
    pendingConfirmation: boolean;
  } | null;
  blockPay: boolean;
};

const KIND_LABEL = { retainer: 'Retainer', balance: 'Balance' } as const;

const BANNER_BACKGROUND = {
  success: 'bg-green-50',
  pending: 'bg-blue-50',
  waiting: 'bg-blue-50',
  failed: 'bg-red-50',
  neutral: 'bg-gray-100',
} as const;

export function PaymentDetails({
  view,
  notice,
  onCheckout,
}: {
  view: PaymentView;
  notice?: string;
  onCheckout?: (obligationId: string, method: 'ach' | 'card') => Promise<string | null>;
}) {
  const [busy, setBusy] = useState<'ach' | 'card' | null>(null);
  const [error, setError] = useState('');

  const pay = async (method: 'ach' | 'card') => {
    if (!view.due || !onCheckout) return;
    setBusy(method);
    setError('');
    try {
      const url = await onCheckout(view.due.id, method);
      if (url) window.location.assign(url);
      else setError('The payment page could not be opened. You can still pay by Zelle.');
    } catch {
      setError('The payment page could not be opened. You can still pay by Zelle.');
    }
    setBusy(null);
  };

  const showPayActions = !view.blockPay;

  return (
    <section className="mt-8 rounded-lg border border-gray-200 p-4">
      {view.checkout ? (
        <p
          className={`rounded-lg px-4 py-3 text-sm ${BANNER_BACKGROUND[view.checkout.tone]}`}
          role={view.checkout.tone === 'failed' ? 'alert' : 'status'}
          aria-live="polite"
        >
          {view.checkout.message}
        </p>
      ) : null}
      <h2 className={view.checkout ? 'mt-4 text-xl font-bold' : 'text-xl font-bold'}>
        {view.due ? `Pay your ${view.due.kind}` : 'Payments'}
      </h2>
      {notice ? <p className="mt-3 rounded-lg bg-blue-50 px-4 py-3 text-sm">{notice}</p> : null}
      {view.paidInFull ? <p className="mt-3">This agreement is paid in full.</p> : null}
      {view.paid.length > 0 ? (
        <ul className="mt-3 list-disc pl-5 text-sm">
          {view.paid.map((row) => (
            <li key={row.kind}>
              {KIND_LABEL[row.kind]} paid: {row.amountLabel}
            </li>
          ))}
        </ul>
      ) : null}
      {view.due ? (
        <div className="mt-4 md:flex md:items-start md:gap-6">
          <div className="max-w-xl">
            <p>
              {KIND_LABEL[view.due.kind]} due: {view.due.amountLabel}
              {view.due.dueLabel ? ` (${view.due.dueLabel})` : ''}
            </p>
            <p className="mt-2">Booking code: {view.bookingCode}</p>
            {showPayActions ? <p className="mt-3">{view.instruction}</p> : null}
            {view.balanceNote ? <p className="mt-3">{view.balanceNote}</p> : null}
            {showPayActions && view.stripeReady && view.achButton ? (
              <div className="mt-4 space-y-3">
                <button
                  type="button"
                  className="rounded-lg bg-blue-700 px-4 py-2 text-white disabled:bg-blue-400"
                  disabled={busy !== null}
                  onClick={() => void pay('ach')}
                >
                  {busy === 'ach' ? 'Opening bank payment...' : view.achButton}
                </button>
                {view.achFeeLabel ? (
                  <p className="text-sm text-gray-600">Includes a {view.achFeeLabel} bank processing fee.</p>
                ) : (
                  <p className="text-sm text-gray-600">Bank account is the usual choice. It can take a few business days to clear.</p>
                )}
                {view.cardButton ? (
                  <button
                    type="button"
                    className="pay-card-button block rounded-lg border border-gray-300 bg-white px-4 py-2"
                    disabled={busy !== null}
                    onClick={() => void pay('card')}
                  >
                    {busy === 'card' ? 'Opening card payment...' : view.cardButton}
                  </button>
                ) : null}
                {view.cardFeeLabel ? (
                  <p className="text-sm text-gray-600">The card total includes a separate {view.cardFeeLabel} processing fee.</p>
                ) : null}
              </div>
            ) : null}
            {error ? (
              <p className="mt-3 text-sm text-red-700" role="alert">
                {error}
              </p>
            ) : null}
          </div>
          {showPayActions && view.qrUrl ? (
            <figure className="mt-4 md:mt-0">
              {view.qrUrl.startsWith('/') ? (
                <Image src={view.qrUrl} alt={view.qrAlt} width={220} height={235} />
              ) : (
                // External QR addresses are optional and are not in the image allowlist.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={view.qrUrl} alt={view.qrAlt} width={220} height={235} className="h-auto w-[220px]" />
              )}
              <figcaption className="mt-2 text-sm text-gray-600">{view.qrCaption}</figcaption>
            </figure>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
