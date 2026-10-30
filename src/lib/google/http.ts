import { BUSINESS_TIME_ZONE } from '@/lib/schedule/time';
import type { GoogleEnv } from './env';
import {
  WEDDINGS_CALENDAR_SUMMARY,
  WEBSITE_EVENT_SOURCE,
  chunkTimeRange,
  eventToInterval,
  FreeBusyReadError,
  parseFreeBusy,
  type GoogleEventPayload,
  type Interval,
} from './events';
import {
  GoogleApiError,
  GoogleReconnectError,
  googleErrorReason,
  type CalendarRef,
  type GoogleCalendarGateway,
} from './gateway';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const WIDE_START = '2018-01-01T00:00:00Z';
const WIDE_END = '2038-01-01T00:00:00Z';

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  error?: string;
};

export class GoogleCalendarClient implements GoogleCalendarGateway {
  constructor(
    private readonly env: GoogleEnv,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async exchangeCode(code: string): Promise<{ refreshToken: string; accessToken: string }> {
    const body = await this.tokenRequest({
      code,
      grant_type: 'authorization_code',
      redirect_uri: this.env.redirectUri,
    });
    if (!body.refresh_token || !body.access_token) {
      throw new GoogleApiError(400, 'Google did not return a refresh token. Connect again and allow access.');
    }
    return { refreshToken: body.refresh_token, accessToken: body.access_token };
  }

  async refreshAccessToken(refreshToken: string): Promise<string> {
    const body = await this.tokenRequest({
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });
    if (!body.access_token) throw new GoogleApiError(502, 'Google did not return an access token.');
    return body.access_token;
  }

  async revoke(refreshToken: string): Promise<void> {
    await this.fetchImpl('https://oauth2.googleapis.com/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: refreshToken }),
    }).catch(() => undefined);
  }

  async userEmail(accessToken: string): Promise<string | null> {
    const response = await this.request(accessToken, 'https://www.googleapis.com/oauth2/v2/userinfo');
    if (!response.ok) return null;
    const body = (await response.json().catch(() => null)) as { email?: string } | null;
    return typeof body?.email === 'string' ? body.email : null;
  }

  async findCalendar(accessToken: string, calendarId: string): Promise<CalendarRef | null> {
    const response = await this.request(
      accessToken,
      `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}`,
    );
    if (response.status === 404) return null;
    if (!response.ok) throw await this.googleApiError(response, 'Google Calendar could not be opened.');
    const body = (await response.json()) as { id?: string; summary?: string };
    if (!body.id) return null;
    return { id: body.id, summary: body.summary || WEDDINGS_CALENDAR_SUMMARY };
  }

  async createWeddingsCalendar(accessToken: string): Promise<CalendarRef | null> {
    const response = await this.request(accessToken, `${CALENDAR_API}/calendars`, {
      method: 'POST',
      body: JSON.stringify({
        summary: WEDDINGS_CALENDAR_SUMMARY,
        timeZone: BUSINESS_TIME_ZONE,
        description: 'Bookings and time blocks from the website. Private block notes are not copied here.',
      }),
    });
    if (response.status === 403 || response.status === 404) return null;
    if (!response.ok) throw await this.googleApiError(response, 'The Weddings calendar could not be created.');
    const body = (await response.json()) as { id?: string; summary?: string };
    if (!body.id) return null;
    return { id: body.id, summary: body.summary || WEDDINGS_CALENDAR_SUMMARY };
  }

  async upsertEvent(accessToken: string, calendarId: string, event: GoogleEventPayload): Promise<void> {
    const collection = `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`;
    const insert = await this.request(accessToken, collection, {
      method: 'POST',
      body: JSON.stringify(event),
    });
    if (insert.status === 409) {
      const update = await this.request(accessToken, `${collection}/${event.id}`, {
        method: 'PUT',
        body: JSON.stringify(event),
      });
      if (!update.ok) throw await this.googleApiError(update, 'The Google event could not be updated.');
      return;
    }
    if (!insert.ok) throw await this.googleApiError(insert, 'The Google event could not be created.');
  }

