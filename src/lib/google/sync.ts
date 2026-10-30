import {
  blockEventPayload,
  bookingEventPayload,
  busyPullWindow,
  googleEventId,
  subtractIntervals,
  type BlockSyncRow,
  type BookingSyncRow,
  type Interval,
} from './events';
import {
  GoogleReconnectError,
  logGoogleSyncFailure,
  safeGoogleMessage,
  type CalendarRef,
  type GoogleCalendarGateway,
} from './gateway';

export type StoredConnection = {
  status: 'disconnected' | 'connected' | 'reconnect_required';
  refreshToken: string | null;
  calendarId: string | null;
  calendarSummary: string | null;
  calendarMode: 'dedicated' | 'primary' | null;
  googleEmail: string | null;
};

export type OutboxItem = {
  id: string;
  sourceTable: 'bookings' | 'availability_blocks';
  sourceId: string;
  operation: 'upsert' | 'delete';
  attempts: number;
  createdAt: string;
};

export type EventLink = {
  googleEventId: string;
  calendarId: string;
};

export type SyncStore = {
  getConnection(): Promise<StoredConnection | null>;
  markReconnect(message: string): Promise<void>;
  recordFailure(message: string): Promise<void>;
  saveCalendar(calendar: CalendarRef & { mode: 'dedicated' | 'primary' }): Promise<void>;
  listOutbox(limit: number): Promise<OutboxItem[]>;
  finishOutbox(sourceTable: string, sourceId: string, throughCreatedAt: string): Promise<void>;
  failOutbox(ids: string[], attempts: number, message: string): Promise<void>;
  enqueueAll(): Promise<void>;
  getBooking(id: string): Promise<BookingSyncRow | null>;
  getBlock(id: string): Promise<BlockSyncRow | null>;
  getLink(sourceTable: string, sourceId: string): Promise<EventLink | null>;
  saveLink(link: EventLink & { sourceTable: string; sourceId: string }): Promise<void>;
  deleteLink(sourceTable: string, sourceId: string): Promise<void>;
  replaceBusy(intervals: Interval[], fetchedAt: string): Promise<void>;
};

export type SyncResult = {
  ok: boolean;
  skipped?: boolean;
  needsReconnect?: boolean;
  pushed: number;
  removed: number;
  failed: number;
  busy: number;
  message?: string;
};

const EMPTY: SyncResult = { ok: true, pushed: 0, removed: 0, failed: 0, busy: 0 };
const RECONNECT_MESSAGE = 'Google rejected the saved connection. Use Reconnect Google.';

export async function syncGoogleCalendar(
  store: SyncStore,
  google: GoogleCalendarGateway,
  now = new Date(),
): Promise<SyncResult> {
  try {
    return await syncConnected(store, google, now);
  } catch (error) {
    return recordedFailure(store, error);
  }
}

async function syncConnected(
  store: SyncStore,
  google: GoogleCalendarGateway,
  now: Date,
): Promise<SyncResult> {
  const connection = await store.getConnection();
  if (!connection || connection.status === 'disconnected') return { ...EMPTY, skipped: true };
  if (!connection.refreshToken) {
    return recordedReconnect(store, 'The saved Google connection could not be read. Use Reconnect Google.');
  }

  let accessToken: string;
  try {
    accessToken = await google.refreshAccessToken(connection.refreshToken);
  } catch (error) {
    if (error instanceof GoogleReconnectError) return recordedReconnect(store, RECONNECT_MESSAGE);
    return recordedFailure(store, error);
  }

  let calendar: CalendarRef & { mode: 'dedicated' | 'primary' };
  try {
    calendar = await ensureCalendar(google, accessToken, connection);
  } catch (error) {
    if (error instanceof GoogleReconnectError) return recordedReconnect(store, RECONNECT_MESSAGE);
    return recordedFailure(store, error);
  }

  if (connection.calendarId && connection.calendarId !== calendar.id) {
    try {
      await google.deleteWebsiteEvents(accessToken, connection.calendarId);
    } catch (error) {
      if (error instanceof GoogleReconnectError) return recordedReconnect(store, RECONNECT_MESSAGE);
      logGoogleSyncFailure(error);
    }
  }
  await store.saveCalendar(calendar);
  if (connection.calendarId !== calendar.id) await store.enqueueAll();

  const result = await pushOutbox(store, google, accessToken, calendar.id);
  if (result.needsReconnect) return result;

  try {
    const window = busyPullWindow(now);
    let intervals = await google.freeBusy(accessToken, window.timeMin, window.timeMax);
    if (calendar.mode === 'primary') {
      const own = await google.listWebsiteEventIntervals(accessToken, 'primary', window.timeMin, window.timeMax);
      intervals = subtractIntervals(intervals, own);
    }
    await store.replaceBusy(intervals, now.toISOString());
    if (result.failed > 0) {
      await store.recordFailure(result.message || 'Some calendar updates could not be pushed to Google.');
    }
    return { ...result, ok: result.failed === 0, busy: intervals.length };
  } catch (error) {
    if (error instanceof GoogleReconnectError) return recordedReconnect(store, RECONNECT_MESSAGE, result);
    return recordedFailure(store, error, result);
  }
}

