import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BUSY_MAX_AGE_MS,
  GOOGLE_ALL_DAY_REASON,
  GOOGLE_DISCONNECTED_REASON,
  GOOGLE_OVERLAP_REASON,
  GOOGLE_STALE_REASON,
  evaluateAvailability,
  externalBusyToOccupancy,
  externalCalendarState,
  publicExternalOccupancies,
  rosterWarning,
  type Occupancy,
  type ScheduleSettings,
} from './availability';
import { addCalendarDays, venueRef, zonedWallTimeToUtc } from './time';

const settings: ScheduleSettings = {
  setupBufferMinutes: 30,
  breakdownBufferMinutes: 15,
  travelBufferMinutes: 90,
  performerCount: 4,
};

function confirmed(partial: Partial<Occupancy> & Pick<Occupancy, 'id'>): Occupancy {
  const startDate = partial.startDate || '2026-06-06';
  return {
    kind: 'confirmed',
    allDay: false,
    startTime: '14:00',
    endTime: '15:00',
    venue: venueRef('100 Madonna Road, San Luis Obispo'),
    performersNeeded: 1,
    ...partial,
    startDate: partial.startDate || startDate,
    endDate: partial.endDate || startDate,
  };
}

test('converts Pacific Time across standard time and daylight saving', () => {
  const winter = zonedWallTimeToUtc('2026-01-15', '14:00');
  const summer = zonedWallTimeToUtc('2026-07-15', '14:00');
  assert.equal(winter.ok && winter.utcMs, Date.parse('2026-01-15T22:00:00.000Z'));
  assert.equal(summer.ok && summer.utcMs, Date.parse('2026-07-15T21:00:00.000Z'));
});

test('rejects the missing hour and the repeated hour on daylight-saving edges', () => {
  const gap = zonedWallTimeToUtc('2026-03-08', '02:30');
  const repeated = zonedWallTimeToUtc('2026-11-01', '01:30');
  const afterSpring = zonedWallTimeToUtc('2026-03-08', '03:30');
  assert.equal(gap.ok, false);
  assert.equal(gap.ok === false && gap.issue, 'gap');
  assert.equal(repeated.ok, false);
  assert.equal(repeated.ok === false && repeated.issue, 'ambiguous');
  assert.equal(afterSpring.ok && afterSpring.utcMs, Date.parse('2026-03-08T10:30:00.000Z'));

  const duringGap = evaluateAvailability(
    { date: '2026-03-08', startTime: '02:30', endTime: '03:30' },
    [],
    settings,
  );
  assert.equal(duringGap.result, 'requires_manual_confirmation');

  const duringRepeat = evaluateAvailability(
    { date: '2026-11-01', startTime: '01:30', endTime: '02:30' },
    [],
    settings,
  );
  assert.equal(duringRepeat.result, 'requires_manual_confirmation');
});

test('a clear date appears available, and a whole-day block does not', () => {
  assert.equal(evaluateAvailability({ date: '2026-06-06' }, [], settings).result, 'appears_available');
  const blocked = evaluateAvailability({ date: '2026-06-06', startTime: '16:00', endTime: '17:00' }, [
    {
      id: 'block',
      kind: 'block',
      allDay: true,
      startDate: '2026-06-06',
      endDate: '2026-06-08',
      startTime: null,
      endTime: null,
      venue: { precision: 'none', key: null },
      performersNeeded: 1,
    },
  ], settings);
  assert.equal(blocked.result, 'unavailable');
});

test('confirmed overlap is unavailable and a tentative overlap needs a manual look', () => {
  const event = confirmed({ id: 'wedding' });
  const overlap = { date: '2026-06-06', startTime: '14:30', endTime: '15:30', venue: venueRef('100 Madonna Road, San Luis Obispo') };
  assert.equal(evaluateAvailability(overlap, [event], settings).result, 'unavailable');
  assert.equal(
    evaluateAvailability(overlap, [{ ...event, kind: 'tentative' }], settings).result,
    'requires_manual_confirmation',
  );
  assert.equal(
    evaluateAvailability(overlap, [{ ...event, kind: 'confirmed', id: 'cancelled' }], settings).result,
    'unavailable',
  );
});

test('setup and breakdown buffers count as a conflict even when the performances do not overlap', () => {
  const event = confirmed({ id: 'wedding', startTime: '14:00', endTime: '15:00' });
  const result = evaluateAvailability(
    {
      date: '2026-06-06',
      startTime: '15:20',
      endTime: '16:00',
      venue: venueRef('100 Madonna Road, San Luis Obispo'),
    },
    [event],
    settings,
  );
  assert.equal(result.result, 'unavailable');
});

