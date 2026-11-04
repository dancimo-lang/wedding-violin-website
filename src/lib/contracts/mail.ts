import site from '@/data/site.json';

type MailEnv = {
  CONTRACT_FROM_EMAIL?: string;
  RESEND_FROM?: string;
  RESEND_FROM_EMAIL?: string;
  CONTRACT_REPLY_TO?: string;
  CONTACT_EMAIL?: string;
};

function mailEnv(env?: MailEnv): MailEnv {
  if (env) return env;
  return {
    CONTRACT_FROM_EMAIL: process.env.CONTRACT_FROM_EMAIL,
    RESEND_FROM: process.env.RESEND_FROM,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
    CONTRACT_REPLY_TO: process.env.CONTRACT_REPLY_TO,
    CONTACT_EMAIL: process.env.CONTACT_EMAIL,
  };
}

/** Sender for contract mail. CONTRACT_FROM_EMAIL, then RESEND_FROM, then the existing Resend sender. */
export function contractFromAddress(env?: MailEnv): string | null {
  const source = mailEnv(env);
  const from = source.CONTRACT_FROM_EMAIL || source.RESEND_FROM || source.RESEND_FROM_EMAIL || '';
  const trimmed = from.trim();
  return trimmed || null;
}

/** Reply-to for contract mail. Defaults to the public contact address. */
export function contractReplyTo(env?: MailEnv): string {
  const reply = (mailEnv(env).CONTRACT_REPLY_TO || site.email).trim();
  return reply || site.email;
}

export function contractOwnerEmail(env?: MailEnv): string {
  const owner = (mailEnv(env).CONTACT_EMAIL || 'dancimo@gmail.com').trim();
  return owner || 'dancimo@gmail.com';
}

const TEST_SITE_SUBJECT_MARKER = '[TEST SITE]';

export type ClientMailInput = {
  to: string | string[];
  subject: string;
  html: string;
};

export type ClientMailDelivery = ClientMailInput & {
  redirected: boolean;
};

/**
 * Production is only VERCEL_ENV === 'production'. Preview, local dev, and a
 * missing or unexpected value are non-production. NODE_ENV is not used:
 * Vercel sets it to production on preview builds too.
 */
export function isProductionEmailEnvironment(env?: { VERCEL_ENV?: string }): boolean {
  const vercelEnv = env ? env.VERCEL_ENV : process.env.VERCEL_ENV;
  return vercelEnv?.trim() === 'production';
}

function escapeMailHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function recipientList(to: string | string[]): string[] {
  return (Array.isArray(to) ? to : [to]).map((value) => value.replace(/[\r\n]/g, '').trim()).filter(Boolean);
}

function mailbox(value: string): string {
  const trimmed = value.trim().replace(/[\r\n]/g, '');
  const wrapped = trimmed.match(/<([^<>]+)>/);
  return (wrapped ? wrapped[1] : trimmed).trim().toLowerCase();
}

/**
 * Leave production mail, and mail that is already only to the owner, unchanged.
 * On any other deployment, send client-facing mail to the owner instead, with
 * a [TEST SITE] subject and the address that would have received it.
 */
export function guardClientFacingEmail(
  input: ClientMailInput,
  options?: { vercelEnv?: string; ownerEmail?: string },
): ClientMailDelivery {
  const vercelEnv = options && 'vercelEnv' in options ? options.vercelEnv : process.env.VERCEL_ENV;
  if (vercelEnv?.trim() === 'production') {
    return { to: input.to, subject: input.subject, html: input.html, redirected: false };
  }
  const owner = (options && 'ownerEmail' in options ? options.ownerEmail || '' : contractOwnerEmail()).trim() || contractOwnerEmail();
  const recipients = recipientList(input.to);
  const ownerMailbox = mailbox(owner);
  const onlyOwner = recipients.length > 0 && recipients.every((address) => mailbox(address) === ownerMailbox);
  if (onlyOwner) {
    return { to: input.to, subject: input.subject, html: input.html, redirected: false };
  }
  const shown = recipients.length > 0 ? recipients.join(', ') : '(no address)';
  const note = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto 16px; background: #fef3c7; border: 1px solid #f59e0b; padding: 12px; border-radius: 8px;"><p style="margin: 0;"><strong>Test site.</strong> This message was not sent to the client. Original recipient: ${escapeMailHtml(shown)}.</p></div>`;
  const subject = input.subject.startsWith(TEST_SITE_SUBJECT_MARKER)
    ? input.subject
    : `${TEST_SITE_SUBJECT_MARKER} ${input.subject}`;
  return { to: owner, subject, html: `${note}${input.html}`, redirected: true };
}

export function clientMailWasRedirected(to: string | string[]): boolean {
  return guardClientFacingEmail({ to, subject: '', html: '' }).redirected;
}

/** Activity text for a client send. Production keeps the original line. */
export function clientFacingActivityBody(email: string, sentLine: string): string {
  if (!clientMailWasRedirected(email)) return sentLine;
  return `Test site: sent to you instead of ${email}.`;
}
