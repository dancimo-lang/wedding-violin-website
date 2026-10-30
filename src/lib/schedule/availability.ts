import {
  BUSINESS_TIME_ZONE,
  addCalendarDays,
  timeInput,
  venueRef,
  zonedClock,
  zonedWallTimeToUtc,
  type VenueRef,
} from './time';

export type PublicAvailability = 'appears_available' | 'unavailable' | 'requires_manual_confirmation';

export type ScheduleSettings = {
  setupBufferMinutes: number;
  breakdownBufferMinutes: number;
  travelBufferMinutes: number;
  performerCount: number;
};

export const DEFAULT_SCHEDULE_SETTINGS: ScheduleSettings = {
  setupBufferMinutes: 30,
  breakdownBufferMinutes: 15,
  travelBufferMinutes: 90,
  performerCount: 1,
};

export type OccupancyKind = 'confirmed' | 'tentative' | 'block' | 'external';

export type ExternalCalendarState = 'fresh' | 'stale' | 'unsynced' | 'disconnected';

export const BUSY_MAX_AGE_MS = 2 * 60 * 60 * 1000;

export const GOOGLE_STALE_REASON =
  'Google Calendar busy times are more than two hours old, so this needs you to confirm.';
export const GOOGLE_UNSYNCED_REASON =
  'Google Calendar busy times have not been read yet, so this needs you to confirm.';
export const GOOGLE_DISCONNECTED_REASON =
  'Google Calendar is not connected, so this needs you to confirm.';
export const GOOGLE_OVERLAP_REASON = 'This overlaps a busy time on Google Calendar.';
export const GOOGLE_ALL_DAY_REASON = 'Google Calendar is busy across this whole day.';

export type Occupancy = {
  id: string;
  kind: OccupancyKind;
  allDay: boolean;
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  venue: VenueRef;
  performersNeeded: number;
  /** Absolute instants for Google busy periods. These are not expanded by setup or breakdown. */
  startMs?: number;
  endMs?: number;
};

export type AvailabilityRequest = {
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  venue?: VenueRef | null;
  excludeId?: string;
};

type TimedWindow = {
  startMs: number;
  endMs: number;
  venue: VenueRef;
  kind: Occupancy['kind'];
  allDay: boolean;
};

export type AvailabilityAssessment = {
  result: PublicAvailability;
  reasons: string[];
};

function clampSettings(settings: ScheduleSettings): ScheduleSettings {
  const clamp = (value: number, fallback: number) =>
    Number.isFinite(value) ? Math.max(0, Math.round(value)) : fallback;
  return {
    setupBufferMinutes: clamp(settings.setupBufferMinutes, DEFAULT_SCHEDULE_SETTINGS.setupBufferMinutes),
    breakdownBufferMinutes: clamp(settings.breakdownBufferMinutes, DEFAULT_SCHEDULE_SETTINGS.breakdownBufferMinutes),
    travelBufferMinutes: clamp(settings.travelBufferMinutes, DEFAULT_SCHEDULE_SETTINGS.travelBufferMinutes),
    performerCount: Math.max(1, Math.round(settings.performerCount || 1)),
  };
}

function overlaps(startA: number, endA: number, startB: number, endB: number) {
  return startA < endB && startB < endA;
}

