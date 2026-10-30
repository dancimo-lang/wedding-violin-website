import assert from 'node:assert/strict';
import test from 'node:test';
import { apiRouteCatalog } from '../api/route-table';
import {
  FORGOT_PASSWORD_PATH,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  PASSWORD_RESET_API_PATH,
  PASSWORD_RESET_CALLBACK_PATH,
  PASSWORD_RESET_PAGE_PATH,
  RECOVERY_CONFIRMATION,
  RECOVERY_INVALID_EMAIL_MESSAGE,
  RECOVERY_RETRY_MESSAGE,
  claimsArePasswordRecovery,
  newPasswordProblem,
  passwordResetRedirectUrl,
  passwordUpdateMessage,
  pkceFlowId,
  recoveryExchangeError,
  recoveryLinkMessage,
  recoveryRedirectError,
  recoveryRequestOutcome,
} from './password-reset';

const previewOrigin =
  'https://wedding-violin-website-git-admin-password-reset-f64f-daniel-cimos-projects.vercel.app';

test('the reset redirect uses the current origin and a fixed callback path', () => {
  assert.equal(passwordResetRedirectUrl('https://danielcimo.com'), 'https://danielcimo.com/auth/callback');
  assert.equal(passwordResetRedirectUrl(`${previewOrigin}/login`), `${previewOrigin}/auth/callback`);
  assert.equal(
    passwordResetRedirectUrl('http://localhost:3000/login?next=/admin#hash'),
    'http://localhost:3000/auth/callback',
  );
  assert.equal(passwordResetRedirectUrl('https://user:secret@danielcimo.com'), null);
  assert.equal(passwordResetRedirectUrl('javascript:alert(1)'), null);
  assert.equal(passwordResetRedirectUrl(''), null);
  assert.equal(passwordResetRedirectUrl('not a url'), null);
});

test('a missing account gets the same outcome as a sent recovery email', () => {
  assert.equal(recoveryRequestOutcome(null), 'sent');
  assert.equal(recoveryRequestOutcome(undefined), 'sent');
  assert.equal(recoveryRequestOutcome({ code: 'user_not_found', message: 'User not found' }), 'sent');
  assert.equal(recoveryRequestOutcome({ message: 'User with this email not found' }), 'sent');

  assert.equal(recoveryRequestOutcome({ code: 'email_address_invalid' }), 'invalid_email');
  assert.equal(recoveryRequestOutcome({ message: 'Unable to validate email address: invalid format' }), 'invalid_email');
  assert.equal(recoveryRequestOutcome({ code: 'over_email_send_rate_limit', status: 429 }), 'retry');
  assert.equal(recoveryRequestOutcome({ message: 'Failed to fetch' }), 'retry');

  assert.equal(RECOVERY_CONFIRMATION.includes('on its way'), true);
  assert.equal(RECOVERY_CONFIRMATION.includes('does not exist'), false);
  assert.equal(RECOVERY_RETRY_MESSAGE.includes('not found'), false);
  assert.equal(RECOVERY_INVALID_EMAIL_MESSAGE.includes('not found'), false);
});

test('expired, used, and cross-browser links get distinct messages', () => {
  assert.equal(
    recoveryRedirectError({
      error: 'access_denied',
      errorCode: 'otp_expired',
      errorDescription: 'Email link is invalid or has expired',
    }),
    'expired',
  );
  assert.equal(
    recoveryRedirectError({ error: 'access_denied', errorCode: null, errorDescription: 'expired' }),
    'expired',
  );
  assert.equal(
    recoveryRedirectError({ error: 'access_denied', errorCode: 'otp_disabled', errorDescription: null }),
    'invalid',
  );
  assert.equal(recoveryRedirectError({ error: null, errorCode: null, errorDescription: null }), null);

  assert.equal(recoveryExchangeError({ code: 'pkce_code_verifier_not_found' }), 'browser');
  assert.equal(recoveryExchangeError({ name: 'AuthPKCECodeVerifierMissingError' }), 'browser');
  assert.equal(recoveryExchangeError({ message: 'PKCE code verifier not found in storage.' }), 'browser');
  assert.equal(recoveryExchangeError({ code: 'otp_expired', message: 'Token has expired or is invalid' }), 'expired');
  assert.equal(recoveryExchangeError({ message: 'Email link is invalid or has expired' }), 'expired');
  assert.equal(recoveryExchangeError({ message: 'Invalid token' }), 'invalid');

  assert.match(recoveryLinkMessage('expired') ?? '', /expired/);
  assert.match(recoveryLinkMessage('browser') ?? '', /same browser|browser where you asked/);
  assert.match(recoveryLinkMessage('invalid') ?? '', /invalid or has already been used/);
  assert.equal(recoveryLinkMessage('nope'), null);
  assert.equal(recoveryLinkMessage('expired')?.includes('otp_'), false);
});

test('new passwords need a minimum length and a matching confirmation', () => {
  assert.match(newPasswordProblem('', 'secret-password') ?? '', /twice/);
  assert.match(newPasswordProblem('short', 'short') ?? '', new RegExp(String(MIN_PASSWORD_LENGTH)));
  assert.match(newPasswordProblem('a'.repeat(MAX_PASSWORD_LENGTH + 1), 'a'.repeat(MAX_PASSWORD_LENGTH + 1)) ?? '', /fewer/);
  assert.match(newPasswordProblem('long-enough', 'different-1') ?? '', /don't match/);
  assert.equal(newPasswordProblem('long-enough', 'long-enough'), null);

  assert.match(passwordUpdateMessage({ message: 'Password should be at least 6 characters' }), /at least 6/);
  assert.match(passwordUpdateMessage({ code: 'weak_password', message: 'Password is known to be weak and easy to guess' }), /easy to guess/);
  assert.match(passwordUpdateMessage({ message: 'New password should be different from the old password.' }), /have not used/);
  assert.match(passwordUpdateMessage({ message: 'Auth session missing!' }), /expired/);
  assert.match(passwordUpdateMessage({ message: 'unexpected' }), /could not be saved/);
});

test('only a recovery session can set a new password', () => {
  assert.equal(claimsArePasswordRecovery({ amr: [{ method: 'recovery', timestamp: 1 }] }), true);
  assert.equal(claimsArePasswordRecovery({ amr: ['recovery'] }), true);
  assert.equal(claimsArePasswordRecovery({ amr: [{ method: 'password', timestamp: 1 }] }), false);
  assert.equal(claimsArePasswordRecovery({ amr: [] }), false);
  assert.equal(claimsArePasswordRecovery(null), false);
  assert.equal(claimsArePasswordRecovery({}), false);
});

test('only a real pkce flow id is forwarded to the code exchange', () => {
  assert.equal(pkceFlowId('abc12345'), 'abc12345');
  assert.equal(pkceFlowId('short'), undefined);
  assert.equal(pkceFlowId('has spaces'), undefined);
  assert.equal(pkceFlowId(null), undefined);
});

test('recovery routes stay on the login pages and the api catch-all', () => {
  assert.equal(FORGOT_PASSWORD_PATH, '/login/forgot-password');
  assert.equal(PASSWORD_RESET_PAGE_PATH, '/login/reset-password');
  assert.equal(PASSWORD_RESET_CALLBACK_PATH, '/auth/callback');
  assert.equal(PASSWORD_RESET_API_PATH, '/api/auth/callback');

  const route = apiRouteCatalog.find((entry) => entry.id === 'password-recovery');
  if (!route) assert.fail('missing password recovery route');
  assert.deepEqual(route.segments, ['auth', 'callback']);
  assert.deepEqual(route.methods, ['GET']);
});
