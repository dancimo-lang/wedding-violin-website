import { createHash, randomBytes, timingSafeEqual } from 'crypto';

/** 32 random bytes, base64url, no padding. 256 bits, so the signing link is not guessable. */
export function generateContractToken(bytes: Buffer = randomBytes(32)): string {
  return bytes.toString('base64url');
}

export function isContractToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

export function tokensMatch(stored: string, presented: string): boolean {
  if (!isContractToken(stored) || !isContractToken(presented)) return false;
  const left = Buffer.from(stored);
  const right = Buffer.from(presented);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function hashContractText(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}
