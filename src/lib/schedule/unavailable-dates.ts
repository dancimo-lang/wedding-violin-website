import { addCalendarDays } from './time';

/**
 * Booking statuses that make a date unavailable on the public calendar.
 * Tentative bookings, leads, and inquiries do not block. One wedding per day,
 * so a blocking booking blocks the whole Pacific-time day.
 */
export const DATE_BLOCKING_STATUSES = ['Confirmed', 'Completed'] as const;

/** Manual admin blocks (admin Calendar page) that block the public calendar. 'Tentative Hold' does not. */
export const DATE_BLOCKING_BLOCK_TYPES = ['Unavailable', 'Personal'] as const;

export type DateBookingRow = { status: string; event_date: string };
export type DateBlockRow = { block_type: string; start_date: string; end_date: string | null };

function eachDate(from: string, to: string, add: (date: string) => void) {
  let date = from;
  for (let i = 0; date <= to && i < 800; i += 1) {
    add(date);
    date = addCalendarDays(date, 1);
  }
}

/** Unavailable Pacific dates (YYYY-MM-DD) in [from, to]. Google Calendar busy times are intentionally not used. */
export function computeUnavailableDates(
  from: string,
  to: string,
  bookings: DateBookingRow[],
  blocks: DateBlockRow[],
): string[] {
  const out = new Set<string>();
  const add = (date: string) => {
    if (date >= from && date <= to) out.add(date);
  };
  for (const row of bookings) {
    if ((DATE_BLOCKING_STATUSES as readonly string[]).includes(row.status) && row.event_date) add(row.event_date);
  }
  for (const row of blocks) {
    if (!(DATE_BLOCKING_BLOCK_TYPES as readonly string[]).includes(row.block_type)) continue;
    const start = row.start_date < from ? from : row.start_date;
    const endRaw = row.end_date || row.start_date;
    eachDate(start, endRaw > to ? to : endRaw, add);
  }
  return [...out].sort();
}