function windowForOccupancy(
  occupancy: Occupancy,
  settings: ScheduleSettings,
  timeZone: string,
): TimedWindow | 'unreliable' | null {
  if (occupancy.kind === 'external') {
    if (occupancy.startMs == null || occupancy.endMs == null || occupancy.endMs <= occupancy.startMs) {
      return 'unreliable';
    }
    return {
      startMs: occupancy.startMs,
      endMs: occupancy.endMs,
      venue: { precision: 'none', key: null },
      kind: 'external',
      allDay: occupancy.allDay,
    };
  }

  if (occupancy.allDay) {
    const start = zonedWallTimeToUtc(occupancy.startDate, '00:00', timeZone);
    const end = zonedWallTimeToUtc(addCalendarDays(occupancy.endDate || occupancy.startDate, 1), '00:00', timeZone);
    if (!start.ok || !end.ok || end.utcMs <= start.utcMs) return 'unreliable';
    return {
      startMs: start.utcMs,
      endMs: end.utcMs,
      venue: { precision: 'none', key: null },
      kind: occupancy.kind,
      allDay: true,
    };
  }

  if (!occupancy.startTime || !occupancy.endTime) return 'unreliable';
  let endDate = occupancy.startDate;
  if (occupancy.endTime <= occupancy.startTime) endDate = addCalendarDays(occupancy.startDate, 1);
  const start = zonedWallTimeToUtc(occupancy.startDate, occupancy.startTime, timeZone);
  const end = zonedWallTimeToUtc(endDate, occupancy.endTime, timeZone);
  if (!start.ok || !end.ok || end.utcMs <= start.utcMs) return 'unreliable';

  const setup = occupancy.kind === 'block' ? 0 : settings.setupBufferMinutes;
  const breakdown = occupancy.kind === 'block' ? 0 : settings.breakdownBufferMinutes;
  return {
    startMs: start.utcMs - setup * 60_000,
    endMs: end.utcMs + breakdown * 60_000,
    venue: occupancy.venue,
    kind: occupancy.kind,
    allDay: false,
  };
}

function travelVerdict(request: VenueRef, other: VenueRef, gapMinutes: number, travelBufferMinutes: number) {
  if (gapMinutes >= travelBufferMinutes) return 'ok' as const;
  if (
    request.precision === 'address' &&
    other.precision === 'address' &&
    request.key &&
    other.key &&
    request.key === other.key
  ) {
    return 'ok' as const;
  }
  if (request.key && other.key && request.key === other.key) return 'ok' as const;
  if (request.precision === 'address' && other.precision === 'address' && request.key !== other.key) {
    return 'hard' as const;
  }
  return 'soft' as const;
}

export function rosterWarning(performersNeeded: number, settings: ScheduleSettings): string | null {
  const needed = Math.round(performersNeeded);
  if (!Number.isFinite(needed) || needed < 1) return null;
  if (needed > clampSettings(settings).performerCount) {
    return `This event needs ${needed} musicians, and the roster is set to ${clampSettings(settings).performerCount}.`;
  }
  return null;
}

export function externalCalendarState(
  connection: { status?: string | null; busy_synced_at?: string | null } | null | undefined,
  now = Date.now(),
): ExternalCalendarState {
  if (!connection || connection.status !== 'connected') return 'disconnected';
  const synced = connection.busy_synced_at ? Date.parse(connection.busy_synced_at) : Number.NaN;
  if (!Number.isFinite(synced)) return 'unsynced';
  if (now - synced > BUSY_MAX_AGE_MS) return 'stale';
  return 'fresh';
}

