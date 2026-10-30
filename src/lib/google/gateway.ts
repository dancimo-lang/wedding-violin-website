import type { GoogleEventPayload, Interval } from './events';

export class GoogleReconnectError extends Error {
  constructor() {
    super('Google rejected the saved connection.');
    this.name = 'GoogleReconnectError';
  }
}

export class GoogleApiError extends Error {
  readonly status: number;
  readonly reason: string | null;

  constructor(status: number, message: string, reason: string | null = null) {
    super(message);
    this.name = 'GoogleApiError';
    this.status = status;
    this.reason = reason;
  }
}

export type CalendarRef = { id: string; summary: string };

export type GoogleCalendarGateway = {
  refreshAccessToken(refreshToken: string): Promise<string>;
  userEmail(accessToken: string): Promise<string | null>;
  findCalendar(accessToken: string, calendarId: string): Promise<CalendarRef | null>;
  createWeddingsCalendar(accessToken: string): Promise<CalendarRef | null>;
  upsertEvent(accessToken: string, calendarId: string, event: GoogleEventPayload): Promise<void>;
  deleteEvent(accessToken: string, calendarId: string, eventId: string): Promise<void>;
  freeBusy(accessToken: string, timeMin: string, timeMax: string): Promise<Interval[]>;
  listWebsiteEventIntervals(
    accessToken: string,
    calendarId: string,
    timeMin: string,
    timeMax: string,
  ): Promise<Interval[]>;
  deleteWebsiteEvents(accessToken: string, calendarId: string): Promise<void>;
};

const SAFE_REASON = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
const SECRET = /ya29\.[A-Za-z0-9._~+/-]+=*|1\/\/[A-Za-z0-9._~+/-]+|Bearer\s+\S+/gi;

export function redactSecrets(value: string): string {
  return value.replace(SECRET, '[redacted]');
}

/** Pull a short Google `reason` code. Free-form messages are ignored so tokens and emails never land in logs. */
export function googleErrorReason(body: unknown): string | null {
  const reason = findReason(body);
  if (!reason || !SAFE_REASON.test(reason)) return null;
  return reason;
}

function findReason(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  if (typeof record.reason === 'string') return record.reason;
  if (typeof record.error === 'string') return record.error;
  if (record.error && typeof record.error === 'object') {
    const nested = findReason(record.error);
    if (nested) return nested;
  }
  if (Array.isArray(record.errors)) return findReason(record.errors[0]);
  return null;
}

export function safeGoogleMessage(error: unknown): string {
  if (error instanceof GoogleReconnectError) return error.message;
  if (error instanceof GoogleApiError) {
    const parts = [error.message];
    if (error.status >= 400) parts.push(`HTTP ${error.status}`);
    if (error.reason && SAFE_REASON.test(error.reason)) parts.push(error.reason);
    return redactSecrets(parts.join(' · ')).slice(0, 300);
  }
  if (error instanceof Error) {
    const message = redactSecrets(error.message).trim().slice(0, 300);
    if (message.startsWith('Google ')) return message;
  }
  return 'Google Calendar could not be updated.';
}

export function logGoogleSyncFailure(error: unknown): void {
  if (error instanceof GoogleApiError) {
    console.error('Google Calendar sync failed', {
      status: error.status,
      reason: error.reason && SAFE_REASON.test(error.reason) ? error.reason : null,
    });
    return;
  }
  if (error instanceof GoogleReconnectError) {
    console.error('Google Calendar sync failed', { reason: 'reconnect_required' });
    return;
  }
  const message = error instanceof Error ? redactSecrets(error.message).slice(0, 200) : 'unknown';
  console.error('Google Calendar sync failed', { reason: message });
}
