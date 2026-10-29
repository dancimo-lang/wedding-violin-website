'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AuthNotice, authButtonClass, authFieldClass, authLabelClass, authTextLinkClass } from '../auth-card';
import {
  RECOVERY_CONFIRMATION,
  RECOVERY_INVALID_EMAIL_MESSAGE,
  RECOVERY_RETRY_MESSAGE,
  SIGN_IN_NOT_CONFIGURED,
  normalizeAccountEmail,
  passwordResetRedirectUrl,
  recoveryRequestOutcome,
} from '@/lib/auth/password-reset';
import { createClient } from '@/lib/supabase/client';
import { getSupabasePublicEnv } from '@/lib/supabase/env';

export function ForgotPasswordForm() {
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');

    if (!getSupabasePublicEnv()) {
      setError(SIGN_IN_NOT_CONFIGURED);
      setPending(false);
      return;
    }

    const form = new FormData(event.currentTarget);
    const email = normalizeAccountEmail(String(form.get('email') || ''));
    if (!email || !email.includes('@')) {
      setError(RECOVERY_INVALID_EMAIL_MESSAGE);
      setPending(false);
      return;
    }

    const redirectTo = passwordResetRedirectUrl(window.location.origin);
    if (!redirectTo) {
      setError(RECOVERY_RETRY_MESSAGE);
      setPending(false);
      return;
    }

    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      const outcome = recoveryRequestOutcome(resetError);
      if (outcome === 'sent') {
        setSent(true);
        return;
      }
      setError(outcome === 'invalid_email' ? RECOVERY_INVALID_EMAIL_MESSAGE : RECOVERY_RETRY_MESSAGE);
    } catch {
      setError(RECOVERY_RETRY_MESSAGE);
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-6">
        <AuthNotice tone="info">{RECOVERY_CONFIRMATION}</AuthNotice>
        <div className="text-center">
          <Link href="/login" className={authTextLinkClass}>
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6 admin-readable">
      <p className="text-sm text-gray-600">
        Enter the email you use to sign in. If an account exists, a reset link is emailed to you. Open that link in
        this browser.
      </p>

      <div>
        <label htmlFor="email" className={authLabelClass}>
          Email
        </label>
        <input
          type="email"
          id="email"
          name="email"
          required
          autoComplete="email"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'forgot-error' : undefined}
          className={authFieldClass}
          placeholder="dancimo@gmail.com"
        />
      </div>

      {error && <AuthNotice id="forgot-error">{error}</AuthNotice>}

      <button type="submit" disabled={pending} className={authButtonClass}>
        {pending ? 'Sending...' : 'Send reset link'}
      </button>

      <div className="text-center">
        <Link href="/login" className={authTextLinkClass}>
          Back to sign in
        </Link>
      </div>
    </form>
  );
}