export function evaluateAvailability(
  request: AvailabilityRequest,
  occupancies: Occupancy[],
  rawSettings: ScheduleSettings,
  timeZone = BUSINESS_TIME_ZONE,
  externalCalendar: ExternalCalendarState = 'fresh',
): AvailabilityAssessment {
  const settings = clampSettings(rawSettings);
  const reasons: string[] = [];
  let hard = false;
  let soft = false;

  const mark = (level: 'hard' | 'soft', reason: string) => {
    if (level === 'hard') hard = true;
    else soft = true;
    if (!reasons.includes(reason)) reasons.push(reason);
  };

  if (!/^\d{4}-\d{2}-\d{2}$/.test(request.date)) {
    return {
      result: 'requires_manual_confirmation',
      reasons: ['The date is not valid.'],
    };
  }

  if (externalCalendar === 'stale') mark('soft', GOOGLE_STALE_REASON);
  if (externalCalendar === 'unsynced') mark('soft', GOOGLE_UNSYNCED_REASON);
  if (externalCalendar === 'disconnected') mark('soft', GOOGLE_DISCONNECTED_REASON);

  const others = occupancies.filter((occupancy) => occupancy.id !== request.excludeId);
  const startTime = timeInput(request.startTime);
  const endTime = timeInput(request.endTime);
  const requestVenue = request.venue || { precision: 'none' as const, key: null };

  let requestWindow: TimedWindow | null = null;
  if (!startTime) {
    mark('soft', 'No start time was given, so only a clear day can appear available.');
  } else if (!endTime) {
    mark('soft', 'An end time is needed before this time can be confirmed.');
  } else {
    let endDate = request.date;
    if (endTime <= startTime) endDate = addCalendarDays(request.date, 1);
    const start = zonedWallTimeToUtc(request.date, startTime, timeZone);
    const end = zonedWallTimeToUtc(endDate, endTime, timeZone);
    if (!start.ok || !end.ok) {
      let issue: 'gap' | 'ambiguous' | 'invalid' = 'invalid';
      if (!start.ok) issue = start.issue;
      else if (!end.ok) issue = end.issue;
      mark(
        'soft',
        issue === 'gap'
          ? 'That clock time does not exist on this daylight-saving date.'
          : 'That clock time happens twice on this daylight-saving date.',
      );
    } else if (end.utcMs <= start.utcMs) {
      mark('soft', 'The end time is not after the start time.');
    } else {
      requestWindow = {
        startMs: start.utcMs - settings.setupBufferMinutes * 60_000,
        endMs: end.utcMs + settings.breakdownBufferMinutes * 60_000,
        venue: requestVenue,
        kind: 'confirmed',
        allDay: false,
      };
    }
  }

  for (const occupancy of others) {
    const timed = windowForOccupancy(occupancy, settings, timeZone);
    const level = occupancy.kind === 'tentative' ? 'soft' : 'hard';

    if (timed === 'unreliable') {
      if (occupancy.startDate === request.date || occupancy.endDate === request.date) {
        mark('soft', 'Something already on this date has no usable start and end time.');
      }
      continue;
    }
    if (!timed) continue;

    const coversDay =
      occupancy.allDay && occupancy.startDate <= request.date && occupancy.endDate >= request.date;
    if (coversDay) {
      if (occupancy.kind === 'external') mark('hard', GOOGLE_ALL_DAY_REASON);
      else mark(level, level === 'hard' ? 'This date is blocked for the whole day.' : 'This date has an all-day hold.');
      continue;
    }

    if (!requestWindow) continue;
    if (overlaps(requestWindow.startMs, requestWindow.endMs, timed.startMs, timed.endMs)) {
      if (occupancy.kind === 'external') {
        mark('hard', GOOGLE_OVERLAP_REASON);
      } else {
        mark(
          level,
          level === 'hard'
            ? 'This overlaps a confirmed event or a blocked time, including setup and breakdown.'
            : 'This overlaps a tentative hold, including setup and breakdown.',
        );
      }
      continue;
    }

    if (occupancy.kind === 'block' || occupancy.kind === 'external' || timed.allDay) continue;
    const gapMinutes =
      requestWindow.endMs <= timed.startMs
        ? (timed.startMs - requestWindow.endMs) / 60_000
        : timed.endMs <= requestWindow.startMs
          ? (requestWindow.startMs - timed.endMs) / 60_000
          : null;
    if (gapMinutes == null) continue;
    const travel = travelVerdict(requestVenue, timed.venue, gapMinutes, settings.travelBufferMinutes);
    if (travel === 'hard') {
      mark('hard', 'There is not enough travel time between these venues.');
    } else if (travel === 'soft') {
      mark('soft', 'Travel time cannot be verified for another event near this one.');
    }
  }

  if (!startTime && !hard && externalCalendar === 'fresh') {
    const anything = others.some(
      (occupancy) => occupancy.startDate <= request.date && occupancy.endDate >= request.date,
    );
    if (!anything) {
      return { result: 'appears_available', reasons: [] };
    }
  }

  if (hard) return { result: 'unavailable', reasons };
  if (soft) return { result: 'requires_manual_confirmation', reasons };
  return { result: 'appears_available', reasons: [] };
}

type BookingRow = {
  id: string;
  status: string;
  event_date: string;
  performance_start_time?: string | null;
  performance_end_time?: string | null;
  venue_name?: string | null;
  venue_address?: string | null;
  performers_needed?: number | null;
};

type BlockRow = {
  id: string;
  block_type: string;
  start_date: string;
  end_date: string;
  start_time?: string | null;
  end_time?: string | null;
  all_day?: boolean | null;
};

