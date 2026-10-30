import 'server-only';
import { userIsAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';

export async function getAdminSession() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (error || !userId) return null;
  if (!(await userIsAdmin(supabase, userId))) return null;

  const email = typeof data.claims.email === 'string' ? data.claims.email : null;
  return { id: userId, email, supabase };
}
