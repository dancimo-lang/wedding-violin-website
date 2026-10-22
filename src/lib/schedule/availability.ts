import {
  BUSINESS_TIME_ZONE,
  addCalendarDays,
  timeInput,
  venueRef,
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

export type Occupancy = {
  id: string;
  kind: 'confirmed' | 'tentative' | 'block';
  allDay: boolean;
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  venue: VenueRef;
  performersNeeded: number;
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

export function evaluateAvailability(
  request: AvailabilityRequest,
  occupancies: Occupancy[],
  rawSettings: ScheduleSettings,
  timeZone = BUSINESS_TIME_ZONE,
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
    const level = occupancy.kind === 'confirmed' || occupancy.kind === 'block' ? 'hard' : 'soft';

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
      mark(level, level === 'hard' ? 'This date is blocked for the whole day.' : 'This date has an all-day hold.');
      continue;
    }

    if (!requestWindow) continue;
    if (overlaps(requestWindow.startMs, requestWindow.endMs, timed.startMs, timed.endMs)) {
      mark(
        level,
        level === 'hard'
          ? 'This overlaps a confirmed event or a blocked time, including setup and breakdown.'
          : 'This overlaps a tentative hold, including setup and breakdown.',
      );
      continue;
    }

    if (occupancy.kind === 'block' || timed.allDay) continue;
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

  if (!startTime && !hard) {
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
