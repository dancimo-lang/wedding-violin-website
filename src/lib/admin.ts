import type { SupabaseClient } from '@supabase/supabase-js';

export function safeAdminPath(value: string | null | undefined): string {
  if (!value || !value.startsWith('/admin')) return '/admin';
  if (
    value.startsWith('//') ||
    value.includes('\\') ||
    value.includes('://') ||
    value.includes('\0') ||
    value.includes('\n') ||
    value.includes('\r')
  ) {
    return '/admin';
  }
  return value;
}

export async function userIsAdmin(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('admins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  return !error && Boolean(data);
}
