import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateAvailability, rosterWarning, type Occupancy, type ScheduleSettings } from './availability';
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
    startDate,
    endDate: startDate,
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
