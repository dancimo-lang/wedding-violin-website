import assert from 'node:assert/strict';
import test from 'node:test';
import { decryptToken, encryptToken } from './crypto';
import {
  FREEBUSY_MAX_RANGE_MS,
  FreeBusyReadError,
  blockEventPayload,
  bookingEventPayload,
  busyPullWindow,
  chunkTimeRange,
  googleEventId,
  parseFreeBusy,
  subtractIntervals,
} from './events';
import { GoogleCalendarClient } from './http';
import { GoogleApiError, GoogleReconnectError, logGoogleSyncFailure, safeGoogleMessage } from './gateway';
import { statusViewFromRow } from './status';
import { googleSyncNotice, statusToExternalState } from './browser';
import { bearerAuthorized, buildAuthorizationUrl, secretsMatch } from './oauth';

const KEY = Buffer.alloc(32, 7).toString('base64');
const ENV = {
  clientId: 'client-id',
  clientSecret: 'client-secret',
  redirectUri: 'http://localhost:3000/api/admin/google/callback',
  encryptionKey: KEY,
};

test('encrypts the refresh token and rejects a tampered copy', () => {
  const encrypted = encryptToken('refresh-token-value', KEY);
  assert.equal(decryptToken(encrypted, KEY), 'refresh-token-value');
  assert.notEqual(encrypted.ciphertext, 'refresh-token-value');
  assert.throws(() => decryptToken({ ...encrypted, tag: Buffer.alloc(16, 1).toString('base64') }, KEY));
  assert.throws(() => decryptToken(encrypted, Buffer.alloc(32, 9).toString('base64')));
});

test('builds an offline consent URL without the client secret', () => {
  const url = new URL(buildAuthorizationUrl({ clientId: 'client-id', redirectUri: ENV.redirectUri, state: 'state-value' }));
  assert.equal(url.searchParams.get('access_type'), 'offline');
  assert.equal(url.searchParams.get('prompt'), 'consent');
  assert.equal(url.searchParams.get('state'), 'state-value');
  assert.match(url.searchParams.get('scope') || '', /calendar\.app\.created/);
  assert.match(url.searchParams.get('scope') || '', /calendar\.freebusy/);
  assert.equal(url.searchParams.get('client_secret'), null);
  assert.equal(secretsMatch('abc', 'abc'), true);
  assert.equal(secretsMatch('abc', 'abd'), false);
  assert.equal(bearerAuthorized('Bearer cron-secret', 'cron-secret'), true);
  assert.equal(bearerAuthorized('Bearer wrong', 'cron-secret'), false);
  assert.equal(bearerAuthorized(null, 'cron-secret'), false);
});

test('event ids are deterministic and Google-safe, and block reasons are not copied', () => {
  const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const eventId = googleEventId(id);
  assert.equal(eventId, googleEventId(id));
  assert.notEqual(eventId, googleEventId('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'));
  assert.match(eventId, /^site[0-9a-v]+$/);
  assert.ok(eventId.length >= 5 && eventId.length <= 1024);

  const block = blockEventPayload({
    id,
    blockType: 'Personal',
    startDate: '2026-06-06',
    endDate: '2026-06-06',
    startTime: '13:00',
    endTime: '14:00',
    allDay: false,
  });
  const serialized = JSON.stringify(block);
  assert.equal(block.summary, 'Personal');
  assert.equal(block.description, 'Blocked on the website calendar.');
  assert.equal(serialized.includes('dentist'), false);
  assert.equal(serialized.includes('reason'), false);
  assert.equal(block.id, eventId);

  const allDay = blockEventPayload({
    id,
    blockType: 'Unavailable',
    startDate: '2026-06-06',
    endDate: '2026-06-08',
    startTime: null,
    endTime: null,
    allDay: true,
  });
  assert.deepEqual(allDay.start, { date: '2026-06-06' });
  assert.deepEqual(allDay.end, { date: '2026-06-09' });

  const booking = bookingEventPayload({
    id,
    status: 'Confirmed',
    eventDate: '2026-06-06',
    startTime: '16:00:00',
    endTime: '17:00:00',
    venueName: 'Mission',
    venueAddress: '100 Madonna Road',
    serviceType: 'Wedding ceremony',
    clientName: 'Alex Rivera',
  });
  assert.ok(booking);
  assert.match(booking.summary, /Alex Rivera/);
  assert.match(booking.location || '', /100 Madonna Road/);
  assert.equal(JSON.stringify(booking).includes('special'), false);
  assert.match(booking.description, /^Couple: Alex Rivera\n/);
  assert.match(booking.description, /Status: Confirmed\. Added by the website/);

  const withNotes = bookingEventPayload({
    id,
    status: 'Tentative',
    eventDate: '2026-06-06',
    startTime: null,
    endTime: null,
    venueName: 'Mission',
    venueAddress: '100 Madonna Road',
    serviceType: 'Wedding ceremony',
    clientName: 'Alex Rivera',
    partnerName: 'Sam Lee',
    packageName: 'Ceremony + Cocktail',
    specialRequests: '  Walk down: Canon in D\r\nRecessional: Signed, Sealed  ',
  });
  assert.ok(withNotes);
  assert.equal(
    withNotes.description,
    [
      'Couple: Alex Rivera & Sam Lee',
      'Service: Wedding ceremony',
      'Package: Ceremony + Cocktail',
      'Venue: Mission, 100 Madonna Road',
      '',
      'Special requests:',
      'Walk down: Canon in D\nRecessional: Signed, Sealed',
      '',
      'Status: Tentative. Added by the website. Change this booking on the website so both calendars stay in step.',
    ].join('\n'),
  );
  const long = bookingEventPayload({ ...bookingRowBase(id), specialRequests: 'x'.repeat(20000) });
  assert.ok(long && long.description.length <= 7500);
  assert.match(long.description, /Status: /);
  const blockOnly = blockEventPayload({
    id,
    blockType: 'Vacation',
    startDate: '2026-06-06',
    endDate: '2026-06-06',
    startTime: null,
    endTime: null,
    allDay: true,
  });
  assert.equal(blockOnly.description, 'Blocked on the website calendar.');
  assert.equal(bookingEventPayload({ ...bookingRowBase(id), status: 'Cancelled' }), null);
});

