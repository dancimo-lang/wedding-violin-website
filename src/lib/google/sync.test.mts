import assert from 'node:assert/strict';
import test from 'node:test';
import type { BlockSyncRow, BookingSyncRow, GoogleEventPayload, Interval } from './events';
import { GoogleApiError, GoogleReconnectError, type GoogleCalendarGateway } from './gateway';
import { syncGoogleCalendar, type EventLink, type OutboxItem, type StoredConnection, type SyncStore } from './sync';

const BOOKING_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const BLOCK_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

test('pushes a booking and a block, and never includes a private block reason', async () => {
  const google = fakeGoogle();
  const store = memoryStore();
  store.outbox.push(item('1', 'bookings', BOOKING_ID, 'upsert', '2026-06-01T00:00:00.000Z'));
  store.outbox.push(item('2', 'availability_blocks', BLOCK_ID, 'upsert', '2026-06-01T00:01:00.000Z'));
  store.bookings.set(BOOKING_ID, booking());
  store.blocks.set(BLOCK_ID, block());
  google.busy = [{ startMs: 10, endMs: 20 }];

  const result = await syncGoogleCalendar(store, google, new Date('2026-06-06T18:00:00.000Z'));
  assert.equal(result.ok, true);
  assert.equal(result.pushed, 2);
  const events = [...google.events.values()];
  const copied = events.find((event) => event.summary === 'Personal');
  assert.ok(copied);
  assert.equal(copied.description, 'Blocked on the website calendar.');
  assert.equal(JSON.stringify(copied).includes('dentist'), false);
  assert.match([...google.events.values()].find((event) => event.summary.includes('Alex'))?.summary || '', /Alex Rivera/);
  assert.deepEqual(store.savedBusy, [{ startMs: 10, endMs: 20 }]);
  assert.equal(google.listedCalendars.length, 0);
});

test('a cancellation removes the Google event and keeps the id stable', async () => {
  const google = fakeGoogle();
  const store = memoryStore();
  store.outbox.push(item('1', 'bookings', BOOKING_ID, 'delete', '2026-06-01T00:00:00.000Z'));
  store.links.set(`bookings:${BOOKING_ID}`, { googleEventId: 'siteold', calendarId: 'weddings' });
  const result = await syncGoogleCalendar(store, google, new Date('2026-06-06T18:00:00.000Z'));
  assert.equal(result.removed, 1);
  assert.deepEqual(google.deleted, ['weddings/siteold']);
  assert.equal(store.links.has(`bookings:${BOOKING_ID}`), false);
});

test('primary calendar busy times drop the website’s own events', async () => {
  const google = fakeGoogle();
  google.created = null;
  const store = memoryStore({ calendarId: 'primary', calendarMode: 'primary', calendarSummary: 'Primary calendar' });
  google.busy = [
    { startMs: 0, endMs: 50 },
    { startMs: 100, endMs: 140 },
  ];
  google.own = [{ startMs: 100, endMs: 140 }];
  const result = await syncGoogleCalendar(store, google, new Date('2026-06-06T18:00:00.000Z'));
  assert.equal(result.ok, true);
  assert.deepEqual(store.savedBusy, [{ startMs: 0, endMs: 50 }]);
  assert.deepEqual(google.listedCalendars, ['primary']);
});

test('a rejected refresh token asks for reconnect and does not mark busy times fresh', async () => {
  const google = fakeGoogle();
  google.refreshError = true;
  const store = memoryStore();
  store.outbox.push(item('1', 'bookings', BOOKING_ID, 'upsert', '2026-06-01T00:00:00.000Z'));
  const result = await syncGoogleCalendar(store, google, new Date('2026-06-06T18:00:00.000Z'));
  assert.equal(result.needsReconnect, true);
  assert.deepEqual(store.reconnects, ['Google rejected the saved connection. Use Reconnect Google.']);
  assert.equal(store.savedBusy, null);
  assert.equal(google.events.size, 0);
});

test('a failed busy read leaves the previous cache alone', async () => {
  const google = fakeGoogle();
  google.failBusy = true;
  const store = memoryStore();
  const result = await syncGoogleCalendar(store, google, new Date('2026-06-06T18:00:00.000Z'));
  assert.equal(result.ok, false);
  assert.equal(store.savedBusy, null);
});

test('the newest outbox row wins and the first connection queues existing rows', async () => {
  const google = fakeGoogle();
  const store = memoryStore({ calendarId: null, calendarMode: null, calendarSummary: null });
  store.outbox.push(item('1', 'bookings', BOOKING_ID, 'upsert', '2026-06-01T00:00:00.000Z'));
  store.outbox.push(item('2', 'bookings', BOOKING_ID, 'delete', '2026-06-01T00:05:00.000Z'));
  store.bookings.set(BOOKING_ID, booking());
  const result = await syncGoogleCalendar(store, google, new Date('2026-06-06T18:00:00.000Z'));
  assert.equal(result.removed, 1);
  assert.equal(result.pushed, 0);
  assert.equal(store.queued, true);
  assert.equal(store.connection.calendarId, 'weddings');
});

