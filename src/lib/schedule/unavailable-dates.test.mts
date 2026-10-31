import assert from 'node:assert/strict';
import test from 'node:test';
import { computeUnavailableDates } from './unavailable-dates';

test('only Confirmed/Completed bookings and Unavailable/Personal blocks', () => {
  const dates = computeUnavailableDates(
    '2027-01-01',
    '2027-01-31',
    [
      { status: 'Confirmed', event_date: '2027-01-02' },
      { status: 'Completed', event_date: '2027-01-03' },
      { status: 'Tentative', event_date: '2027-01-04' },
      { status: 'Cancelled', event_date: '2027-01-05' },
    ],
    [
      { block_type: 'Unavailable', start_date: '2027-01-10', end_date: '2027-01-11' },
      { block_type: 'Personal', start_date: '2026-12-30', end_date: '2027-01-01' },
      { block_type: 'Tentative Hold', start_date: '2027-01-20', end_date: '2027-01-20' },
    ],
  );
  assert.deepEqual(dates, ['2027-01-01', '2027-01-02', '2027-01-03', '2027-01-10', '2027-01-11']);
});
