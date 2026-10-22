import { createHmac, timingSafeEqual } from 'crypto';
import { verifyStripeSignatureHeader } from './stripe-event';

function equalHex(a: string, b: string): boolean {
  const left = Buffer.from(a.toLowerCase());
  const right = Buffer.from(b.toLowerCase());
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function verifyStripeWebhook(
  rawBody: string,
  header: string | null,
  secret: string | undefined,
  nowSec = Math.floor(Date.now() / 1000),
): { ok: true } | { ok: false; status: 401 | 503; error: string } {
  const trimmed = secret?.trim() ?? '';
  if (!trimmed) return { ok: false, status: 503, error: 'Stripe webhooks are not configured.' };
  const result = verifyStripeSignatureHeader({
    rawBody,
    header,
    secret: trimmed,
    nowSec,
    digestHex: (signed) => createHmac('sha256', trimmed).update(signed, 'utf8').digest('hex'),
    equalHex,
  });
  if (!result.ok) return { ok: false, status: 401, error: 'The Stripe signature is not valid.' };
  return { ok: true };
}
