export const BUSINESS_TIME_ZONE = 'America/Los_Angeles';

export type WallTimeIssue = 'invalid' | 'gap' | 'ambiguous';

export type WallTimeResult =
  | { ok: true; utcMs: number }
  | { ok: false; issue: WallTimeIssue };

type ClockParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function readParts(instant: Date, timeZone: string): ClockParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const values: Record<string, string> = {};
  for (const part of formatter.formatToParts(instant)) {
    if (part.type !== 'literal') values[part.type] = part.value;
  }
  let hour = Number(values.hour);
  if (hour === 24) hour = 0;
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour,
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function sameMinute(parts: ClockParts, year: number, month: number, day: number, hour: number, minute: number) {
  return (
    parts.year === year &&
    parts.month === month &&
    parts.day === day &&
    parts.hour === hour &&
    parts.minute === minute &&
    parts.second === 0
  );
}

export function zonedWallTimeToUtc(
  date: string,
  time: string,
  timeZone = BUSINESS_TIME_ZONE,
): WallTimeResult {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(time);
  if (!dateMatch || !timeMatch) return { ok: false, issue: 'invalid' };

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) {
    return { ok: false, issue: 'invalid' };
  }

  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  const offsetAt = (utcMs: number) => {
    const parts = readParts(new Date(utcMs), timeZone);
    const localAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    return localAsUtc - utcMs;
  };

  const first = wallAsUtc - offsetAt(wallAsUtc);
  const second = wallAsUtc - offsetAt(first);
  const candidates = [first, second, first - 3_600_000, first + 3_600_000, second - 3_600_000, second + 3_600_000];
  const matches: number[] = [];
  for (const candidate of candidates) {
    if (!Number.isFinite(candidate)) continue;
    if (matches.includes(candidate)) continue;
    if (sameMinute(readParts(new Date(candidate), timeZone), year, month, day, hour, minute)) {
      matches.push(candidate);
    }
  }

  if (matches.length === 1) return { ok: true, utcMs: matches[0] };
  if (matches.length === 0) return { ok: false, issue: 'gap' };
  return { ok: false, issue: 'ambiguous' };
}

export function addCalendarDays(isoDate: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return isoDate;
  const utc = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
  return utc.toISOString().slice(0, 10);
}

export function todayInTimeZone(timeZone = BUSINESS_TIME_ZONE, now = new Date()): string {
  const parts = readParts(now, timeZone);
  const month = String(parts.month).padStart(2, '0');
  const day = String(parts.day).padStart(2, '0');
  return `${parts.year}-${month}-${day}`;
}

export function monthGrid(year: number, month: number): string[] {
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const first = `${year}-${String(month).padStart(2, '0')}-01`;
  const start = addCalendarDays(first, -firstDow);
  return Array.from({ length: 42 }, (_, index) => addCalendarDays(start, index));
}

export function laLocalInputToUtc(value: string): WallTimeResult {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value);
  if (!match) return { ok: false, issue: 'invalid' };
  return zonedWallTimeToUtc(match[1], match[2]);
}

export type VenueRef = {
  precision: 'address' | 'name' | 'none';
  key: string | null;
};

export function venueRef(address?: string | null, name?: string | null): VenueRef {
  const addressText = normalizePlace(address);
  if (addressText) return { precision: 'address', key: addressText };
  const nameText = normalizePlace(name);
  if (nameText) return { precision: 'name', key: nameText };
  return { precision: 'none', key: null };
}

function normalizePlace(value?: string | null): string {
  return (value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function timeInput(value?: string | null): string | null {
  if (!value) return null;
  const match = /^(\d{2}:\d{2})/.exec(value);
  return match ? match[1] : null;
}
