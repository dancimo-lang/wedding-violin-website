import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isProductionCalendarEnvironment } from './production';

/**
 * Puts one lead on the existing Google sync queue. The cron and the immediate
 * sync drain it. Preview deployments log and do nothing, so they cannot change
 * the real calendar. The queue accepts leads only after migration 012.
 */
export async function queueCallReminder(
  admin: SupabaseClient,
  leadId: string,
  env?: { VERCEL_ENV?: string },
): Promise<'queued' | 'skipped'> {
  if (!isProductionCalendarEnvironment(env)) {
    console.info('Google call reminder skipped because this is not the production site.');
    return 'skipped';
  }
  const { error } = await admin.from('google_sync_outbox').insert({
    source_table: 'leads',
    source_id: leadId,
    operation: 'upsert',
  });
  if (error) {
    console.info('Call reminder was not queued.');
    return 'skipped';
  }
  return 'queued';
}

/** Queue the reminder, then push it. A failed push stays in the queue for the cron. */
export async function queueCallReminderAndSync(
  admin: SupabaseClient,
  leadId: string,
  env?: { VERCEL_ENV?: string },
): Promise<'queued' | 'skipped'> {
  const queued = await queueCallReminder(admin, leadId, env);
  if (queued !== 'queued') return queued;
  try {
    const { runGoogleSync } = await import('./run');
    await runGoogleSync();
  } catch {
    console.info('Call reminder will be retried by the calendar sync.');
  }
  return queued;
}
