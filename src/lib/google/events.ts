import { addCalendarDays, timeInput, zonedWallTimeToUtc, BUSINESS_TIME_ZONE } from '@/lib/schedule/time';

export const WEBSITE_EVENT_SOURCE = 'danielcimo-website';
export const WEDDINGS_CALENDAR_SUMMARY = 'Weddings (website)';
const EVENT_ID_ALPHABET = '0123456789abcdefghijklmnopqrstuv';

export type Interval = { startMs: number; endMs: number };

export type GoogleEventWhen =
  | { date: string }
  | { dateTime: string; timeZone: string };

export type GoogleEventPayload = {
  id: string;
  summary: string;
  description: string;
  location?: string;
  start: GoogleEventWhen;
  end: GoogleEventWhen;
  extendedProperties: { private: { source: string; rowId: string } };
};

export type BookingSyncRow = {
  id: string;
  status: string;
  eventDate: string;
  startTime: string | null;
  endTime: string | null;
  venueName: string | null;
  venueAddress: string | null;
  serviceType: string;
  clientName: string | null;
  /** Partner's name from the client record, when saved. */
  partnerName?: string | null;
  /** Package name, when the booking has one. */
  packageName?: string | null;
  /** The booking's Special Requests text. Copied into the event notes. */
  specialRequests?: string | null;
  /** False for an existing booking the owner chose not to copy to Google. Never pushed. */
  googleSync?: boolean;
};

export type BlockSyncRow = {
  id: string;
  blockType: string;
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  allDay: boolean;
};

const SYNCED_BOOKING_STATUSES = new Set(['Tentative', 'Confirmed', 'Completed']);

export function googleEventId(rowId: string): string {
  const hex = rowId.replace(/-/g, '').toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(hex)) throw new Error('A calendar row id was not a UUID.');
  let bits = 0;
  let value = 0;
  let encoded = '';
  for (const byte of Buffer.from(hex, 'hex')) {
    value = value * 256 + byte;
    bits += 8;
    while (bits >= 5) {
      const shift = 2 ** (bits - 5);
      encoded += EVENT_ID_ALPHABET[Math.floor(value / shift) % 32];
      value %= shift;
      bits -= 5;
    }
  }
  if (bits > 0) encoded += EVENT_ID_ALPHABET[(value * 2 ** (5 - bits)) % 32];
  return `site${encoded}`;
}

export function bookingEventPayload(row: BookingSyncRow): GoogleEventPayload | null {
  if (row.googleSync === false) return null;
  if (!SYNCED_BOOKING_STATUSES.has(row.status)) return null;
  const startTime = timeInput(row.startTime);
  const endTime = timeInput(row.endTime);
  const who = clip(row.clientName || 'Booking', 80);
  const service = clip(row.serviceType || 'Performance', 80);
  const prefix = row.status === 'Tentative' ? 'Hold: ' : '';
  const location = clip([row.venueName, row.venueAddress].filter(Boolean).join(', '), 300);
  let start: GoogleEventWhen;
  let end: GoogleEventWhen;
  if (!startTime || !endTime) {
    start = { date: row.eventDate };
    end = { date: addCalendarDays(row.eventDate, 1) };
  } else {
    const endDate = endTime <= startTime ? addCalendarDays(row.eventDate, 1) : row.eventDate;
    start = { dateTime: `${row.eventDate}T${startTime}:00`, timeZone: BUSINESS_TIME_ZONE };
    end = { dateTime: `${endDate}T${endTime}:00`, timeZone: BUSINESS_TIME_ZONE };
  }
  return {
    id: googleEventId(row.id),
    summary: clip(`${prefix}${who} · ${service}`, 180),
    description: bookingEventDescription(row),
    ...(location ? { location } : {}),
    start,
    end,
    extendedProperties: { private: { source: WEBSITE_EVENT_SOURCE, rowId: row.id } },
  };
}

const DESCRIPTION_LIMIT = 7500;
const SPECIAL_REQUESTS_LIMIT = 6000;

/** Plain-text event notes: who, what, where, special requests, then the status line. */
export function bookingEventDescription(row: BookingSyncRow): string {
  const lines: string[] = [];
  const couple = [row.clientName, row.partnerName]
    .map((name) => (name || '').trim())
    .filter(Boolean)
    .join(' & ');
  if (couple) lines.push(`Couple: ${clip(couple, 200)}`);
  const service = (row.serviceType || '').trim();
  const pkg = (row.packageName || '').trim();
  if (service) lines.push(`Service: ${clip(service, 120)}`);
  if (pkg && pkg !== service) lines.push(`Package: ${clip(pkg, 120)}`);
  const venue = [row.venueName, row.venueAddress]
    .map((part) => (part || '').trim())
    .filter(Boolean)
    .join(', ');
  if (venue) lines.push(`Venue: ${clip(venue, 300)}`);
  const requests = (row.specialRequests || '').replace(/\r\n?/g, '\n').trim();
  if (requests) {
    if (lines.length) lines.push('');
    lines.push('Special requests:');
    lines.push(clipText(requests, SPECIAL_REQUESTS_LIMIT));
  }
  if (lines.length) lines.push('');
  lines.push(
    `Status: ${row.status}. Added by the website. Change this booking on the website so both calendars stay in step.`,
  );
  return clipText(lines.join('\n'), DESCRIPTION_LIMIT);
}

