import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DISCONNECTED_GOOGLE_STATUS } from '@/lib/google/status';
import { GoogleConnectionCard } from './GoogleConnectionCard';

const noop = () => undefined;

test('settings card shows connect, reconnect, and disconnect', () => {
  const missing = renderToStaticMarkup(
    createElement(GoogleConnectionCard, {
      view: DISCONNECTED_GOOGLE_STATUS,
      notice: '',
      pending: false,
      onDisconnect: noop,
      onSync: noop,
    }),
  );
  assert.match(missing, /keys are not set/);

  const connect = renderToStaticMarkup(
    createElement(GoogleConnectionCard, {
      view: { ...DISCONNECTED_GOOGLE_STATUS, configured: true },
      notice: '',
      pending: false,
      onDisconnect: noop,
      onSync: noop,
    }),
  );
  assert.match(connect, /Connect Google Calendar/);
  assert.doesNotMatch(connect, /Reconnect Google/);

  const reconnect = renderToStaticMarkup(
    createElement(GoogleConnectionCard, {
      view: { ...DISCONNECTED_GOOGLE_STATUS, configured: true, needsReconnect: true },
      notice: '',
      pending: false,
      onDisconnect: noop,
      onSync: noop,
    }),
  );
  assert.match(reconnect, /Reconnect Google/);

  const connected = renderToStaticMarkup(
    createElement(GoogleConnectionCard, {
      view: {
        ...DISCONNECTED_GOOGLE_STATUS,
        configured: true,
        connected: true,
        email: 'owner@example.com',
        calendarSummary: 'Weddings (website)',
        calendarMode: 'dedicated',
        busyFresh: true,
        busySyncedAt: '2026-06-06T18:00:00.000Z',
      },
      notice: 'Google Calendar is connected.',
      pending: false,
      onDisconnect: noop,
      onSync: noop,
    }),
  );
  assert.match(connected, /Disconnect/);
  assert.match(connected, /owner@example.com/);
  assert.match(connected, /Weddings \(website\)/);
  assert.match(connected, /Sync now/);
  assert.match(connected, /Busy times last read/);
  assert.doesNotMatch(connected, /more than two hours old/);
  assert.doesNotMatch(connected, /have not been read yet/);
  assert.doesNotMatch(connected, /refresh/);

  const neverRead = renderToStaticMarkup(
    createElement(GoogleConnectionCard, {
      view: {
        ...DISCONNECTED_GOOGLE_STATUS,
        configured: true,
        connected: true,
        email: 'owner@example.com',
        calendarSummary: 'Weddings (website)',
        calendarMode: 'dedicated',
        busyFresh: false,
        busySyncedAt: null,
        lastError: 'Google busy times could not be read. · HTTP 400 · timeRangeTooLong',
      },
      notice: 'Google Calendar could not be synced.',
      pending: false,
      onDisconnect: noop,
      onSync: noop,
    }),
  );
  assert.match(neverRead, /Busy times have not been read yet/);
  assert.match(neverRead, /Until a sync finishes/);
  assert.match(neverRead, /timeRangeTooLong/);
  assert.doesNotMatch(neverRead, /more than two hours old/);

  const stale = renderToStaticMarkup(
    createElement(GoogleConnectionCard, {
      view: {
        ...DISCONNECTED_GOOGLE_STATUS,
        configured: true,
        connected: true,
        busyFresh: false,
        busySyncedAt: '2026-06-06T12:00:00.000Z',
      },
      notice: '',
      pending: false,
      onDisconnect: noop,
      onSync: noop,
    }),
  );
  assert.match(stale, /more than two hours old/);
  assert.doesNotMatch(stale, /Until a sync finishes/);
});
