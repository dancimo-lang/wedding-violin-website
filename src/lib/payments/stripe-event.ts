export type CheckoutSessionStatus = 'missing' | 'open' | 'processing' | 'paid' | 'failed';

export type StripeEventPlan =
  | { action: 'duplicate' }
  | { action: 'paid' }
  | { action: 'processing' }
  | { action: 'failed' }
  | { action: 'ignore' };

/**
 * ACH stays unpaid on checkout.session.completed and settles later.
 * The booking confirmation is sent only on the paid action.
 * A repeated event id, or a success for a session already paid, does nothing.
 */
export function planStripeEvent(input: {
  eventId: string;
  type: string;
  paymentStatus: string | null;
  seenEventIds: readonly string[];
  sessionStatus: CheckoutSessionStatus;
}): StripeEventPlan {
  if (!input.eventId || input.seenEventIds.includes(input.eventId)) return { action: 'duplicate' };
  if (input.type === 'checkout.session.completed') {
    if (input.paymentStatus === 'paid') {
      return input.sessionStatus === 'paid' ? { action: 'ignore' } : { action: 'paid' };
    }
    if (input.paymentStatus === 'unpaid') {
      if (input.sessionStatus === 'processing' || input.sessionStatus === 'paid') return { action: 'ignore' };
      return { action: 'processing' };
    }
    return { action: 'ignore' };
  }
  if (input.type === 'checkout.session.async_payment_succeeded') {
    return input.sessionStatus === 'paid' ? { action: 'ignore' } : { action: 'paid' };
  }
  if (input.type === 'checkout.session.async_payment_failed') {
    if (input.sessionStatus === 'paid' || input.sessionStatus === 'failed') return { action: 'ignore' };
    return { action: 'failed' };
  }
  return { action: 'ignore' };
}

export function verifyStripeSignatureHeader(input: {
  rawBody: string;
  header: string | null;
  secret: string;
  nowSec: number;
  toleranceSec?: number;
  digestHex: (signed: string) => string;
  equalHex: (a: string, b: string) => boolean;
}): { ok: true; timestamp: number } | { ok: false } {
  const header = input.header?.trim() ?? '';
  if (!header || !input.secret) return { ok: false };
  const parts = new Map<string, string[]>();
  for (const piece of header.split(',')) {
    const [key, value] = piece.split('=', 2);
    if (!key || !value) continue;
    const list = parts.get(key) ?? [];
    list.push(value);
    parts.set(key, list);
  }
  const timestamp = Number(parts.get('t')?.[0] ?? '');
  const signatures = parts.get('v1') ?? [];
  if (!Number.isFinite(timestamp) || signatures.length === 0) return { ok: false };
  const tolerance = input.toleranceSec ?? 300;
  if (Math.abs(input.nowSec - timestamp) > tolerance) return { ok: false };
  const expected = input.digestHex(`${timestamp}.${input.rawBody}`);
  if (!signatures.some((signature) => input.equalHex(expected, signature))) return { ok: false };
  return { ok: true, timestamp };
}
