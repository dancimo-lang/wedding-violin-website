import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

export type EncryptedToken = {
  ciphertext: string;
  iv: string;
  tag: string;
};

export function encryptionKey(secret: string): Buffer {
  const trimmed = secret.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) return Buffer.from(trimmed, 'hex');
  const decoded = Buffer.from(trimmed, 'base64');
  if (decoded.length === 32 && !trimmed.includes(' ')) return decoded;
  return createHash('sha256').update(trimmed, 'utf8').digest();
}

export function encryptToken(plaintext: string, secret: string): EncryptedToken {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  };
}

export function decryptToken(encrypted: EncryptedToken, secret: string): string {
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(secret), Buffer.from(encrypted.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(encrypted.tag, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertext, 'base64')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}