test('travel uses the default buffer and only treats two different street addresses as a hard conflict', () => {
  const event = confirmed({ id: 'wedding', startTime: '14:00', endTime: '15:00' });
  const soon = { date: '2026-06-06', startTime: '16:00', endTime: '17:00' };
  assert.equal(
    evaluateAvailability(soon, [event], settings).result,
    'requires_manual_confirmation',
  );
  assert.equal(
    evaluateAvailability({ ...soon, venue: venueRef('400 Higuera Street, San Luis Obispo') }, [event], settings).result,
    'unavailable',
  );
  assert.equal(
    evaluateAvailability({ ...soon, venue: venueRef('100 Madonna Road, San Luis Obispo') }, [event], settings).result,
    'appears_available',
  );
  assert.equal(
    evaluateAvailability(
      { date: '2026-06-06', startTime: '19:00', endTime: '20:00' },
      [event],
      settings,
    ).result,
    'appears_available',
  );
});

test('a date with an event but no requested time is not called available', () => {
  const result = evaluateAvailability(
    { date: '2026-06-06' },
    [confirmed({ id: 'wedding' })],
    settings,
  );
  assert.equal(result.result, 'requires_manual_confirmation');
});

test('an event with no times on that date needs a manual look', () => {
  const result = evaluateAvailability(
    { date: '2026-06-06', startTime: '10:00', endTime: '11:00', venue: venueRef('1 Main St') },
    [confirmed({ id: 'wedding', startTime: null, endTime: null, venue: { precision: 'none', key: null } })],
    settings,
  );
  assert.equal(result.result, 'requires_manual_confirmation');
});

test('a cancelled event is ignored by the caller mapping and an excluded id does not conflict with itself', () => {
  const event = confirmed({ id: 'self' });
  const request = {
    date: '2026-06-06',
    startTime: '14:00',
    endTime: '15:00',
    venue: event.venue,
    excludeId: 'self',
  };
  assert.equal(evaluateAvailability(request, [event], settings).result, 'appears_available');
});

test('roster size is a staffing warning and does not by itself change the public answer', () => {
  assert.match(rosterWarning(5, settings) || '', /roster/);
  assert.equal(rosterWarning(2, settings), null);
  assert.equal(addCalendarDays('2026-03-08', 1), '2026-03-09');
});

function googleBusy(id: string, startIso: string, endIso: string): Occupancy {
  const occupancy = externalBusyToOccupancy({ id, starts_at: startIso, ends_at: endIso });
  assert.ok(occupancy);
  return occupancy;
}

test('a Google busy window blocks only its own hours, including across daylight saving', () => {
  const afternoon = googleBusy('busy', '2026-06-06T21:00:00.000Z', '2026-06-06T22:00:00.000Z');
  assert.equal(afternoon.endMs! - afternoon.startMs!, 60 * 60 * 1000);
  const later = evaluateAvailability(
    { date: '2026-06-06', startTime: '16:00', endTime: '17:00', venue: venueRef('400 Higuera Street, San Luis Obispo') },
    [afternoon],
    settings,
    undefined,
    'fresh',
  );
  assert.equal(later.result, 'appears_available');

  const overlap = evaluateAvailability(
    { date: '2026-06-06', startTime: '14:30', endTime: '15:30' },
    [afternoon],
    settings,
    undefined,
    'fresh',
  );
  assert.equal(overlap.result, 'unavailable');
  assert.ok(overlap.reasons.includes(GOOGLE_OVERLAP_REASON));

  const touching = evaluateAvailability(
    { date: '2026-06-06', startTime: '15:40', endTime: '16:30' },
    [afternoon],
    settings,
    undefined,
    'fresh',
  );
  assert.equal(touching.result, 'appears_available');

  const bufferedRequest = evaluateAvailability(
    { date: '2026-06-06', startTime: '15:20', endTime: '16:00' },
    [afternoon],
    settings,
    undefined,
    'fresh',
  );
  assert.equal(bufferedRequest.result, 'unavailable');

  const nearOtherVenue = evaluateAvailability(
    { date: '2026-06-06', startTime: '12:30', endTime: '13:30', venue: venueRef('400 Higuera Street, San Luis Obispo') },
    [googleBusy('morning', '2026-06-06T17:00:00.000Z', '2026-06-06T18:00:00.000Z')],
    settings,
    undefined,
    'fresh',
  );
  assert.equal(nearOtherVenue.result, 'appears_available');
});

