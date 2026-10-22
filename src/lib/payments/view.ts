import { formatLongDate, formatMoney } from '@/lib/contracts/money';
import { processingFeeCents, type FeeSettings } from './fees';
import type { ObligationKind, ObligationRef } from './match';
import { ZELLE_QR_ALT, ZELLE_QR_CAPTION, zelleInstructionLine } from './zelle-config';

export type PublicObligation = {
  id: string;
  kind: ObligationKind;
  amountCents: number;
  amountLabel: string;
  dueLabel: string;
};

export type PublicPaymentView = {
  bookingCode: string;
  recipientName: string;
  recipientContact: string;
  instruction: string;
  qrUrl: string | null;
  qrAlt: string;
  qrCaption: string;
  stripeReady: boolean;
  due: PublicObligation | null;
  balanceNote: string | null;
  cardFeeLabel: string | null;
  cardTotalLabel: string | null;
  achFeeLabel: string | null;
  achTotalLabel: string | null;
  achButton: string | null;
  cardButton: string | null;
  paid: { kind: ObligationKind; amountLabel: string }[];
  paidInFull: boolean;
};

function label(cents: number): string {
  return `$${formatMoney(cents)}`;
}

function feeLabels(amountCents: number, settings: FeeSettings, stripeReady: boolean): Pick<
  PublicPaymentView,
  'cardFeeLabel' | 'cardTotalLabel' | 'achFeeLabel' | 'achTotalLabel' | 'achButton' | 'cardButton'
> {
  if (!stripeReady) {
    return {
      cardFeeLabel: null,
      cardTotalLabel: null,
      achFeeLabel: null,
      achTotalLabel: null,
      achButton: null,
      cardButton: null,
    };
  }
  const cardFee = processingFeeCents(amountCents, settings.card);
  const achFee = processingFeeCents(amountCents, settings.ach);
  const cardTotal = amountCents + cardFee;
  const achTotal = amountCents + achFee;
  return {
    cardFeeLabel: cardFee > 0 ? label(cardFee) : null,
    cardTotalLabel: label(cardTotal),
    achFeeLabel: achFee > 0 ? label(achFee) : null,
    achTotalLabel: label(achTotal),
    achButton: `Pay ${label(achTotal)} by bank account`,
    cardButton: `Pay ${label(cardTotal)} by card`,
  };
}

export function buildPaymentView(input: {
  bookingCode: string;
  obligations: readonly ObligationRef[];
  recipientName: string;
  recipientContact: string;
  qrUrl: string | null;
  stripeReady: boolean;
  fees: FeeSettings;
}): PublicPaymentView {
  const open = input.obligations.filter((row) => row.status === 'open');
  const retainer = open.find((row) => row.kind === 'retainer') ?? null;
  const balance = open.find((row) => row.kind === 'balance') ?? null;
  const due = retainer ?? balance;
  const paid = input.obligations
    .filter((row) => row.status === 'paid')
    .map((row) => ({ kind: row.kind, amountLabel: label(row.amountCents) }));
  const instruction = due
    ? zelleInstructionLine({
        recipientName: input.recipientName,
        recipientContact: input.recipientContact,
        amountLabel: label(due.amountCents),
        bookingCode: input.bookingCode,
      })
    : '';
  const balanceNote =
    retainer && balance
      ? `The remaining balance of ${label(balance.amountCents)} is due ${balance.dueOn ? formatLongDate(balance.dueOn) : 'later'}.`
      : null;
  const fees = due ? feeLabels(due.amountCents, input.fees, input.stripeReady) : feeLabels(0, input.fees, false);
  return {
    bookingCode: input.bookingCode,
    recipientName: input.recipientName,
    recipientContact: input.recipientContact,
    instruction,
    qrUrl: input.qrUrl,
    qrAlt: ZELLE_QR_ALT,
    qrCaption: ZELLE_QR_CAPTION,
    stripeReady: input.stripeReady && Boolean(due),
    due: due
      ? {
          id: due.id,
          kind: due.kind,
          amountCents: due.amountCents,
          amountLabel: label(due.amountCents),
          dueLabel: due.dueOn ? formatLongDate(due.dueOn) : '',
        }
      : null,
    balanceNote,
    ...fees,
    paid,
    paidInFull: input.obligations.length > 0 && open.length === 0,
  };
}
