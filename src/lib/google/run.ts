import 'server-only';
import { readGoogleEnv } from './env';
import { logGoogleSyncFailure } from './gateway';
import { GoogleCalendarClient } from './http';
import { createSupabaseSyncStore } from './store';
import { refreshBusyTimes, syncGoogleCalendar, type SyncResult } from './sync';
import { BUSY_REFRESH_THROTTLE_MS, refreshStaleBusy } from './busy-refresh';
import { BUSY_MAX_AGE_MS } from '@/lib/schedule/availability';
import { createAdminClient } from '@/lib/supabase/admin';

export async function runGoogleSync(now = new Date()): Promise<SyncResult> {
  const env = readGoogleEnv();
  if (!env) {
    console.error('Google Calendar sync failed', { reason: 'not_configured' });
    return {
      ok: false,
      pushed: 0,
      removed: 0,
      failed: 0,
      busy: 0,
      message: 'Google Calendar is not configured.',
    };
  }
  try {
    return await syncGoogleCalendar(createSupabaseSyncStore(env.encryptionKey), new GoogleCalendarClient(env), now);
  } catch (error) {
    logGoogleSyncFailure(error);
    return {
      ok: false,
      pushed: 0,
      removed: 0,
      failed: 0,
      busy: 0,
      message: 'Google Calendar could not be synced.',
    };
  }
}

/**
 * Claim the single on-demand refresh slot. One conditional UPDATE, so concurrent
 * requests race on the row and only one wins. updated_at doubles as the throttle
 * clock: failures and successes both bump it, so a failing Google call is retried
 * at most once per BUSY_REFRESH_THROTTLE_MS.
 */
async function claimBusyRefresh(now: Date): Promise<boolean> {
  const admin = createAdminClient();
  const staleBefore = new Date(now.getTime() - BUSY_MAX_AGE_MS).toISOString();
  const throttleBefore = new Date(now.getTime() - BUSY_REFRESH_THROTTLE_MS).toISOString();
  const { data, error } = await admin
    .from('google_calendar_connection')
    .update({ updated_at: now.toISOString() })
    .eq('id', 1)
    .eq('status', 'connected')
    .not('calendar_id', 'is', null)
    .lt('updated_at', throttleBefore)
    .or(`busy_synced_at.is.null,busy_synced_at.lt."${staleBefore}"`)
    .select('id');
  if (error) return false;
  return Array.isArray(data) && data.length > 0;
}

/** Public availability path: refresh stale busy times, time-boxed. Never throws. */
export async function refreshStaleBusyForAvailability(now = new Date()): Promise<boolean> {
  const env = readGoogleEnv();
  if (!env) return false;
  return refreshStaleBusy(
    {
      claim: claimBusyRefresh,
      refresh: async (at) => {
        try {
          const result = await refreshBusyTimes(
            createSupabaseSyncStore(env.encryptionKey),
            new GoogleCalendarClient(env),
            at,
          );
          return result.ok && !result.skipped;
        } catch (error) {
          logGoogleSyncFailure(error);
          return false;
        }
      },
    },
    now,
  );
}
