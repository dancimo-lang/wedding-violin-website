import type { ObligationKind } from './match';

export const PROCESSING_NOTICE =
  "We received your bank payment. Banks take a few business days to clear it; we'll email you when it does.";
export const FAILED_NOTICE =
  "Your bank payment didn't go through. Nothing was charged. You can try again below or pay by Zelle.";
export const CANCELED_NOTICE = 'Payment not completed.';
export const CONFIRMING_NOTICE = 'Confirming your payment…';
export const CONFIRM_TIMEOUT_NOTICE = "We're still confirming your payment. Refresh this page in a moment.";

export const CONFIRM_POLL_MS = 2000;
export const CONFIRM_TIMEOUT_MS = 20000;

export type CheckoutSessionStatus = 'open' | 'processing' | 'paid' | 'failed';

export type CheckoutSessionRef = {
  id: string;
  obligationId: string;
  status: CheckoutSessionStatus;
  updatedAt: string;
};

export type CheckoutBanner = {
  tone: 'success' | 'pending' | 'failed' | 'neutral' | 'waiting';
  message: string;
  pendingConfirmation: boolean;
};

const STATUSES = new Set<CheckoutSessionStatus>(['open', 'processing', 'paid', 'failed']);

export function checkoutSessionId(value: string | null | undefined): string | null {
  const id = value?.trim() ?? '';
  if (!/^cs_[A-Za-z0-9_]{8,}$/.test(id) || id.length > 255) return null;
  return id;
}

export function checkoutReturnUrls(payUrl: string): { successUrl: string; cancelUrl: string } {
  return {
    successUrl: `${payUrl}&paid=1&session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${payUrl}&canceled=1&session_id={CHECKOUT_SESSION_ID}`,
  };
}

function paidMessage(kind: ObligationKind): string {
  return kind === 'balance' ? 'Your balance is paid. Thank you!' : 'Your retainer is paid. Thank you!';
}

function kindFor(
  obligations: readonly { id: string; kind: ObligationKind }[],
  obligationId: string,
): ObligationKind {
  return obligations.find((row) => row.id === obligationId)?.kind === 'balance' ? 'balance' : 'retainer';
}

function bannerForStatus(status: CheckoutSessionStatus, kind: ObligationKind): CheckoutBanner | null {
  if (status === 'paid') return { tone: 'success', message: paidMessage(kind), pendingConfirmation: false };
  if (status === 'processing') return { tone: 'pending', message: PROCESSING_NOTICE, pendingConfirmation: false };
  if (status === 'failed') return { tone: 'failed', message: FAILED_NOTICE, pendingConfirmation: false };
  return null;
}

/**
 * The banner comes from the stored Checkout session and any Processing payment.
 * paid=1 / canceled=1 only choose which open session to watch. A stored
 * paid, processing, or failed result wins over those query flags.
 */
export function checkoutBanner(input: {
  obligations: readonly { id: string; kind: ObligationKind; status: 'open' | 'paid' | 'void' }[];
  sessions: readonly CheckoutSessionRef[];
  processingObligationIds?: readonly string[];
  sessionId?: string | null;
  hint?: 'paid' | 'canceled' | null;
}): { checkout: CheckoutBanner | null; blockPay: boolean } {
  const obligations = input.obligations.filter((row) => row.status === 'open' || row.status === 'paid');
  const openIds = new Set(obligations.filter((row) => row.status === 'open').map((row) => row.id));
  const dueId =
    obligations.find((row) => row.status === 'open' && row.kind === 'retainer')?.id ??
    obligations.find((row) => row.status === 'open' && row.kind === 'balance')?.id ??
    null;
  const known = input.sessions.filter(
    (session) => STATUSES.has(session.status) && obligations.some((row) => row.id === session.obligationId),
  );
  const latest = [...known].sort((left, right) => {
    if (left.updatedAt !== right.updatedAt) return left.updatedAt < right.updatedAt ? 1 : -1;
    return right.id.localeCompare(left.id);
  })[0] ?? null;
  const requested = input.sessionId ? known.find((session) => session.id === input.sessionId) ?? null : null;
  const target = requested ?? latest;
  const processing = new Set((input.processingObligationIds ?? []).filter((id) => openIds.has(id)));
  for (const session of known) {
    if (session.status === 'processing' && openIds.has(session.obligationId)) processing.add(session.obligationId);
  }

  let checkout: CheckoutBanner | null = null;
  const hint = input.hint ?? null;
  if (hint === 'paid' || hint === 'canceled') {
    if (target && target.status !== 'open') {
      checkout = bannerForStatus(target.status, kindFor(obligations, target.obligationId));
    } else if (hint === 'canceled') {
      checkout = { tone: 'neutral', message: CANCELED_NOTICE, pendingConfirmation: false };
    } else {
      checkout = { tone: 'waiting', message: CONFIRMING_NOTICE, pendingConfirmation: true };
    }
  } else if (processing.size > 0) {
    checkout = { tone: 'pending', message: PROCESSING_NOTICE, pendingConfirmation: false };
  } else if (latest?.status === 'failed' && openIds.has(latest.obligationId)) {
    checkout = bannerForStatus('failed', kindFor(obligations, latest.obligationId));
  } else if (latest?.status === 'paid') {
    checkout = bannerForStatus('paid', kindFor(obligations, latest.obligationId));
  }

  let blockPay = false;
  if (dueId) {
    if (processing.has(dueId)) blockPay = true;
    if (known.some((session) => session.obligationId === dueId && (session.status === 'paid' || session.status === 'processing'))) {
      blockPay = true;
    }
    if (checkout?.pendingConfirmation && (target == null || target.obligationId === dueId)) blockPay = true;
  }
  return { checkout, blockPay };
}