async function recordedFailure(store: SyncStore, error: unknown, partial: SyncResult = EMPTY): Promise<SyncResult> {
  const message = safeGoogleMessage(error);
  logGoogleSyncFailure(error);
  try {
    await store.recordFailure(message);
  } catch (recordError) {
    logGoogleSyncFailure(recordError);
  }
  return { ...partial, ok: false, message };
}

async function recordedReconnect(store: SyncStore, message: string, partial: SyncResult = EMPTY): Promise<SyncResult> {
  logGoogleSyncFailure(new GoogleReconnectError());
  try {
    await store.markReconnect(message);
  } catch (error) {
    logGoogleSyncFailure(error);
  }
  return { ...partial, ok: false, needsReconnect: true, message: 'Reconnect Google.' };
}

async function ensureCalendar(
  google: GoogleCalendarGateway,
  accessToken: string,
  connection: StoredConnection,
): Promise<CalendarRef & { mode: 'dedicated' | 'primary' }> {
  if (connection.calendarId && connection.calendarMode !== 'primary' && connection.calendarId !== 'primary') {
    const existing = await google.findCalendar(accessToken, connection.calendarId);
    if (existing) return { ...existing, mode: 'dedicated' };
  }
  const created = await google.createWeddingsCalendar(accessToken);
  if (created) return { ...created, mode: 'dedicated' };
  return { id: 'primary', summary: 'Primary calendar', mode: 'primary' };
}

async function pushOutbox(
  store: SyncStore,
  google: GoogleCalendarGateway,
  accessToken: string,
  calendarId: string,
): Promise<SyncResult> {
  const rows = await store.listOutbox(100);
  const groups = collapseOutbox(rows);
  const result: SyncResult = { ...EMPTY, ok: true };
  for (const group of groups) {
    try {
      const removed = await applyOutboxItem(store, google, accessToken, calendarId, group.item);
      if (removed) result.removed += 1;
      else result.pushed += 1;
      await store.finishOutbox(group.item.sourceTable, group.item.sourceId, group.item.createdAt);
    } catch (error) {
      if (error instanceof GoogleReconnectError) return recordedReconnect(store, RECONNECT_MESSAGE, result);
      result.failed += 1;
      result.ok = false;
      const message = safeGoogleMessage(error);
      if (!result.message) result.message = message;
      logGoogleSyncFailure(error);
      await store.failOutbox(group.ids, group.item.attempts + 1, message);
    }
  }
  return result;
}

async function applyOutboxItem(
  store: SyncStore,
  google: GoogleCalendarGateway,
  accessToken: string,
  calendarId: string,
  item: OutboxItem,
): Promise<boolean> {
  if (item.operation === 'delete') {
    await removeEvent(store, google, accessToken, calendarId, item.sourceTable, item.sourceId);
    return true;
  }
  if (item.sourceTable === 'bookings') {
    const booking = await store.getBooking(item.sourceId);
    const payload = booking ? bookingEventPayload(booking) : null;
    if (!payload) {
      await removeEvent(store, google, accessToken, calendarId, item.sourceTable, item.sourceId);
      return true;
    }
    await putEvent(store, google, accessToken, calendarId, item.sourceTable, item.sourceId, payload);
    return false;
  }
  const block = await store.getBlock(item.sourceId);
  if (!block) {
    await removeEvent(store, google, accessToken, calendarId, item.sourceTable, item.sourceId);
    return true;
  }
  await putEvent(store, google, accessToken, calendarId, item.sourceTable, item.sourceId, blockEventPayload(block));
  return false;
}

async function putEvent(
  store: SyncStore,
  google: GoogleCalendarGateway,
  accessToken: string,
  calendarId: string,
  sourceTable: string,
  sourceId: string,
  payload: ReturnType<typeof blockEventPayload>,
): Promise<void> {
  const link = await store.getLink(sourceTable, sourceId);
  if (link && link.calendarId !== calendarId) {
    await google.deleteEvent(accessToken, link.calendarId, link.googleEventId);
  }
  await google.upsertEvent(accessToken, calendarId, payload);
  await store.saveLink({
    sourceTable,
    sourceId,
    googleEventId: payload.id,
    calendarId,
  });
}

async function removeEvent(
  store: SyncStore,
  google: GoogleCalendarGateway,
  accessToken: string,
  calendarId: string,
  sourceTable: string,
  sourceId: string,
): Promise<void> {
  const link = await store.getLink(sourceTable, sourceId);
  const eventId = link?.googleEventId || googleEventId(sourceId);
  const calendars = new Set<string>([calendarId]);
  if (link?.calendarId) calendars.add(link.calendarId);
  for (const id of calendars) {
    await google.deleteEvent(accessToken, id, eventId);
  }
  await store.deleteLink(sourceTable, sourceId);
}

export function collapseOutbox(items: OutboxItem[]): { item: OutboxItem; ids: string[] }[] {
  const groups = new Map<string, { item: OutboxItem; ids: string[] }>();
  const sorted = [...items].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  for (const item of sorted) {
    const key = `${item.sourceTable}:${item.sourceId}`;
    const existing = groups.get(key);
    if (!existing) groups.set(key, { item, ids: [item.id] });
    else {
      existing.ids.push(item.id);
      existing.item = item;
    }
  }
  return [...groups.values()];
}
