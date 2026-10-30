import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { bookingEventPayload } from '../google/events';
import { bookingToOccupancy } from './availability';
import {
  ARCHIVE_BLOCKED_MESSAGE,
  CANCELLED_EVENT_TITLE,
  COMPLETED_BLOCKS_LOST_MESSAGE,
  CONFIRM_NEEDS_DATE_MESSAGE,
  HARD_DELETE_MESSAGE,
  MISSING_TIME_MESSAGE,
  OVERLAP_MESSAGE,
  RESTORE_CANCELLED_BEFORE_CONFIRM_MESSAGE,
  TRAVEL_MESSAGE,
  archiveDecision,
  bookingConflictReason,
  cancelledBookingDoesNotBlock,
  googleSyncOperation,
  leadStatusBlockedMessage,
  leadStatusChangeDecision,
  planCancel,
  planConfirm,
  planRestore,
  syncedLeadStatus,
  type BookingWindowInput,
  type ScheduleBuffers,
} from './booking-status';

const buffers: ScheduleBuffers = {
  setupBufferMinutes: 30,
  breakdownBufferMinutes: 15,
  travelBufferMinutes: 90,
};

function booking(partial: Partial<BookingWindowInput> & Pick<BookingWindowInput, 'id' | 'status'>): BookingWindowInput {
  return {
    eventDate: '2026-06-06',
    startTime: '14:00',
    endTime: '15:00',
    venueName: 'Mission',
    venueAddress: '100 Madonna Road, San Luis Obispo',
    ...partial,
  };
}

test('confirming a booking sets the lead to Confirmed and rejects an overlap', () => {
  const other = booking({ id: 'held', status: 'Confirmed' });
  const clear = planConfirm({
    candidate: booking({ id: 'new', status: 'Tentative', startTime: '18:00', endTime: '19:00', venueAddress: '100 Madonna Road, San Luis Obispo' }),
    others: [other],
    settings: buffers,
  });
  assert.equal(clear.ok, true);
  if (clear.ok) {
    assert.equal(clear.bookingStatus, 'Confirmed');
    assert.equal(clear.leadStatus, 'Confirmed');
  }

  const overlap = planConfirm({
    candidate: booking({ id: 'new', status: 'Tentative', startTime: '15:00', endTime: '16:00' }),
    others: [other],
    settings: buffers,
  });
  assert.deepEqual(overlap, { ok: false, error: OVERLAP_MESSAGE });
});

test('a tentative hold on the same musician blocks confirm, and a cancelled booking does not', () => {
  const tentative = bookingConflictReason(
    booking({ id: 'new', status: 'Confirmed', startTime: '14:30', endTime: '15:30' }),
    [booking({ id: 'hold', status: 'Tentative' })],
    buffers,
  );
  assert.equal(tentative, OVERLAP_MESSAGE);

  const cancelled = bookingConflictReason(
    booking({ id: 'new', status: 'Confirmed' }),
    [booking({ id: 'old', status: 'Cancelled' })],
    buffers,
  );
  assert.equal(cancelled, null);
  assert.equal(
    cancelledBookingDoesNotBlock({
      id: 'old',
      status: 'Cancelled',
      event_date: '2026-06-06',
      performance_start_time: '14:00',
      performance_end_time: '15:00',
    }),
    true,
  );
  assert.equal(bookingToOccupancy({
    id: 'old',
    status: 'Cancelled',
    event_date: '2026-06-06',
    performance_start_time: '14:00',
    performance_end_time: '15:00',
  }), null);
});

test('travel time between different street addresses is rejected, and the same address is not', () => {
  const candidate = booking({
    id: 'new',
    status: 'Confirmed',
    startTime: '16:00',
    endTime: '17:00',
    venueAddress: '200 Higuera Street, San Luis Obispo',
  });
  const earlier = booking({ id: 'held', status: 'Confirmed' });
  assert.equal(bookingConflictReason(candidate, [earlier], buffers), TRAVEL_MESSAGE);
  assert.equal(
    bookingConflictReason(
      { ...candidate, venueAddress: '100 Madonna Road, San Luis Obispo' },
      [earlier],
      buffers,
    ),
    null,
  );
});

