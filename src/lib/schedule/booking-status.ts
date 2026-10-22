import { bookingToOccupancy } from './availability';
import {
  addCalendarDays,
  timeInput,
  venueRef,
  zonedWallTimeToUtc,
  type VenueRef,
} from './time';

/** Booking status values already stored on the bookings table. */
export const BOOKING_STATUSES = ['Tentative', 'Confirmed', 'Cancelled', 'Completed'] as const;

/** Lead status values already stored on the leads table. There is no separate "Cancelled" lead status. */
export const LEAD_STATUSES = [
  'New Inquiry',
  'Needs Information',
  'Quote Sent',
  'Awaiting Response',
  'Contract Sent',
  'Awaiting Retainer',
  'Confirmed',
  'Lost',
  'Completed',
] as const;

export const PIPELINE_LEAD_STATUSES = [
  'New Inquiry',
  'Needs Information',
  'Quote Sent',
  'Awaiting Response',
  'Contract Sent',
  'Awaiting Retainer',
] as const;

/** These booking statuses still occupy the musician. Cancelled does not. */
export const OCCUPYING_BOOKING_STATUSES = ['Tentative', 'Confirmed', 'Completed'] as const;

/** A lead with one of these cannot be archived until the booking is cancelled. Completed work can stay. */
export const ACTIVE_BOOKING_STATUSES = ['Tentative', 'Confirmed'] as const;

export const OVERLAP_MESSAGE =
  'That time overlaps another booking, including setup and breakdown. Cancel or move the other booking first.';
export const TRAVEL_MESSAGE =
  'There is not enough travel time between this booking and another one.';
export const MISSING_TIME_MESSAGE =
  'A start and end time are needed before this can be confirmed, because another booking is already on that date.';
export const ARCHIVE_BLOCKED_MESSAGE =
  'This lead has an active booking. Cancel the booking before archiving.';
export const COMPLETED_BLOCKS_LOST_MESSAGE =
  'This lead has a completed booking. Leave the lead as Completed, or cancel that booking first.';
export const CONFIRM_NEEDS_DATE_MESSAGE = 'Add an event date before confirming this lead.';
export const RESTORE_CANCELLED_BEFORE_CONFIRM_MESSAGE =
  "This lead's booking is cancelled. Restore the booking before marking the lead confirmed.";
export const RESTORE_CANCELLED_BEFORE_COMPLETE_MESSAGE =
  "This lead's booking is cancelled. Restore the booking before marking the lead completed.";
export const CANCELLED_EVENT_TITLE = 'Booking cancelled';
export const HARD_DELETE_MESSAGE = 'Bookings are cancelled, not deleted, so the timeline stays.';

export type ScheduleBuffers = {
  setupBufferMinutes: number;
  breakdownBufferMinutes: number;
  travelBufferMinutes: number;
};

export type BookingWindowInput = {
  id: string;
  status: string;
  eventDate: string;
  startTime?: string | null;
  endTime?: string | null;
  venueName?: string | null;
  venueAddress?: string | null;
};

export type StatusResult = { ok: true; leadStatus: string } | { ok: false; error: string };

export function isPipelineLeadStatus(status: string | null | undefined): boolean {
  return Boolean(status && (PIPELINE_LEAD_STATUSES as readonly string[]).includes(status));
}

export function bookingOccupiesCalendar(status: string): boolean {
  return (OCCUPYING_BOOKING_STATUSES as readonly string[]).includes(status);
}

/** Mirrors the Google outbox trigger: anything except an occupying booking is removed. */
export function googleSyncOperation(status: string): 'upsert' | 'delete' {
  return bookingOccupiesCalendar(status) ? 'upsert' : 'delete';
}

export function leadStatusBlockedMessage(bookingStatus: string, leadStatus: string): string {
  return `This lead has a ${bookingStatus.toLowerCase()} booking. Cancel the booking before changing the lead to ${leadStatus}.`;
}

/**
 * Lead status implied by the bookings that remain after a change.
 * Confirmed wins, then Completed. A tentative hold keeps a pipeline status.
 * No occupying booking maps to Lost, which is the existing lead vocabulary for a cancelled date.
 */