test('an all-day Google event blocks that span and not the next day, including the short spring-forward day', () => {
  const summer = googleBusy('all', '2026-06-06T07:00:00.000Z', '2026-06-07T07:00:00.000Z');
  assert.equal(summer.allDay, true);
  assert.equal(
    evaluateAvailability({ date: '2026-06-06', startTime: '16:00', endTime: '17:00' }, [summer], settings).result,
    'unavailable',
  );
  assert.ok(
    evaluateAvailability({ date: '2026-06-06', startTime: '16:00', endTime: '17:00' }, [summer], settings).reasons.includes(
      GOOGLE_ALL_DAY_REASON,
    ),
  );
  assert.equal(
    evaluateAvailability({ date: '2026-06-07', startTime: '16:00', endTime: '17:00' }, [summer], settings).result,
    'appears_available',
  );

  const spring = googleBusy('spring', '2026-03-08T08:00:00.000Z', '2026-03-09T07:00:00.000Z');
  assert.equal(spring.allDay, true);
  assert.equal(spring.endMs! - spring.startMs!, 23 * 60 * 60 * 1000);
  assert.equal(
    evaluateAvailability({ date: '2026-03-08', startTime: '10:00', endTime: '11:00' }, [spring], settings).result,
    'unavailable',
  );
  assert.equal(
    evaluateAvailability({ date: '2026-03-09', startTime: '10:00', endTime: '11:00' }, [spring], settings).result,
    'appears_available',
  );

  const duringGap = googleBusy('gap', '2026-03-08T09:30:00.000Z', '2026-03-08T10:30:00.000Z');
  assert.equal(duringGap.allDay, false);
  assert.equal(
    evaluateAvailability({ date: '2026-03-08', startTime: '04:00', endTime: '05:00' }, [duringGap], settings).result,
    'appears_available',
  );
  assert.equal(
    evaluateAvailability({ date: '2026-03-08', startTime: '00:30', endTime: '01:45' }, [duringGap], settings).result,
    'unavailable',
  );

  const fall = googleBusy('fall', '2026-11-01T07:00:00.000Z', '2026-11-02T08:00:00.000Z');
  assert.equal(fall.allDay, true);
  assert.equal(fall.endMs! - fall.startMs!, 25 * 60 * 60 * 1000);
  const firstHour = googleBusy('first', '2026-11-01T08:30:00.000Z', '2026-11-01T09:00:00.000Z');
  assert.equal(
    evaluateAvailability({ date: '2026-11-01', startTime: '15:00', endTime: '16:00' }, [firstHour], settings).result,
    'appears_available',
  );
  assert.equal(
    evaluateAvailability({ date: '2026-11-01', startTime: '00:30', endTime: '02:00' }, [firstHour], settings).result,
    'unavailable',
  );
  assert.equal(
    evaluateAvailability({ date: '2026-11-02', startTime: '10:00', endTime: '11:00' }, [fall], settings).result,
    'appears_available',
  );
});

test('stale or disconnected Google data cannot be called available', () => {
  const clear = { date: '2026-06-06', startTime: '16:00', endTime: '17:00' };
  const stale = evaluateAvailability(clear, [], settings, undefined, 'stale');
  assert.equal(stale.result, 'requires_manual_confirmation');
  assert.ok(stale.reasons.includes(GOOGLE_STALE_REASON));

  const disconnected = evaluateAvailability(clear, [], settings, undefined, 'disconnected');
  assert.equal(disconnected.result, 'requires_manual_confirmation');
  assert.ok(disconnected.reasons.includes(GOOGLE_DISCONNECTED_REASON));

  const staleConflict = evaluateAvailability(
    { date: '2026-06-06', startTime: '14:30', endTime: '15:00' },
    [googleBusy('busy', '2026-06-06T21:00:00.000Z', '2026-06-06T22:00:00.000Z')],
    settings,
    undefined,
    'stale',
  );
  assert.equal(staleConflict.result, 'unavailable');

  const now = Date.parse('2026-06-06T20:00:00.000Z');
  assert.equal(externalCalendarState({ status: 'connected', busy_synced_at: new Date(now - BUSY_MAX_AGE_MS).toISOString() }, now), 'fresh');
  assert.equal(
    externalCalendarState({ status: 'connected', busy_synced_at: new Date(now - BUSY_MAX_AGE_MS - 1).toISOString() }, now),
    'stale',
  );
  assert.equal(externalCalendarState({ status: 'reconnect_required', busy_synced_at: new Date(now).toISOString() }, now), 'disconnected');
  assert.equal(externalCalendarState(null, now), 'disconnected');
  assert.deepEqual(
    publicExternalOccupancies('disconnected', [{ id: 'x', starts_at: '2026-06-06T21:00:00.000Z', ends_at: '2026-06-06T22:00:00.000Z' }]),
    [],
  );
  assert.equal(
    publicExternalOccupancies('stale', [{ id: 'x', starts_at: '2026-06-06T21:00:00.000Z', ends_at: '2026-06-06T22:00:00.000Z' }]).length,
    1,
  );
});