test('confirm requires a usable time when another booking is already on that date', () => {
  const reason = bookingConflictReason(
    booking({ id: 'new', status: 'Confirmed', startTime: null, endTime: null }),
    [booking({ id: 'held', status: 'Confirmed', startTime: null, endTime: null })],
    buffers,
  );
  assert.equal(reason, MISSING_TIME_MESSAGE);
});

test('cancelling keeps the timeline, frees the calendar, and moves the lead to Lost', () => {
  const plan = planCancel({
    previousLeadStatus: 'Confirmed',
    otherBookingStatuses: [],
    reason: '  Couple moved the date  ',
    existingEventIds: ['inquiry-1', 'note-2'],
  });
  assert.equal(plan.bookingStatus, 'Cancelled');
  assert.equal(plan.cancelReason, 'Couple moved the date');
  assert.equal(plan.leadStatus, 'Lost');
  assert.equal(plan.timelineTitle, CANCELLED_EVENT_TITLE);
  assert.deepEqual(plan.keptEventIds, ['inquiry-1', 'note-2']);
  assert.equal(plan.googleOperation, 'delete');
  assert.equal(googleSyncOperation('Cancelled'), 'delete');
  assert.equal(googleSyncOperation('Confirmed'), 'upsert');
  assert.equal(
    bookingEventPayload({
      id: '11111111-1111-4111-8111-111111111111',
      status: 'Cancelled',
      eventDate: '2026-06-06',
      startTime: '14:00',
      endTime: '15:00',
      venueName: null,
      venueAddress: null,
      serviceType: 'Ceremony',
      clientName: 'Alex',
    }),
    null,
  );
});

test('lead status follows the bookings that are still on the calendar', () => {
  assert.equal(syncedLeadStatus({ bookingStatuses: ['Confirmed'], previousLeadStatus: 'Quote Sent' }), 'Confirmed');
  assert.equal(syncedLeadStatus({ bookingStatuses: ['Completed'], previousLeadStatus: 'Confirmed' }), 'Completed');
  assert.equal(
    syncedLeadStatus({ bookingStatuses: ['Tentative'], previousLeadStatus: 'Quote Sent' }),
    'Quote Sent',
  );
  assert.equal(
    syncedLeadStatus({ bookingStatuses: ['Tentative'], previousLeadStatus: 'Lost', preferredPipelineStatus: 'Quote Sent' }),
    'Quote Sent',
  );
  assert.equal(syncedLeadStatus({ bookingStatuses: [], previousLeadStatus: 'Confirmed' }), 'Lost');
  assert.equal(
    planCancel({ previousLeadStatus: 'Confirmed', otherBookingStatuses: ['Confirmed'] }).leadStatus,
    'Confirmed',
  );
  assert.equal(
    planCancel({ previousLeadStatus: 'Quote Sent', otherBookingStatuses: ['Completed'] }).leadStatus,
    'Completed',
  );
});

