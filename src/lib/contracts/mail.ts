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

/** Reply-to for contract mail. Defaults to the address printed in the agreements. */
export function contractReplyTo(env?: MailEnv): string {
  const reply = (mailEnv(env).CONTRACT_REPLY_TO || 'dancimo@gmail.com').trim();
  return reply || 'dancimo@gmail.com';
}

export function contractOwnerEmail(env?: MailEnv): string {
  const owner = (mailEnv(env).CONTACT_EMAIL || 'dancimo@gmail.com').trim();
  return owner || 'dancimo@gmail.com';
}
