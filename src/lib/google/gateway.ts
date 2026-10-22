import type { GoogleEventPayload, Interval } from './events';

export class GoogleReconnectError extends Error {
  constructor() {
    super('Google rejected the saved connection.');
    this.name = 'GoogleReconnectError';
  }
}

export class GoogleApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'GoogleApiError';
    this.status = status;
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

export function safeGoogleMessage(error: unknown): string {
  if (error instanceof GoogleReconnectError || error instanceof GoogleApiError) return error.message;
  return 'Google Calendar could not be updated.';
}
