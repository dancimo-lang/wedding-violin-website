import { createHmac, timingSafeEqual } from 'crypto';

export const ZELLE_SIGNATURE_HEADER = 'x-zelle-signature';
export const ZELLE_TIMESTAMP_HEADER = 'x-zelle-timestamp';
/** Reject alerts whose timestamp is more than five minutes from the server clock. */
export const ZELLE_MAX_SKEW_MS = 5 * 60 * 1000;

export function zelleSigningPayload(timestamp: string, rawBody: string): string {
  return `${timestamp}.${rawBody}`;
}

export function zelleSignatureHex(secret: string, timestamp: string, rawBody: string): string {
  return createHmac('sha256', secret).update(zelleSigningPayload(timestamp, rawBody), 'utf8').digest('hex');
}

function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a.toLowerCase());
  const right = Buffer.from(b.toLowerCase());
  if (left.length !== right.length) {
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}

export type ZelleAuthResult = { ok: true } | { ok: false; status: 401 | 503; error: string };

export function verifyZelleRequest(input: {
  secret: string | undefined;
  timestamp: string | null;
  signature: string | null;
  rawBody: string;
  nowMs: number;
  maxSkewMs?: number;
}): ZelleAuthResult {
  const secret = input.secret?.trim() ?? '';
  if (!secret) return { ok: false, status: 503, error: 'Zelle ingest is not configured.' };
  const timestamp = input.timestamp?.trim() ?? '';
  const signature = input.signature?.trim() ?? '';
  if (!/^[0-9]{10,16}$/.test(timestamp) || !/^[0-9a-f]{64}$/i.test(signature)) {
    return { ok: false, status: 401, error: 'The Zelle signature is not valid.' };
  }
  const sent = Number(timestamp);
  const skew = Math.abs(input.nowMs - sent);
  if (!Number.isFinite(sent) || skew > (input.maxSkewMs ?? ZELLE_MAX_SKEW_MS)) {
    return { ok: false, status: 401, error: 'The Zelle signature is not valid.' };
  }
  const expected = zelleSignatureHex(secret, timestamp, input.rawBody);
  if (!safeEqualHex(expected, signature)) {
    return { ok: false, status: 401, error: 'The Zelle signature is not valid.' };
  }
  return { ok: true };
}