  async deleteEvent(accessToken: string, calendarId: string, eventId: string): Promise<void> {
    const response = await this.request(
      accessToken,
      `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
      { method: 'DELETE' },
    );
    if (response.ok || response.status === 404 || response.status === 410) return;
    throw await this.googleApiError(response, 'The Google event could not be removed.');
  }

  async freeBusy(accessToken: string, timeMin: string, timeMax: string): Promise<Interval[]> {
    let chunks: { timeMin: string; timeMax: string }[];
    try {
      chunks = chunkTimeRange(timeMin, timeMax);
    } catch (error) {
      if (error instanceof FreeBusyReadError) {
        throw new GoogleApiError(400, error.message, error.reason);
      }
      throw error;
    }
    const intervals: Interval[] = [];
    for (const chunk of chunks) {
      intervals.push(...(await this.queryFreeBusy(accessToken, chunk.timeMin, chunk.timeMax)));
    }
    return intervals;
  }

  private async queryFreeBusy(accessToken: string, timeMin: string, timeMax: string): Promise<Interval[]> {
    const response = await this.request(accessToken, `${CALENDAR_API}/freeBusy`, {
      method: 'POST',
      body: JSON.stringify({
        timeMin,
        timeMax,
        timeZone: BUSINESS_TIME_ZONE,
        items: [{ id: 'primary' }],
      }),
    });
    if (!response.ok) throw await this.googleApiError(response, 'Google busy times could not be read.');
    const body = await response.json().catch(() => null);
    try {
      return parseFreeBusy(body);
    } catch (error) {
      if (error instanceof FreeBusyReadError) {
        throw new GoogleApiError(response.status, error.message, error.reason);
      }
      throw error;
    }
  }

  async listWebsiteEventIntervals(
    accessToken: string,
    calendarId: string,
    timeMin: string,
    timeMax: string,
  ): Promise<Interval[]> {
    const events = await this.listWebsiteEvents(accessToken, calendarId, timeMin, timeMax);
    return events.flatMap((event) => {
      const interval = eventToInterval(event);
      return interval ? [interval] : [];
    });
  }

  async deleteWebsiteEvents(accessToken: string, calendarId: string): Promise<void> {
    const events = await this.listWebsiteEvents(accessToken, calendarId, WIDE_START, WIDE_END);
    for (const event of events) {
      if (!event.id) continue;
      await this.deleteEvent(accessToken, calendarId, event.id);
    }
  }

  private async listWebsiteEvents(
    accessToken: string,
    calendarId: string,
    timeMin: string,
    timeMax: string,
  ): Promise<{ id?: string; start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string } }[]> {
    const found: { id?: string; start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string } }[] = [];
    let pageToken = '';
    do {
      const url = new URL(`${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`);
      url.searchParams.set('privateExtendedProperty', `source=${WEBSITE_EVENT_SOURCE}`);
      url.searchParams.set('singleEvents', 'true');
      url.searchParams.set('showDeleted', 'false');
      url.searchParams.set('maxResults', '250');
      url.searchParams.set('timeMin', timeMin);
      url.searchParams.set('timeMax', timeMax);
      if (pageToken) url.searchParams.set('pageToken', pageToken);
      const response = await this.request(accessToken, url.toString());
      if (response.status === 404) return found;
      if (!response.ok) throw await this.googleApiError(response, 'Website events on Google could not be listed.');
      const body = (await response.json()) as { items?: typeof found; nextPageToken?: string };
      found.push(...(body.items || []));
      pageToken = body.nextPageToken || '';
    } while (pageToken);
    return found;
  }

  private async tokenRequest(fields: Record<string, string>): Promise<TokenResponse> {
    const response = await this.fetchImpl(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.env.clientId,
        client_secret: this.env.clientSecret,
        ...fields,
      }),
    });
    const body = (await response.json().catch(() => null)) as TokenResponse | null;
    if (body?.error === 'invalid_grant') throw new GoogleReconnectError();
    if (!response.ok || !body) {
      throw new GoogleApiError(response.status, 'Google sign-in could not be completed.', googleErrorReason(body));
    }
    return body;
  }

  private async request(accessToken: string, url: string, init?: RequestInit): Promise<Response> {
    const headers = new Headers(init?.headers);
    headers.set('Authorization', `Bearer ${accessToken}`);
    if (init?.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    const response = await this.fetchImpl(url, { ...init, headers });
    if (response.status === 401) throw new GoogleReconnectError();
    return response;
  }

  private async googleApiError(response: Response, fallback: string): Promise<GoogleApiError> {
    const body = await response.json().catch(() => null);
    return new GoogleApiError(response.status, fallback, googleErrorReason(body));
  }
}
