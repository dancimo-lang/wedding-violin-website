export const MIN_PASSWORD_LENGTH = 8;
/** Supabase Auth rejects passwords longer than this. */
export const MAX_PASSWORD_LENGTH = 72;

/** Page the recovery email should return to. Allow this exact path in Supabase. */
export const PASSWORD_RESET_CALLBACK_PATH = '/auth/callback';
/** Same handler, on the existing API catch-all so it does not add a function. */
export const PASSWORD_RESET_API_PATH = '/api/auth/callback';
export const PASSWORD_RESET_PAGE_PATH = '/login/reset-password';
export const FORGOT_PASSWORD_PATH = '/login/forgot-password';

export const RECOVERY_CONFIRMATION =
  'If an account exists for that email, a reset link is on its way. Open that link in this browser, and check your spam folder if it is not in your inbox.';

export const RECOVERY_RETRY_MESSAGE = 'We could not send the email just now. Wait a minute and try again.';

export const RECOVERY_INVALID_EMAIL_MESSAGE = 'Enter a valid email address.';

export const SIGN_IN_NOT_CONFIGURED =
  'Sign-in is not configured yet. The site owner still needs to add the Supabase keys.';

export const NOT_AN_ADMIN = 'That account is not on the admin list. Only the site owner can open this area.';

const FLOW_ID_PATTERN = /^[a-zA-Z0-9_-]{8,64}$/;
const EXPIRED_CODES = new Set(['otp_expired', 'flow_state_expired']);

export type RecoveryLinkCode = 'expired' | 'invalid' | 'browser' | 'config';
export type RecoveryRequestOutcome = 'sent' | 'invalid_email' | 'retry';

export type AuthFailure = {
  code?: string | null;
  message?: string | null;
  name?: string | null;
  status?: number | null;
};

export function normalizeAccountEmail(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Build the recovery redirect from the browser origin so preview deployments
 * and production share one code path. Supabase still has to allow that URL.
 */
export function passwordResetRedirectUrl(origin: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
  if (parsed.username || parsed.password) return null;
  return `${parsed.origin}${PASSWORD_RESET_CALLBACK_PATH}`;
}

/** Match auth-js flow ids. An invalid id must be dropped so the verifier cookie is still used. */
export function pkceFlowId(value: string | null | undefined): string | undefined {
  if (!value || !FLOW_ID_PATTERN.test(value)) return undefined;
  return value;
}

/** A recovery email creates a session whose amr method is `recovery`. A normal sign-in is not enough. */
export function claimsArePasswordRecovery(claims: { amr?: unknown } | null | undefined): boolean {
  const amr = claims?.amr;
  if (!Array.isArray(amr)) return false;
  return amr.some((entry) => {
    if (entry === 'recovery') return true;
    if (!entry || typeof entry !== 'object') return false;
    return (entry as { method?: unknown }).method === 'recovery';
  });
}

/**
 * Missing accounts must look the same as a sent email. Other failures stay
 * generic so the form still does not say whether the address is registered.
 */
export function recoveryRequestOutcome(error: AuthFailure | null | undefined): RecoveryRequestOutcome {
  if (!error) return 'sent';
  const code = (error.code ?? '').toLowerCase();
  const message = (error.message ?? '').toLowerCase();
  if (
    code === 'user_not_found' ||
    message.includes('user not found') ||
    message.includes('user with this email not found')
  ) {
    return 'sent';
  }
  if (
    code === 'email_address_invalid' ||
    code === 'validation_failed' ||
    message.includes('invalid format') ||
    message.includes('unable to validate email')
  ) {
    return 'invalid_email';
  }
  return 'retry';
}

export function recoveryRedirectError(input: {
  error: string | null;
  errorCode: string | null;
  errorDescription: string | null;
}): RecoveryLinkCode | null {
  if (!input.error && !input.errorCode && !input.errorDescription) return null;
  const code = (input.errorCode ?? '').toLowerCase();
  const description = (input.errorDescription ?? '').toLowerCase();
  if (EXPIRED_CODES.has(code) || description.includes('expired')) return 'expired';
  return 'invalid';
}

export function recoveryExchangeError(error: AuthFailure): RecoveryLinkCode {
  const code = (error.code ?? '').toLowerCase();
  const name = error.name ?? '';
  const message = (error.message ?? '').toLowerCase();
  if (
    code === 'pkce_code_verifier_not_found' ||
    name === 'AuthPKCECodeVerifierMissingError' ||
    message.includes('code verifier')
  ) {
    return 'browser';
  }
  if (EXPIRED_CODES.has(code) || message.includes('expired')) return 'expired';
  return 'invalid';
}

export function recoveryLinkMessage(code: string | null | undefined): string | null {
  switch (code) {
    case 'expired':
      return 'This reset link has expired. Request a new one, then open it in this browser.';
    case 'browser':
      return 'This reset link only works in the browser where you asked for it. Open the email there, or request a new link from that browser.';
    case 'invalid':
      return 'This reset link is invalid or has already been used. Request a new one.';
    case 'config':
      return SIGN_IN_NOT_CONFIGURED;
    default:
      return null;
  }
}

export function newPasswordProblem(password: string, confirmation: string): string | null {
  if (!password || !confirmation) return 'Enter your new password twice.';
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Use ${MAX_PASSWORD_LENGTH} characters or fewer.`;
  }
  if (password !== confirmation) return "Those passwords don't match.";
  return null;
}

export function passwordUpdateMessage(error: AuthFailure): string {
  const code = (error.code ?? '').toLowerCase();
  const message = (error.message ?? '').toLowerCase();
  if (
    message.includes('easy to guess') ||
    message.includes('pwned') ||
    message.includes('leaked') ||
    message.includes('known to be weak')
  ) {
    return 'That password is too easy to guess. Choose a different one.';
  }
  if (message.includes('should be different') || message.includes('different from')) {
    return 'Choose a password you have not used before.';
  }
  const length = error.message?.match(/at least (\d+)/i);
  if (length) return `Use at least ${length[1]} characters.`;
  if (code === 'weak_password' || message.includes('too short')) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (
    code === 'session_not_found' ||
    code === 'reauthentication_needed' ||
    code === 'current_password_required' ||
    message.includes('session missing') ||
    message.includes('jwt expired') ||
    message.includes('current password') ||
    message.includes('reauthentication')
  ) {
    return 'This reset link has expired. Request a new one, then open it in this browser.';
  }
  return 'The password could not be saved. Request a new reset link and try again.';
}