test('subtracts only this website’s own busy intervals', () => {
  const busy = [
    { startMs: 0, endMs: 50 },
    { startMs: 100, endMs: 140 },
  ];
  assert.deepEqual(subtractIntervals(busy, [{ startMs: 20, endMs: 30 }]), [
    { startMs: 0, endMs: 20 },
    { startMs: 30, endMs: 50 },
    { startMs: 100, endMs: 140 },
  ]);
  assert.deepEqual(subtractIntervals(busy, [{ startMs: 100, endMs: 140 }]), [{ startMs: 0, endMs: 50 }]);
});

test('reads freebusy, treats an empty calendar as success, and keeps a calendar error reason', () => {
  assert.deepEqual(
    parseFreeBusy({
      calendars: { primary: { busy: [{ start: '2026-06-06T21:00:00.000Z', end: '2026-06-06T22:00:00.000Z' }] } },
    }),
    [{ startMs: Date.parse('2026-06-06T21:00:00.000Z'), endMs: Date.parse('2026-06-06T22:00:00.000Z') }],
  );
  assert.deepEqual(parseFreeBusy({ calendars: { primary: { busy: [] } } }), []);
  assert.throws(
    () => parseFreeBusy({ calendars: { primary: { errors: [{ reason: 'notFound' }], busy: [] } } }),
    (error: unknown) => {
      assert.ok(error instanceof FreeBusyReadError);
      assert.equal(error.reason, 'notFound');
      return true;
    },
  );
});

test('busy pulls are split under Google’s freebusy range limit', () => {
  const window = busyPullWindow(new Date('2026-10-29T16:13:58.000Z'));
  const span = Date.parse(window.timeMax) - Date.parse(window.timeMin);
  assert.ok(span > FREEBUSY_MAX_RANGE_MS);
  const chunks = chunkTimeRange(window.timeMin, window.timeMax);
  assert.ok(chunks.length > 1);
  assert.equal(chunks[0].timeMin, window.timeMin);
  assert.equal(chunks[chunks.length - 1].timeMax, window.timeMax);
  for (const chunk of chunks) {
    const width = Date.parse(chunk.timeMax) - Date.parse(chunk.timeMin);
    assert.ok(width > 0);
    assert.ok(width <= FREEBUSY_MAX_RANGE_MS);
  }
});

test('freebusy failures keep Google status and reason and omit tokens', async () => {
  const fetchImpl: typeof fetch = async (_input, init) => {
    const headers = new Headers(init?.headers);
    assert.match(headers.get('authorization') || '', /^Bearer ya29\./);
    return jsonResponse(400, {
      error: {
        errors: [
          {
            domain: 'calendar',
            reason: 'timeRangeTooLong',
            message: 'The requested time range is too long. ya29.secret-access-token',
          },
        ],
        code: 400,
        message: 'The requested time range is too long.',
      },
    });
  };
  const client = new GoogleCalendarClient(ENV, fetchImpl);
  const error = await client
    .freeBusy('ya29.secret-access-token', '2026-06-01T00:00:00.000Z', '2026-06-02T00:00:00.000Z')
    .then(() => null)
    .catch((caught: unknown) => caught);
  assert.ok(error instanceof GoogleApiError);
  assert.equal(error.status, 400);
  assert.equal(error.reason, 'timeRangeTooLong');
  assert.equal(JSON.stringify(error).includes('ya29'), false);
  const message = safeGoogleMessage(error);
  assert.match(message, /HTTP 400/);
  assert.match(message, /timeRangeTooLong/);
  assert.equal(message.includes('ya29'), false);

  const lines: unknown[][] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    lines.push(args);
  };
  try {
    logGoogleSyncFailure(error);
    logGoogleSyncFailure(new Error('refresh failed ya29.secret-access-token'));
  } finally {
    console.error = original;
  }
  const logged = JSON.stringify(lines);
  assert.match(logged, /timeRangeTooLong/);
  assert.match(logged, /400/);
  assert.equal(logged.includes('ya29'), false);
});

