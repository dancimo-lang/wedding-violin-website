'use server';

import { redirect } from 'next/navigation';
import { safeAdminPath, userIsAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';
import { getSupabasePublicEnv } from '@/lib/supabase/env';

export type LoginState = { error: string };

export async function login(_previous: LoginState, formData: FormData): Promise<LoginState> {
  if (!getSupabasePublicEnv()) {
    return {
      error: 'Sign-in is not configured yet. The site owner still needs to add the Supabase keys.',
    };
  }

  const email = String(formData.get('email') || '')
    .trim()
    .toLowerCase();
  const password = String(formData.get('password') || '');
  const nextPath = safeAdminPath(String(formData.get('next') || ''));

  if (!email || !password) {
    return { error: 'Enter your email and password.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: 'Email or password is incorrect.' };
  }

  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (!userId || !(await userIsAdmin(supabase, userId))) {
    await supabase.auth.signOut();
    return {
      error: 'That account is not on the admin list. Only the site owner can open this area.',
    };
  }

  redirect(nextPath);
}
