import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateAvailability,
  externalCalendarState,
  publicExternalOccupancies,
  DEFAULT_SCHEDULE_SETTINGS,
} from '../schedule/availability';
import { BUSY_REFRESH_THROTTLE_MS, refreshStaleBusy } from './busy-refresh';

const NOW = new Date('2026-06-06T18:00:00.000Z');

/** In-memory twin of the conditional UPDATE claim in run.ts. */
function slot() {
  const state = { lastAttempt: 0, claims: 0 };
  return {
    state,
    async claim(now: Date) {
      if (now.getTime() - state.lastAttempt < BUSY_REFRESH_THROTTLE_MS) return false;
      state.lastAttempt = now.getTime();
      state.claims += 1;
      return true;
    },
  };
}

test('stale busy times refresh, then the check answers from fresh data', async () => {
  const db = {
    connection: { status: 'connected', busy_synced_at: '2026-06-06T10:00:00.000Z' },
    busy: [] as { id: string; starts_at: string; ends_at: string }[],
  };
  assert.equal(externalCalendarState(db.connection, NOW.getTime()), 'stale');
  const lock = slot();
  const ok = await refreshStaleBusy(
    {
      claim: lock.claim,
      refresh: async (at) => {
        db.connection = { status: 'connected', busy_synced_at: at.toISOString() };
        return true;
      },
    },
    NOW,
  );
  assert.equal(ok, true);
  const state = externalCalendarState(db.connection, NOW.getTime());
  assert.equal(state, 'fresh');
  const assessment = evaluateAvailability(
    { date: '2026-06-20', startTime: '15:00', endTime: '17:00', venue: null },
    publicExternalOccupancies(state, db.busy),
    DEFAULT_SCHEDULE_SETTINGS,
    undefined,
    state,
  );
  assert.notEqual(assessment.result, 'requires_manual_confirmation');
});

test('concurrent stale checks run one refresh; later checks wait for the throttle window', async () => {
  const lock = slot();
  let calls = 0;
  const deps = {
    claim: lock.claim,
    refresh: async () => {
      calls += 1;
      return true;
    },
  };
  const results = await Promise.all([1, 2, 3, 4].map(() => refreshStaleBusy(deps, NOW)));
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(calls, 1);
  assert.equal(await refreshStaleBusy(deps, new Date(NOW.getTime() + 60_000)), false);
  assert.equal(calls, 1);
  assert.equal(await refreshStaleBusy(deps, new Date(NOW.getTime() + BUSY_REFRESH_THROTTLE_MS + 1)), true);
  assert.equal(calls, 2);
});

test('a failing Google refresh falls back and is not retried inside the window', async () => {
  const lock = slot();
  let calls = 0;
  const deps = {
    claim: lock.claim,
    refresh: async () => {
      calls += 1;
      throw new Error('Google busy times could not be read. ya29.secret');
    },
  };
  assert.equal(await refreshStaleBusy(deps, NOW), false);
  assert.equal(await refreshStaleBusy(deps, new Date(NOW.getTime() + 1000)), false);
  assert.equal(calls, 1);
  // Still stale, so the public answer stays requires_manual_confirmation.
  const state = externalCalendarState({ status: 'connected', busy_synced_at: '2026-06-06T10:00:00.000Z' }, NOW.getTime());
  const assessment = evaluateAvailability(
    { date: '2026-06-20', startTime: '15:00', endTime: '17:00', venue: null },
    publicExternalOccupancies(state, []),
    DEFAULT_SCHEDULE_SETTINGS,
    undefined,
    state,
  );
  assert.equal(assessment.result, 'requires_manual_confirmation');
});

test('a slow Google refresh times out and falls back', async () => {
  const lock = slot();
  const started = Date.now();
  const ok = await refreshStaleBusy(
    { claim: lock.claim, refresh: () => new Promise<boolean>(() => undefined), timeoutMs: 50 },
    NOW,
  );
  assert.equal(ok, false);
  assert.ok(Date.now() - started < 1000);
});

test('a claim error falls back without calling Google', async () => {
  let calls = 0;
  const ok = await refreshStaleBusy(
    {
      claim: async () => {
        throw new Error('db down');
      },
      refresh: async () => {
        calls += 1;
        return true;
      },
    },
    NOW,
  );
  assert.equal(ok, false);
  assert.equal(calls, 0);
});