export function syncedLeadStatus(input: {
  bookingStatuses: string[];
  previousLeadStatus?: string | null;
  preferredPipelineStatus?: string | null;
}): string {
  if (input.bookingStatuses.includes('Confirmed')) return 'Confirmed';
  if (input.bookingStatuses.includes('Completed')) return 'Completed';
  if (input.bookingStatuses.includes('Tentative')) {
    const preferred = input.preferredPipelineStatus;
    if (isPipelineLeadStatus(preferred)) return preferred as string;
    if (isPipelineLeadStatus(input.previousLeadStatus)) return input.previousLeadStatus as string;
    return 'Awaiting Response';
  }
  return 'Lost';
}

export function archiveDecision(bookingStatuses: string[]): { ok: true } | { ok: false; error: string } {
  if (bookingStatuses.some((status) => (ACTIVE_BOOKING_STATUSES as readonly string[]).includes(status))) {
    return { ok: false, error: ARCHIVE_BLOCKED_MESSAGE };
  }
  return { ok: true };
}

export function leadStatusChangeDecision(input: {
  nextLeadStatus: string;
  bookingStatuses: string[];
  hasEventDate: boolean;
}): StatusResult | { ok: true; leadStatus: string; cancelOccupying: boolean; confirmBooking: boolean; completeBooking: boolean } {
  const occupying = input.bookingStatuses.filter((status) => status !== 'Cancelled');
  if (input.nextLeadStatus === 'Confirmed') {
    if (!input.hasEventDate) return { ok: false, error: CONFIRM_NEEDS_DATE_MESSAGE };
    if (occupying.length === 0 && input.bookingStatuses.includes('Cancelled')) {
      return { ok: false, error: RESTORE_CANCELLED_BEFORE_CONFIRM_MESSAGE };
    }
    return { ok: true, leadStatus: 'Confirmed', cancelOccupying: false, confirmBooking: true, completeBooking: false };
  }
  if (input.nextLeadStatus === 'Completed') {
    if (occupying.length === 0 && input.bookingStatuses.includes('Cancelled')) {
      return { ok: false, error: RESTORE_CANCELLED_BEFORE_COMPLETE_MESSAGE };
    }
    return { ok: true, leadStatus: 'Completed', cancelOccupying: false, confirmBooking: false, completeBooking: true };
  }
  if (input.nextLeadStatus === 'Lost') {
    if (input.bookingStatuses.includes('Completed')) {
      return { ok: false, error: COMPLETED_BLOCKS_LOST_MESSAGE };
    }
    return { ok: true, leadStatus: 'Lost', cancelOccupying: true, confirmBooking: false, completeBooking: false };
  }
  if (!(LEAD_STATUSES as readonly string[]).includes(input.nextLeadStatus)) {
    return { ok: false, error: 'That lead status is not one this site uses.' };
  }
  const blocking = occupying.find((status) => status === 'Confirmed' || status === 'Completed');
  if (blocking) return { ok: false, error: leadStatusBlockedMessage(blocking, input.nextLeadStatus) };
  return { ok: true, leadStatus: input.nextLeadStatus, cancelOccupying: false, confirmBooking: false, completeBooking: false };
}

export type CancelPlan = {
  bookingStatus: 'Cancelled';
  cancelReason: string | null;
  leadStatus: string;
  timelineTitle: typeof CANCELLED_EVENT_TITLE;
  keptEventIds: string[];
  googleOperation: 'delete';
};

export function planCancel(input: {
  previousLeadStatus: string | null;
  otherBookingStatuses: string[];
  reason?: string | null;
  existingEventIds?: string[];
}): CancelPlan {
  const reason = input.reason?.trim() || null;
  return {
    bookingStatus: 'Cancelled',
    cancelReason: reason,
    leadStatus: syncedLeadStatus({
      bookingStatuses: input.otherBookingStatuses,
      previousLeadStatus: input.previousLeadStatus,
    }),
    timelineTitle: CANCELLED_EVENT_TITLE,
    keptEventIds: input.existingEventIds || [],
    googleOperation: 'delete',
  };
}

