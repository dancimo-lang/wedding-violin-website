import type { SupabaseClient } from '@supabase/supabase-js';
import type { ExternalCalendarState } from '@/lib/schedule/availability';
import { addCalendarDays, zonedWallTimeToUtc } from '@/lib/schedule/time';
import { DISCONNECTED_GOOGLE_STATUS, type GoogleStatusView } from './status';

export type GoogleBusyRow = {
  id: string;
  starts_at: string;
  ends_at: string;
};

export async function fetchGoogleStatus(): Promise<GoogleStatusView> {
  try {
    const response = await fetch('/api/admin/google/status', { cache: 'no-store' });
    if (!response.ok) return { ...DISCONNECTED_GOOGLE_STATUS, configured: true };
    return (await response.json()) as GoogleStatusView;
  } catch {
    return { ...DISCONNECTED_GOOGLE_STATUS, configured: true };
  }
}

export function statusToExternalState(status: GoogleStatusView): ExternalCalendarState {
  if (!status.connected) return 'disconnected';
  if (!status.busySyncedAt) return 'unsynced';
  return status.busyFresh ? 'fresh' : 'stale';
}

export type GoogleSyncResponse = {
  ok: boolean;
  message?: string;
  needsReconnect?: boolean;
};

export function googleSyncNotice(result: GoogleSyncResponse, status: GoogleStatusView): string {
  if (result.ok && status.busyFresh && !status.lastError && !status.needsReconnect) {
    return 'Sync finished. Busy times are up to date.';
  }
  if (!result.ok) return result.message || status.lastError || 'Google Calendar could not be synced.';
  return status.lastError || 'Sync finished. If Google still needs attention, the status above will say so.';
}

export async function requestGoogleSync(): Promise<GoogleSyncResponse> {
  try {
    const response = await fetch('/api/admin/google/sync', { method: 'POST' });
    const body = (await response.json().catch(() => null)) as GoogleSyncResponse | null;
    if (!response.ok || !body || body.ok === false) {
      return {
        ok: false,
        message: body?.message || 'Google Calendar could not be synced.',
        needsReconnect: body?.needsReconnect,
      };
    }
    return body;
  } catch {
    return { ok: false, message: 'Google Calendar could not be synced.' };
  }
}

export async function loadGoogleBusy(
  supabase: SupabaseClient,
  fromDate: string,
  toDate: string,
): Promise<GoogleBusyRow[]> {
  const start = zonedWallTimeToUtc(fromDate, '00:00');
  const end = zonedWallTimeToUtc(addCalendarDays(toDate, 1), '00:00');
  if (!start.ok || !end.ok) return [];
  const { data, error } = await supabase
    .from('google_busy_times')
    .select('id, starts_at, ends_at')
    .lt('starts_at', new Date(end.utcMs).toISOString())
    .gt('ends_at', new Date(start.utcMs).toISOString());
  if (error || !data) return [];
  return data as GoogleBusyRow[];
}