export function blockEventPayload(row: BlockSyncRow): GoogleEventPayload {
  const summary = clip(row.blockType || 'Unavailable', 80);
  const startTime = timeInput(row.startTime);
  const endTime = timeInput(row.endTime);
  const allDay = row.allDay || !startTime || !endTime;
  let start: GoogleEventWhen;
  let end: GoogleEventWhen;
  if (allDay) {
    const endDate = row.endDate && row.endDate >= row.startDate ? row.endDate : row.startDate;
    start = { date: row.startDate };
    end = { date: addCalendarDays(endDate, 1) };
  } else {
    const endDate = endTime! <= startTime! ? addCalendarDays(row.startDate, 1) : row.startDate;
    start = { dateTime: `${row.startDate}T${startTime}:00`, timeZone: BUSINESS_TIME_ZONE };
    end = { dateTime: `${endDate}T${endTime}:00`, timeZone: BUSINESS_TIME_ZONE };
  }
  return {
    id: googleEventId(row.id),
    summary,
    description: 'Blocked on the website calendar.',
    start,
    end,
    extendedProperties: { private: { source: WEBSITE_EVENT_SOURCE, rowId: row.id } },
  };
}

export function subtractIntervals(busy: Interval[], remove: Interval[]): Interval[] {
  let current = busy.filter((interval) => interval.endMs > interval.startMs);
  for (const cut of remove) {
    if (cut.endMs <= cut.startMs) continue;
    const next: Interval[] = [];
    for (const span of current) {
      if (cut.endMs <= span.startMs || cut.startMs >= span.endMs) {
        next.push(span);
        continue;
      }
      if (cut.startMs > span.startMs) next.push({ startMs: span.startMs, endMs: cut.startMs });
      if (cut.endMs < span.endMs) next.push({ startMs: cut.endMs, endMs: span.endMs });
    }
    current = next;
  }
  return current;
}

type FreeBusyCalendar = {
  busy?: { start?: string; end?: string }[];
  errors?: { reason?: string }[];
};

export class FreeBusyReadError extends Error {
  readonly reason: string | null;

  constructor(message: string, reason: string | null = null) {
    super(message);
    this.name = 'FreeBusyReadError';
    this.reason = reason;
  }
}

function calendarErrorReason(error: { reason?: string } | undefined): string | null {
  const reason = error?.reason;
  if (!reason || !/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(reason)) return null;
  return reason;
}

export function parseFreeBusy(body: unknown): Interval[] {
  if (!body || typeof body !== 'object' || !('calendars' in body)) {
    throw new FreeBusyReadError('Google busy times were not readable.');
  }
  const calendars = (body as { calendars?: unknown }).calendars;
  if (!calendars || typeof calendars !== 'object') throw new FreeBusyReadError('Google busy times were not readable.');
  const entries = Object.values(calendars as Record<string, FreeBusyCalendar>);
  if (entries.length === 0) throw new FreeBusyReadError('Google busy times were not readable.');
  const intervals: Interval[] = [];
  for (const calendar of entries) {
    if (calendar?.errors && calendar.errors.length > 0) {
      throw new FreeBusyReadError(
        'Google could not read busy times for a calendar.',
        calendarErrorReason(calendar.errors[0]),
      );
    }
    for (const busy of calendar?.busy || []) {
      const startMs = Date.parse(busy.start || '');
      const endMs = Date.parse(busy.end || '');
      if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) continue;
      intervals.push({ startMs, endMs });
    }
  }
  return intervals;
}

type GoogleEventTime = {
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
};

export function eventToInterval(event: GoogleEventTime, timeZone = BUSINESS_TIME_ZONE): Interval | null {
  if (event.start?.dateTime && event.end?.dateTime) {
    const startMs = Date.parse(event.start.dateTime);
    const endMs = Date.parse(event.end.dateTime);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null;
    return { startMs, endMs };
  }
  if (event.start?.date && event.end?.date) {
    const start = zonedWallTimeToUtc(event.start.date, '00:00', timeZone);
    const end = zonedWallTimeToUtc(event.end.date, '00:00', timeZone);
    if (!start.ok || !end.ok || end.utcMs <= start.utcMs) return null;
    return { startMs: start.utcMs, endMs: end.utcMs };
  }
  return null;
}

export function busyPullWindow(now: Date): { timeMin: string; timeMax: string } {
  const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const end = new Date(now.getTime() + 730 * 24 * 60 * 60 * 1000);
  return { timeMin: start.toISOString(), timeMax: end.toISOString() };
}

/**
 * Google's freeBusy method rejects a single query longer than about 90 days
 * with HTTP 400 timeRangeTooLong. Stay under that limit.
 */
export const FREEBUSY_MAX_RANGE_MS = 89 * 24 * 60 * 60 * 1000;

export function chunkTimeRange(
  timeMin: string,
  timeMax: string,
  maxSpanMs = FREEBUSY_MAX_RANGE_MS,
): { timeMin: string; timeMax: string }[] {
  const start = Date.parse(timeMin);
  const end = Date.parse(timeMax);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || maxSpanMs <= 0) {
    throw new FreeBusyReadError('Google busy times were not readable.');
  }
  const chunks: { timeMin: string; timeMax: string }[] = [];
  for (let cursor = start; cursor < end; ) {
    const chunkEnd = Math.min(cursor + maxSpanMs, end);
    chunks.push({ timeMin: new Date(cursor).toISOString(), timeMax: new Date(chunkEnd).toISOString() });
    cursor = chunkEnd;
  }
  return chunks;
}

/** Like clip, but keeps line breaks (for multi-line notes). */
function clipText(value: string, max: number): string {
  const trimmed = value
    .split('\n')
    .map((line) => line.replace(/[^\S\n]+/g, ' ').trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, Math.max(1, max - 1))}…`;
}

function clip(value: string, max: number): string {
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, Math.max(1, max - 1))}…`;
}
