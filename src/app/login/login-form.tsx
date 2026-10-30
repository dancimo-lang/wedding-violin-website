'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { authButtonClass, authErrorClass, authFieldClass, authLabelClass, authTextLinkClass } from './auth-card';
import { safeAdminPath, userIsAdmin } from '@/lib/admin';
import { FORGOT_PASSWORD_PATH } from '@/lib/auth/password-reset';
import { createClient } from '@/lib/supabase/client';
import { getSupabasePublicEnv } from '@/lib/supabase/env';

export function LoginForm() {
  const searchParams = useSearchParams();
  const nextPath = safeAdminPath(searchParams.get('next'));
  const queryError = searchParams.get('error');
  const notice =
    queryError === 'unauthorized'
      ? 'That account is not allowed to open the admin area.'
      : queryError === 'config'
        ? 'Sign-in is not configured yet.'
        : '';

  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function redirectIfAdmin() {
      if (!getSupabasePublicEnv()) {
        if (!cancelled) setReady(true);
        return;
      }

      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getClaims();
        const userId = data?.claims?.sub;
        if (userId && (await userIsAdmin(supabase, userId))) {
          window.location.replace(nextPath);
          return;
        }
      } catch {
        // Show the form when the session cannot be read.
      }

      if (!cancelled) setReady(true);
    }

    redirectIfAdmin();
    return () => {
      cancelled = true;
    };
  }, [nextPath]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');

    if (!getSupabasePublicEnv()) {
      setError('Sign-in is not configured yet. The site owner still needs to add the Supabase keys.');
      setPending(false);
      return;
    }

    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') || '')
      .trim()
      .toLowerCase();
    const password = String(form.get('password') || '');

    if (!email || !password) {
      setError('Enter your email and password.');
      setPending(false);
      return;
    }

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError('Email or password is incorrect.');
      setPending(false);
      return;
    }

    const { data } = await supabase.auth.getClaims();
    const userId = data?.claims?.sub;
    if (!userId || !(await userIsAdmin(supabase, userId))) {
      await supabase.auth.signOut();
      setError('That account is not on the admin list. Only the site owner can open this area.');
      setPending(false);
      return;
    }

    window.location.assign(nextPath);
  }

  if (!ready) {
    return <p className="text-gray-600">Loading...</p>;
  }

  const message = error || notice;

  return (
    <form onSubmit={onSubmit} className="space-y-6 admin-readable">
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
          className={authFieldClass}
          placeholder="dancimo@gmail.com"
        />
      </div>

      <div>
        <label htmlFor="password" className={authLabelClass}>
          Password
        </label>
        <input
          type="password"
          id="password"
          name="password"
          required
          autoComplete="current-password"
          className={authFieldClass}
          placeholder="••••••••"
        />
        <div className="mt-2 text-right">
          <Link href={FORGOT_PASSWORD_PATH} className={authTextLinkClass}>
            Forgot password?
          </Link>
        </div>
      </div>

      {message && <div className={authErrorClass}>{message}</div>}

      <button type="submit" disabled={pending} className={authButtonClass}>
        {pending ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  );
}
