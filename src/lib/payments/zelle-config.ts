export const ZELLE_QR_PAGE_PATH = '/images/zelle-qr.png';
export const ZELLE_QR_EMAIL_URL = 'https://danielcimo.com/images/zelle-qr.png';
export const ZELLE_QR_ALT = 'Zelle QR code for Daniel Cimo';
export const ZELLE_QR_CAPTION = 'Scan with your bank app';

export type ZelleEnv = {
  ZELLE_RECIPIENT_DISPLAY?: string;
  ZELLE_RECIPIENT_CONTACT?: string;
  ZELLE_QR_URL?: string;
};

function readEnv(env?: ZelleEnv): ZelleEnv {
  if (env) return env;
  return {
    ZELLE_RECIPIENT_DISPLAY: process.env.ZELLE_RECIPIENT_DISPLAY,
    ZELLE_RECIPIENT_CONTACT: process.env.ZELLE_RECIPIENT_CONTACT,
    ZELLE_QR_URL: process.env.ZELLE_QR_URL,
  };
}

/** Name the couple sees. Defaults to Daniel Cimo. */
export function zelleRecipientName(env?: ZelleEnv): string {
  const value = readEnv(env).ZELLE_RECIPIENT_DISPLAY?.trim() ?? '';
  return value || 'Daniel Cimo';
}

/**
 * Phone or email the couple types into Zelle.
 * Unset uses the Chase Zelle phone. An explicit empty value hides it.
 */
export function zelleRecipientContact(env?: ZelleEnv): string {
  const source = readEnv(env);
  if (source.ZELLE_RECIPIENT_CONTACT == null) return '(224) 678-2799';
  return source.ZELLE_RECIPIENT_CONTACT.trim();
}

export function zelleInstructionLine(input: {
  recipientName: string;
  recipientContact: string;
  amountLabel: string;
  bookingCode: string;
}): string {
  const who = input.recipientContact
    ? `${input.recipientName} at ${input.recipientContact}`
    : input.recipientName;
  return `Send via Zelle to ${who} — amount ${input.amountLabel} — put ${input.bookingCode} in the memo.`;
}

export function resolveZelleQr(input: { fileExists: boolean; qrUrl?: string | null }): {
  pageUrl: string | null;
  emailUrl: string | null;
} {
  const override = input.qrUrl?.trim() ?? '';
  if (override) {
    return {
      pageUrl: override,
      emailUrl: override.startsWith('https://') ? override : null,
    };
  }
  if (!input.fileExists) return { pageUrl: null, emailUrl: null };
  return { pageUrl: ZELLE_QR_PAGE_PATH, emailUrl: ZELLE_QR_EMAIL_URL };
}

export function zelleQrFromEnv(fileExists: boolean, env?: ZelleEnv): { pageUrl: string | null; emailUrl: string | null } {
  return resolveZelleQr({ fileExists, qrUrl: readEnv(env).ZELLE_QR_URL });
}