test('an empty freebusy response across the full window is a successful read', async () => {
  const bodies: { timeMin: string; timeMax: string; authorization: string }[] = [];
  const fetchImpl: typeof fetch = async (_input, init) => {
    const headers = new Headers(init?.headers);
    const body = JSON.parse(String(init?.body)) as { timeMin: string; timeMax: string };
    bodies.push({ ...body, authorization: headers.get('authorization') || '' });
    return jsonResponse(200, { calendars: { primary: { busy: [] } } });
  };
  const client = new GoogleCalendarClient(ENV, fetchImpl);
  const window = busyPullWindow(new Date('2026-10-29T16:13:58.000Z'));
  const intervals = await client.freeBusy('ya29.secret-access-token', window.timeMin, window.timeMax);
  assert.deepEqual(intervals, []);
  assert.ok(bodies.length > 1);
  for (const body of bodies) {
    assert.ok(Date.parse(body.timeMax) - Date.parse(body.timeMin) <= FREEBUSY_MAX_RANGE_MS);
    assert.match(body.authorization, /^Bearer ya29\./);
  }
});

test('settings status distinguishes a never-read calendar from a stale one', () => {
  const never = statusViewFromRow(true, {
    status: 'connected',
    google_email: 'owner@example.com',
    calendar_summary: 'Weddings (website)',
    calendar_mode: 'dedicated',
    busy_synced_at: null,
    last_error: 'Google busy times could not be read. · HTTP 400 · timeRangeTooLong',
  });
  assert.equal(never.busyFresh, false);
  assert.equal(never.busySyncedAt, null);
  assert.match(never.lastError || '', /timeRangeTooLong/);
  assert.equal(statusToExternalState(never), 'unsynced');

  const fresh = statusViewFromRow(
    true,
    {
      status: 'connected',
      busy_synced_at: '2026-10-29T16:13:58.000Z',
      last_error: null,
    },
    Date.parse('2026-10-29T17:00:00.000Z'),
  );
  assert.equal(fresh.busyFresh, true);
  assert.equal(fresh.lastError, null);
  assert.equal(statusToExternalState(fresh), 'fresh');
  assert.equal(
    googleSyncNotice({ ok: false, message: 'Google busy times could not be read. · HTTP 400 · timeRangeTooLong' }, never),
    'Google busy times could not be read. · HTTP 400 · timeRangeTooLong',
  );
  assert.equal(googleSyncNotice({ ok: true }, fresh), 'Sync finished. Busy times are up to date.');
  assert.match(googleSyncNotice({ ok: true }, never), /still needs attention|timeRangeTooLong/);
});

test('refresh failure and an existing event id are handled without echoing secrets', async () => {
  const calls: string[] = [];
  const responses = [
    jsonResponse(400, { error: 'invalid_grant', error_description: 'revoked' }),
    jsonResponse(200, { access_token: 'ya29.access', refresh_token: 'stored-refresh' }),
    jsonResponse(409, { error: { message: 'duplicate' } }),
    jsonResponse(200, { id: 'siteevent' }),
  ];
  const fetchImpl: typeof fetch = async (input, init) => {
    calls.push(`${init?.method || 'GET'} ${String(input)}`);
    const next = responses.shift();
    if (!next) throw new Error('no scripted response');
    return next;
  };
  const client = new GoogleCalendarClient(ENV, fetchImpl);
  await assert.rejects(client.refreshAccessToken('stored-refresh'), GoogleReconnectError);
  const traded = await client.exchangeCode('auth-code');
  assert.equal(traded.refreshToken, 'stored-refresh');
  await client.upsertEvent('ya29.access', 'cal', {
    id: 'siteevent',
    summary: 'Hold',
    description: 'Blocked on the website calendar.',
    start: { date: '2026-06-06' },
    end: { date: '2026-06-07' },
    extendedProperties: { private: { source: 'danielcimo-website', rowId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' } },
  });
  assert.ok(calls.some((call) => call.startsWith('PUT ')));
  assert.equal(calls.some((call) => call.includes('stored-refresh')), false);
});

function bookingRowBase(id: string) {
  return {
    id,
    status: 'Confirmed',
    eventDate: '2026-06-06',
    startTime: '16:00',
    endTime: '17:00',
    venueName: null,
    venueAddress: null,
    serviceType: 'Wedding ceremony',
    clientName: 'Alex Rivera',
  };
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
