import assert from 'node:assert/strict';
import test from 'node:test';
import { decryptToken, encryptToken } from './crypto';
import { blockEventPayload, bookingEventPayload, googleEventId, parseFreeBusy, subtractIntervals } from './events';
import { GoogleCalendarClient } from './http';
import { GoogleReconnectError } from './gateway';
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

test('reads freebusy and treats a calendar error as unreadable', () => {
  assert.deepEqual(
    parseFreeBusy({
      calendars: { primary: { busy: [{ start: '2026-06-06T21:00:00.000Z', end: '2026-06-06T22:00:00.000Z' }] } },
    }),
    [{ startMs: Date.parse('2026-06-06T21:00:00.000Z'), endMs: Date.parse('2026-06-06T22:00:00.000Z') }],
  );
  assert.throws(() => parseFreeBusy({ calendars: { primary: { errors: [{ reason: 'notFound' }], busy: [] } } }));
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
