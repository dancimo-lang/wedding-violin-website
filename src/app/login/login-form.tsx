'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { safeAdminPath, userIsAdmin } from '@/lib/admin';
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
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
          Email
        </label>
        <input
          type="email"
          id="email"
          name="email"
          required
          autoComplete="email"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 placeholder:text-gray-500"
          placeholder="dancimo@gmail.com"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
          Password
        </label>
        <input
          type="password"
          id="password"
          name="password"
          required
          autoComplete="current-password"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 placeholder:text-gray-500"
          placeholder="••••••••"
        />
      </div>

      {message && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{message}</div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-3 px-6 rounded-lg font-medium transition-colors"
      >
        {pending ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  );
}
