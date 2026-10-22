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
  return status.busyFresh ? 'fresh' : 'stale';
}

export async function requestGoogleSync(): Promise<void> {
  try {
    await fetch('/api/admin/google/sync', { method: 'POST' });
  } catch {
    // The database outbox keeps the change until the next sync.
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