export function bookingToOccupancy(row: BookingRow): Occupancy | null {
  if (row.status === 'Cancelled') return null;
  if (row.status !== 'Tentative' && row.status !== 'Confirmed' && row.status !== 'Completed') return null;
  const startTime = timeInput(row.performance_start_time);
  const endTime = timeInput(row.performance_end_time);
  const endDate =
    startTime && endTime && endTime <= startTime ? addCalendarDays(row.event_date, 1) : row.event_date;
  return {
    id: row.id,
    kind: row.status === 'Tentative' ? 'tentative' : 'confirmed',
    allDay: false,
    startDate: row.event_date,
    endDate,
    startTime,
    endTime,
    venue: venueRef(row.venue_address, row.venue_name),
    performersNeeded: row.performers_needed || 1,
  };
}

type ExternalBusyRow = {
  id: string;
  start_at?: string;
  end_at?: string;
  starts_at?: string;
  ends_at?: string;
};

export function externalBusyToOccupancy(
  row: ExternalBusyRow,
  timeZone = BUSINESS_TIME_ZONE,
): Occupancy | null {
  const startRaw = row.starts_at || row.start_at;
  const endRaw = row.ends_at || row.end_at;
  if (!startRaw || !endRaw) return null;
  const startMs = Date.parse(startRaw);
  const endMs = Date.parse(endRaw);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null;

  const startClock = zonedClock(startMs, timeZone);
  const endClock = zonedClock(endMs, timeZone);
  const lastMoment = zonedClock(endMs - 1, timeZone);
  const allDay = startClock.time === '00:00' && endClock.time === '00:00';
  return {
    id: row.id,
    kind: 'external',
    allDay,
    startDate: startClock.date,
    endDate: lastMoment.date,
    startTime: allDay ? null : startClock.time,
    endTime: allDay ? null : endClock.time === '00:00' ? '24:00' : endClock.time,
    venue: { precision: 'none', key: null },
    performersNeeded: 1,
    startMs,
    endMs,
  };
}

export function intervalOverlapsLocalDate(
  startMs: number,
  endMs: number,
  date: string,
  timeZone = BUSINESS_TIME_ZONE,
): boolean {
  const dayStart = zonedWallTimeToUtc(date, '00:00', timeZone);
  const dayEnd = zonedWallTimeToUtc(addCalendarDays(date, 1), '00:00', timeZone);
  if (!dayStart.ok || !dayEnd.ok) return false;
  return startMs < dayEnd.utcMs && dayStart.utcMs < endMs;
}

export function publicExternalOccupancies(
  state: ExternalCalendarState,
  rows: ExternalBusyRow[],
  timeZone = BUSINESS_TIME_ZONE,
): Occupancy[] {
  if (state === 'disconnected') return [];
  return rows.flatMap((row) => {
    const occupancy = externalBusyToOccupancy(row, timeZone);
    return occupancy ? [occupancy] : [];
  });
}

export function googleBusyChip(
  row: ExternalBusyRow,
  date: string,
  timeZone = BUSINESS_TIME_ZONE,
): { id: string; time: string; label: string } | null {
  const occupancy = externalBusyToOccupancy(row, timeZone);
  if (!occupancy || occupancy.startMs == null || occupancy.endMs == null) return null;
  if (!intervalOverlapsLocalDate(occupancy.startMs, occupancy.endMs, date, timeZone)) return null;
  let time = 'Busy';
  if (occupancy.allDay || (occupancy.startDate < date && occupancy.endDate > date)) time = 'All day';
  else if (occupancy.startDate === date && occupancy.endDate === date) time = `${occupancy.startTime}–${occupancy.endTime}`;
  else if (occupancy.startDate === date) time = `${occupancy.startTime} onward`;
  else if (occupancy.endDate === date) time = `until ${occupancy.endTime}`;
  return { id: row.id, time, label: 'Google Calendar' };
}

export function blockToOccupancy(row: BlockRow): Occupancy {
  const startTime = timeInput(row.start_time);
  const endTime = timeInput(row.end_time);
  const allDay = row.all_day !== false || !startTime || !endTime;
  return {
    id: row.id,
    kind: row.block_type === 'Tentative Hold' ? 'tentative' : 'block',
    allDay,
    startDate: row.start_date,
    endDate: row.end_date || row.start_date,
    startTime: allDay ? null : startTime,
    endTime: allDay ? null : endTime,
    venue: { precision: 'none', key: null },
    performersNeeded: 1,
  };
}