function item(id: string, sourceTable: OutboxItem['sourceTable'], sourceId: string, operation: OutboxItem['operation'], createdAt: string): OutboxItem {
  return { id, sourceTable, sourceId, operation, attempts: 0, createdAt };
}

function booking(): BookingSyncRow {
  return {
    id: BOOKING_ID,
    status: 'Confirmed',
    eventDate: '2026-06-06',
    startTime: '16:00',
    endTime: '17:00',
    venueName: 'Mission',
    venueAddress: '100 Madonna Road',
    serviceType: 'Wedding ceremony',
    clientName: 'Alex Rivera',
  };
}

function block(): BlockSyncRow {
  return {
    id: BLOCK_ID,
    blockType: 'Personal',
    startDate: '2026-06-06',
    endDate: '2026-06-06',
    startTime: '13:00',
    endTime: '14:00',
    allDay: false,
  };
}

function fakeGoogle(): GoogleCalendarGateway & {
  events: Map<string, GoogleEventPayload>;
  deleted: string[];
  busy: Interval[];
  own: Interval[];
  listedCalendars: string[];
  created: { id: string; summary: string } | null;
  refreshError: boolean;
  failBusy: boolean;
} {
  const google = {
    events: new Map<string, GoogleEventPayload>(),
    deleted: [] as string[],
    busy: [] as Interval[],
    own: [] as Interval[],
    listedCalendars: [] as string[],
    created: { id: 'weddings', summary: 'Weddings (website)' } as { id: string; summary: string } | null,
    refreshError: false,
    failBusy: false,
    async refreshAccessToken() {
      if (google.refreshError) throw new GoogleReconnectError();
      return 'access-token';
    },
    async userEmail() {
      return 'owner@example.com';
    },
    async findCalendar(_access: string, calendarId: string) {
      if (calendarId === 'weddings') return { id: 'weddings', summary: 'Weddings (website)' };
      return null;
    },
    async createWeddingsCalendar() {
      return google.created;
    },
    async upsertEvent(_access: string, calendarId: string, event: GoogleEventPayload) {
      google.events.set(`${calendarId}/${event.id}`, event);
    },
    async deleteEvent(_access: string, calendarId: string, eventId: string) {
      google.deleted.push(`${calendarId}/${eventId}`);
      google.events.delete(`${calendarId}/${eventId}`);
    },
    async freeBusy() {
      if (google.failBusy) throw new GoogleApiError(503, 'Google busy times could not be read.');
      return google.busy;
    },
    async listWebsiteEventIntervals(_access: string, calendarId: string) {
      google.listedCalendars.push(calendarId);
      return google.own;
    },
    async deleteWebsiteEvents() {
      return undefined;
    },
  };
  return google;
}

function memoryStore(overrides: Partial<StoredConnection> = {}) {
  const connection: StoredConnection = {
    status: 'connected',
    refreshToken: 'refresh-secret',
    calendarId: 'weddings',
    calendarSummary: 'Weddings (website)',
    calendarMode: 'dedicated',
    googleEmail: 'owner@example.com',
    ...overrides,
  };
  const store = {
    connection,
    outbox: [] as OutboxItem[],
    bookings: new Map<string, BookingSyncRow>(),
    blocks: new Map<string, BlockSyncRow>(),
    links: new Map<string, EventLink>(),
    savedBusy: null as Interval[] | null,
    reconnects: [] as string[],
    queued: false,
    async getConnection() {
      return store.connection;
    },
    async markReconnect(message: string) {
      store.reconnects.push(message);
      store.connection = { ...store.connection, status: 'reconnect_required' };
    },
    async saveCalendar(calendar: { id: string; summary: string; mode: 'dedicated' | 'primary' }) {
      store.connection = {
        ...store.connection,
        calendarId: calendar.id,
        calendarSummary: calendar.summary,
        calendarMode: calendar.mode,
        status: 'connected',
      };
    },
    async listOutbox() {
      return store.outbox;
    },
    async finishOutbox(sourceTable: string, sourceId: string) {
      store.outbox = store.outbox.filter((row) => !(row.sourceTable === sourceTable && row.sourceId === sourceId));
    },
    async failOutbox() {
      return undefined;
    },
    async enqueueAll() {
      store.queued = true;
    },
    async getBooking(id: string) {
      return store.bookings.get(id) || null;
    },
    async getBlock(id: string) {
      return store.blocks.get(id) || null;
    },
    async getLink(sourceTable: string, sourceId: string) {
      return store.links.get(`${sourceTable}:${sourceId}`) || null;
    },
    async saveLink(link: EventLink & { sourceTable: string; sourceId: string }) {
      store.links.set(`${link.sourceTable}:${link.sourceId}`, link);
    },
    async deleteLink(sourceTable: string, sourceId: string) {
      store.links.delete(`${sourceTable}:${sourceId}`);
    },
    async replaceBusy(intervals: Interval[]) {
      store.savedBusy = intervals;
    },
  };
  return store satisfies SyncStore & typeof store;
}
