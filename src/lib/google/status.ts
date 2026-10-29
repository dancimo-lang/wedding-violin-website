import { externalCalendarState } from '@/lib/schedule/availability';

export type GoogleStatusView = {
  configured: boolean;
  connected: boolean;
  needsReconnect: boolean;
  email: string | null;
  calendarSummary: string | null;
  calendarMode: 'dedicated' | 'primary' | null;
  busySyncedAt: string | null;
  busyFresh: boolean;
  lastError: string | null;
};

export const DISCONNECTED_GOOGLE_STATUS: GoogleStatusView = {
  configured: false,
  connected: false,
  needsReconnect: false,
  email: null,
  calendarSummary: null,
  calendarMode: null,
  busySyncedAt: null,
  busyFresh: false,
  lastError: null,
};

type StatusRow = {
  status?: string | null;
  google_email?: string | null;
  calendar_summary?: string | null;
  calendar_mode?: string | null;
  busy_synced_at?: string | null;
  last_error?: string | null;
} | null;

export function statusViewFromRow(configured: boolean, row: StatusRow, now = Date.now()): GoogleStatusView {
  const mode = row?.calendar_mode === 'primary' || row?.calendar_mode === 'dedicated' ? row.calendar_mode : null;
  const state = externalCalendarState(
    row ? { status: row.status, busy_synced_at: row.busy_synced_at } : null,
    now,
  );
  return {
    configured,
    connected: row?.status === 'connected',
    needsReconnect: row?.status === 'reconnect_required',
    email: row?.google_email ?? null,
    calendarSummary: row?.calendar_summary ?? null,
    calendarMode: mode,
    busySyncedAt: row?.busy_synced_at ?? null,
    busyFresh: state === 'fresh',
    lastError: row?.last_error ?? null,
  };
}