function clampMinutes(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

function venueKey(address?: string | null, name?: string | null): VenueRef {
  return venueRef(address, name);
}

function performanceWindow(
  row: BookingWindowInput,
  settings: ScheduleBuffers,
): { startMs: number; endMs: number } | 'missing' | 'unusable' {
  const startTime = timeInput(row.startTime);
  const endTime = timeInput(row.endTime);
  if (!startTime || !endTime) return 'missing';
  const endDate = endTime <= startTime ? addCalendarDays(row.eventDate, 1) : row.eventDate;
  const start = zonedWallTimeToUtc(row.eventDate, startTime);
  const end = zonedWallTimeToUtc(endDate, endTime);
  if (!start.ok || !end.ok || end.utcMs <= start.utcMs) return 'unusable';
  return {
    startMs: start.utcMs - clampMinutes(settings.setupBufferMinutes) * 60_000,
    endMs: end.utcMs + clampMinutes(settings.breakdownBufferMinutes) * 60_000,
  };
}

/**
 * Hard conflict between this booking and another occupying booking.
 * Cancelled rows must be omitted by the caller; they do not block.
 * Tentative rows do block a confirm, so two events cannot share one musician.
 */
export function bookingConflictReason(
  candidate: BookingWindowInput,
  others: BookingWindowInput[],
  settings: ScheduleBuffers,
): string | null {
  const travel = clampMinutes(settings.travelBufferMinutes);
  const candidateWindow = performanceWindow(candidate, settings);
  if (candidateWindow === 'unusable') {
    return 'That clock time cannot be confirmed on this date.';
  }

  for (const other of others) {
    if (other.id === candidate.id) continue;
    if (!bookingOccupiesCalendar(other.status)) continue;
    const otherWindow = performanceWindow(other, settings);
    if (candidateWindow === 'missing' || otherWindow === 'missing') {
      if (other.eventDate === candidate.eventDate) return MISSING_TIME_MESSAGE;
      continue;
    }
    if (otherWindow === 'unusable') {
      if (other.eventDate === candidate.eventDate) return MISSING_TIME_MESSAGE;
      continue;
    }
    const overlaps = candidateWindow.startMs < otherWindow.endMs && otherWindow.startMs < candidateWindow.endMs;
    if (overlaps) return OVERLAP_MESSAGE;

    const gapMinutes =
      candidateWindow.endMs <= otherWindow.startMs
        ? (otherWindow.startMs - candidateWindow.endMs) / 60_000
        : otherWindow.endMs <= candidateWindow.startMs
          ? (candidateWindow.startMs - otherWindow.endMs) / 60_000
          : null;
    if (gapMinutes == null || gapMinutes >= travel) continue;
    const left = venueKey(candidate.venueAddress, candidate.venueName);
    const right = venueKey(other.venueAddress, other.venueName);
    if (left.precision === 'address' && right.precision === 'address' && left.key !== right.key) {
      return TRAVEL_MESSAGE;
    }
  }
  return null;
}

export function planConfirm(input: {
  candidate: BookingWindowInput;
  others: BookingWindowInput[];
  settings: ScheduleBuffers;
}): { ok: true; bookingStatus: 'Confirmed'; leadStatus: 'Confirmed' } | { ok: false; error: string } {
  const conflict = bookingConflictReason(
    { ...input.candidate, status: 'Confirmed' },
    input.others,
    input.settings,
  );
  if (conflict) return { ok: false, error: conflict };
  return { ok: true, bookingStatus: 'Confirmed', leadStatus: 'Confirmed' };
}

export function planRestore(input: {
  statusBeforeCancel: string | null;
  leadStatusBeforeCancel: string | null;
  currentLeadStatus: string | null;
  candidate: BookingWindowInput;
  others: BookingWindowInput[];
  otherBookingStatuses: string[];
  settings: ScheduleBuffers;
}): { ok: true; bookingStatus: string; leadStatus: string } | { ok: false; error: string } {
  const restored = (OCCUPYING_BOOKING_STATUSES as readonly string[]).includes(input.statusBeforeCancel || '')
    ? (input.statusBeforeCancel as string)
    : 'Tentative';
  const conflict = bookingConflictReason(
    { ...input.candidate, status: restored },
    input.others,
    input.settings,
  );
  if (conflict) return { ok: false, error: conflict };
  return {
    ok: true,
    bookingStatus: restored,
    leadStatus: syncedLeadStatus({
      bookingStatuses: [...input.otherBookingStatuses, restored],
      previousLeadStatus: input.currentLeadStatus,
      preferredPipelineStatus: input.leadStatusBeforeCancel,
    }),
  };
}

export function cancelledBookingDoesNotBlock(row: {
  id: string;
  status: string;
  event_date: string;
  performance_start_time?: string | null;
  performance_end_time?: string | null;
}): boolean {
  return bookingToOccupancy(row) === null && !bookingOccupiesCalendar(row.status);
}