test('archive is blocked while a booking is still active, and a pipeline status cannot disagree with a confirmed booking', () => {
  assert.deepEqual(archiveDecision(['Tentative']), { ok: false, error: ARCHIVE_BLOCKED_MESSAGE });
  assert.deepEqual(archiveDecision(['Confirmed']), { ok: false, error: ARCHIVE_BLOCKED_MESSAGE });
  assert.deepEqual(archiveDecision(['Completed']), { ok: true });
  assert.deepEqual(archiveDecision(['Cancelled']), { ok: true });

  const blocked = leadStatusChangeDecision({
    nextLeadStatus: 'Quote Sent',
    bookingStatuses: ['Confirmed'],
    hasEventDate: true,
  });
  assert.deepEqual(blocked, { ok: false, error: leadStatusBlockedMessage('Confirmed', 'Quote Sent') });

  const lost = leadStatusChangeDecision({
    nextLeadStatus: 'Lost',
    bookingStatuses: ['Completed'],
    hasEventDate: true,
  });
  assert.deepEqual(lost, { ok: false, error: COMPLETED_BLOCKS_LOST_MESSAGE });

  const needsDate = leadStatusChangeDecision({
    nextLeadStatus: 'Confirmed',
    bookingStatuses: [],
    hasEventDate: false,
  });
  assert.deepEqual(needsDate, { ok: false, error: CONFIRM_NEEDS_DATE_MESSAGE });

  const restoreFirst = leadStatusChangeDecision({
    nextLeadStatus: 'Confirmed',
    bookingStatuses: ['Cancelled'],
    hasEventDate: true,
  });
  assert.deepEqual(restoreFirst, { ok: false, error: RESTORE_CANCELLED_BEFORE_CONFIRM_MESSAGE });
});

test('restore rechecks the calendar and puts the lead back with the booking', () => {
  const blocked = planRestore({
    statusBeforeCancel: 'Confirmed',
    leadStatusBeforeCancel: 'Quote Sent',
    currentLeadStatus: 'Lost',
    candidate: booking({ id: 'mine', status: 'Cancelled' }),
    others: [booking({ id: 'other', status: 'Confirmed' })],
    otherBookingStatuses: ['Confirmed'],
    settings: buffers,
  });
  assert.equal(blocked.ok, false);

  const restored = planRestore({
    statusBeforeCancel: 'Tentative',
    leadStatusBeforeCancel: 'Quote Sent',
    currentLeadStatus: 'Lost',
    candidate: booking({ id: 'mine', status: 'Cancelled', startTime: '18:00', endTime: '19:00' }),
    others: [],
    otherBookingStatuses: [],
    settings: buffers,
  });
  assert.deepEqual(restored, { ok: true, bookingStatus: 'Tentative', leadStatus: 'Quote Sent' });

  const reconfirmed = planRestore({
    statusBeforeCancel: 'Confirmed',
    leadStatusBeforeCancel: 'Confirmed',
    currentLeadStatus: 'Lost',
    candidate: booking({ id: 'mine', status: 'Cancelled', startTime: '18:00', endTime: '19:00' }),
    others: [],
    otherBookingStatuses: [],
    settings: buffers,
  });
  assert.deepEqual(reconfirmed, { ok: true, bookingStatus: 'Confirmed', leadStatus: 'Confirmed' });
});

test('migration 006 keeps the timeline, cancels instead of deleting, and matches these messages', () => {
  const sql = readFileSync(new URL('../../../supabase/migrations/006_booking_cancel_and_status_sync.sql', import.meta.url), 'utf8');
  for (const phrase of [
    OVERLAP_MESSAGE,
    TRAVEL_MESSAGE,
    MISSING_TIME_MESSAGE,
    ARCHIVE_BLOCKED_MESSAGE,
    COMPLETED_BLOCKS_LOST_MESSAGE,
    CONFIRM_NEEDS_DATE_MESSAGE,
    'Restore the booking before marking the lead confirmed.',
    CANCELLED_EVENT_TITLE,
    HARD_DELETE_MESSAGE,
    'This lead has a % booking. Cancel the booking before changing the lead to %.',
    'sync_booking_and_lead',
    'cancelled_at',
    'cancelled_by',
    'cancel_reason',
    'ON DELETE SET NULL',
    'DROP POLICY IF EXISTS "Admins can delete bookings"',
    "operation 'delete'",
    "RETURN 'Lost'",
    "RETURN 'Confirmed'",
  ]) {
    assert.equal(sql.includes(phrase), true, phrase);
  }
  assert.equal(sql.includes("status = 'cancelled'"), false);
});
