import 'server-only';
import { readGoogleEnv } from './env';
import { GoogleCalendarClient } from './http';
import { createSupabaseSyncStore } from './store';
import { syncGoogleCalendar, type SyncResult } from './sync';

export async function runGoogleSync(now = new Date()): Promise<SyncResult> {
  const env = readGoogleEnv();
  if (!env) {
    return {
      ok: false,
      pushed: 0,
      removed: 0,
      failed: 0,
      busy: 0,
      message: 'Google Calendar is not configured.',
    };
  }
  return syncGoogleCalendar(createSupabaseSyncStore(env.encryptionKey), new GoogleCalendarClient(env), now);
}
