'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AuthNotice, authButtonClass, authFieldClass, authLabelClass, authTextLinkClass } from '../auth-card';
import { userIsAdmin } from '@/lib/admin';
import {
  FORGOT_PASSWORD_PATH,
  MIN_PASSWORD_LENGTH,
  NOT_AN_ADMIN,
  SIGN_IN_NOT_CONFIGURED,
  claimsArePasswordRecovery,
  newPasswordProblem,
  passwordUpdateMessage,
  recoveryLinkMessage,
} from '@/lib/auth/password-reset';
import { createClient } from '@/lib/supabase/client';
import { getSupabasePublicEnv } from '@/lib/supabase/env';

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const linkCode = searchParams.get('error');
  const linkMessage = linkCode ? (recoveryLinkMessage(linkCode) ?? recoveryLinkMessage('invalid')) : '';

  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const configured = Boolean(getSupabasePublicEnv());

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      if (linkMessage || !configured) {
        if (!cancelled) setReady(true);
        return;
      }

      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getClaims();
        if (!cancelled) setHasSession(claimsArePasswordRecovery(data?.claims));
      } catch {
        if (!cancelled) setHasSession(false);
      }

      if (!cancelled) setReady(true);
    }

    loadSession();
    return () => {
      cancelled = true;
    };
  }, [configured, linkMessage]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');

    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') || '');
    const confirmation = String(form.get('confirmation') || '');
    const problem = newPasswordProblem(password, confirmation);
    if (problem) {
      setError(problem);
      setPending(false);
      return;
    }

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(passwordUpdateMessage(updateError));
        setPending(false);
        return;
      }

      const { data } = await supabase.auth.getClaims();
      const userId = data?.claims?.sub;
      if (!userId || !(await userIsAdmin(supabase, userId))) {
        await supabase.auth.signOut();
        setError(NOT_AN_ADMIN);
        setPending(false);
        return;
      }

      window.location.assign('/admin');
    } catch {
      setError('The password could not be saved. Request a new reset link and try again.');
      setPending(false);
    }
  }

  if (!ready) {
    return <p className="text-gray-600">Loading...</p>;
  }

  if (!configured) {
    return <AuthNotice>{SIGN_IN_NOT_CONFIGURED}</AuthNotice>;
  }

  if (linkMessage || !hasSession) {
    return (
      <div className="space-y-6">
        <AuthNotice>{linkMessage || recoveryLinkMessage('invalid')}</AuthNotice>
        <div className="text-center">
          <Link href={FORGOT_PASSWORD_PATH} className={authTextLinkClass}>
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  const describedBy = error ? 'reset-error' : undefined;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6 admin-readable">
      <p className="text-sm text-gray-600">Choose a new password, then you&apos;ll go to the admin area.</p>

      <div>
        <label htmlFor="password" className={authLabelClass}>
          New password
        </label>
        <input
          type="password"
          id="password"
          name="password"
          required
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={authFieldClass}
          placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
        />
      </div>

      <div>
        <label htmlFor="confirmation" className={authLabelClass}>
          Confirm password
        </label>
        <input
          type="password"
          id="confirmation"
          name="confirmation"
          required
          autoComplete="new-password"
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={authFieldClass}
        />
      </div>

      {error && <AuthNotice id="reset-error">{error}</AuthNotice>}

      <button type="submit" disabled={pending} className={authButtonClass}>
        {pending ? 'Saving...' : 'Save password'}
      </button>
    </form>
  );
}
