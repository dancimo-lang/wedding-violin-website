import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { decryptToken, encryptToken } from './crypto';
import { GOOGLE_SCOPES } from './oauth';
import type { BlockSyncRow, BookingSyncRow } from './events';
import { EXISTING_BOOKING_SOURCE, isGoogleSyncExcluded } from '@/lib/bookings/existing-booking';
import type { EventLink, OutboxItem, StoredConnection, SyncStore } from './sync';

type ConnectionRow = {
  status: StoredConnection['status'];
  google_email: string | null;
  calendar_id: string | null;
  calendar_summary: string | null;
  calendar_mode: StoredConnection['calendarMode'];
  refresh_token_ciphertext: string | null;
  refresh_token_iv: string | null;
  refresh_token_tag: string | null;
};

export function createSupabaseSyncStore(encryptionKey: string): SyncStore {
  const admin = createAdminClient();

  return {
    async getConnection() {
      const { data, error } = await admin
        .from('google_calendar_connection')
        .select(
          'status, google_email, calendar_id, calendar_summary, calendar_mode, refresh_token_ciphertext, refresh_token_iv, refresh_token_tag',
        )
        .eq('id', 1)
        .maybeSingle();
      if (error) throw new Error('The Google connection could not be read.');
      if (!data) return null;
      return toConnection(data as ConnectionRow, encryptionKey);
    },

    async markReconnect(message) {
      const { error } = await admin
        .from('google_calendar_connection')
        .update({
          status: 'reconnect_required',
          last_error: message.slice(0, 300),
          updated_at: new Date().toISOString(),
        })
        .eq('id', 1);
      if (error) throw new Error('The Google connection could not be updated.');
    },

    async recordFailure(message) {
      const { error } = await admin
        .from('google_calendar_connection')
        .update({
          last_error: message.slice(0, 300),
          updated_at: new Date().toISOString(),
        })
        .eq('id', 1);
      if (error) throw new Error('The Google connection could not be updated.');
    },

    async saveCalendar(calendar) {
      const { error } = await admin
        .from('google_calendar_connection')
        .update({
          calendar_id: calendar.id,
          calendar_summary: calendar.summary,
          calendar_mode: calendar.mode,
          status: 'connected',
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', 1);
      if (error) throw new Error('The Google calendar could not be saved.');
    },

    async listOutbox(limit) {
      const { data, error } = await admin
        .from('google_sync_outbox')
        .select('id, source_table, source_id, operation, attempts, created_at')
        .lt('attempts', 12)
        .order('created_at', { ascending: true })
        .limit(limit);
      if (error) throw new Error('The sync queue could not be read.');
      return (data || []).map((row) => ({
        id: String(row.id),
        sourceTable: row.source_table as OutboxItem['sourceTable'],
        sourceId: String(row.source_id),
        operation: row.operation as OutboxItem['operation'],
        attempts: Number(row.attempts) || 0,
        createdAt: String(row.created_at),
      }));
    },

    async finishOutbox(sourceTable, sourceId, throughCreatedAt) {
      const { error } = await admin
        .from('google_sync_outbox')
        .delete()
        .eq('source_table', sourceTable)
        .eq('source_id', sourceId)
        .lte('created_at', throughCreatedAt);
      if (error) throw new Error('The sync queue could not be cleared.');
    },

    async failOutbox(ids, attempts, message) {
      if (ids.length === 0) return;
      const { error } = await admin
        .from('google_sync_outbox')
        .update({ attempts, last_error: message.slice(0, 300) })
        .in('id', ids);
      if (error) throw new Error('The sync queue could not be updated.');
    },

    async enqueueAll() {
      const [bookings, blocks] = await Promise.all([
        admin.from('bookings').select('id').in('status', ['Tentative', 'Confirmed', 'Completed']),
        admin.from('availability_blocks').select('id'),
      ]);
      if (bookings.error || blocks.error) throw new Error('Existing calendar rows could not be queued.');
      const rows = [
        ...(bookings.data || []).map((row) => ({
          source_table: 'bookings',
          source_id: row.id,
          operation: 'upsert',
        })),
        ...(blocks.data || []).map((row) => ({
          source_table: 'availability_blocks',
          source_id: row.id,
          operation: 'upsert',
        })),
      ];
      for (let index = 0; index < rows.length; index += 200) {
        const slice = rows.slice(index, index + 200);
        if (slice.length === 0) continue;
        const { error } = await admin.from('google_sync_outbox').insert(slice);
        if (error) throw new Error('Existing calendar rows could not be queued.');
      }
    },

    async getBooking(id) {
      const { data, error } = await admin
        .from('bookings')
        .select(
          'id, status, event_date, performance_start_time, performance_end_time, venue_name, venue_address, service_type, clients(name)',
        )
        .eq('id', id)
        .maybeSingle();
      if (error) throw new Error('A booking could not be read for Google sync.');
      if (!data) return null;
      const { data: markers, error: markerError } = await admin
        .from('activity_events')
        .select('metadata')
        .eq('booking_id', id)
        .eq('metadata->>source', EXISTING_BOOKING_SOURCE);
      // If the marker cannot be read, do not risk pushing an excluded booking.
      if (markerError) throw new Error('A booking could not be read for Google sync.');
      return {
        googleSync: !isGoogleSyncExcluded((markers || []).map((row) => row.metadata)),
        id: String(data.id),
        status: String(data.status),
        eventDate: String(data.event_date),
        startTime: data.performance_start_time,
        endTime: data.performance_end_time,
        venueName: data.venue_name,
        venueAddress: data.venue_address,
        serviceType: String(data.service_type || 'Performance'),
        clientName: readName(data.clients),
      } satisfies BookingSyncRow;
    },

    async getBlock(id) {
      const { data, error } = await admin
        .from('availability_blocks')
        .select('id, block_type, start_date, end_date, start_time, end_time, all_day')
        .eq('id', id)
        .maybeSingle();
      if (error) throw new Error('A block could not be read for Google sync.');
      if (!data) return null;
      return {
        id: String(data.id),
        blockType: String(data.block_type),
        startDate: String(data.start_date),
        endDate: String(data.end_date || data.start_date),
        startTime: data.start_time,
        endTime: data.end_time,
        allDay: data.all_day !== false,
      } satisfies BlockSyncRow;
    },

    async getLink(sourceTable, sourceId) {
      const { data, error } = await admin
        .from('google_event_links')
        .select('google_event_id, calendar_id')
        .eq('source_table', sourceTable)
        .eq('source_id', sourceId)
        .maybeSingle();
      if (error) throw new Error('A Google event link could not be read.');
      if (!data) return null;
      return { googleEventId: String(data.google_event_id), calendarId: String(data.calendar_id) } satisfies EventLink;
    },

    async saveLink(link) {
      const { error } = await admin.from('google_event_links').upsert(
        {
          source_table: link.sourceTable,
          source_id: link.sourceId,
          google_event_id: link.googleEventId,
          calendar_id: link.calendarId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'source_table,source_id' },
      );
      if (error) throw new Error('A Google event link could not be saved.');
    },

    async deleteLink(sourceTable, sourceId) {
      const { error } = await admin
        .from('google_event_links')
        .delete()
        .eq('source_table', sourceTable)
        .eq('source_id', sourceId);
      if (error) throw new Error('A Google event link could not be removed.');
    },

    async replaceBusy(intervals, fetchedAt) {
      for (let index = 0; index < intervals.length; index += 200) {
        const slice = intervals.slice(index, index + 200).map((interval) => ({
          starts_at: new Date(interval.startMs).toISOString(),
          ends_at: new Date(interval.endMs).toISOString(),
          fetched_at: fetchedAt,
        }));
        const { error } = await admin.from('google_busy_times').insert(slice);
        if (error) throw new Error('Google busy times could not be saved.');
      }
      const { error: deleteError } = await admin.from('google_busy_times').delete().lt('fetched_at', fetchedAt);
      if (deleteError) throw new Error('Old Google busy times could not be cleared.');
      const { error: stampError } = await admin
        .from('google_calendar_connection')
        .update({ busy_synced_at: fetchedAt, status: 'connected', last_error: null, updated_at: fetchedAt })
        .eq('id', 1);
      if (stampError) throw new Error('The Google busy-time clock could not be saved.');
    },
  };
}

export async function saveOAuthConnection(input: { refreshToken: string; email: string | null }): Promise<void> {
  const { readGoogleEnv } = await import('./env');
  const env = readGoogleEnv();
  if (!env) throw new Error('Google Calendar is not configured.');
  const encrypted = encryptToken(input.refreshToken, env.encryptionKey);
  const admin = createAdminClient();
  const existing = await admin
    .from('google_calendar_connection')
    .select('calendar_id, calendar_summary, calendar_mode')
    .eq('id', 1)
    .maybeSingle();
  const { error } = await admin.from('google_calendar_connection').upsert(
    {
      id: 1,
      google_email: input.email,
      refresh_token_ciphertext: encrypted.ciphertext,
      refresh_token_iv: encrypted.iv,
      refresh_token_tag: encrypted.tag,
      scopes: GOOGLE_SCOPES.join(' '),
      status: 'connected',
      connected_at: new Date().toISOString(),
      last_error: null,
      updated_at: new Date().toISOString(),
      calendar_id: existing.data?.calendar_id ?? null,
      calendar_summary: existing.data?.calendar_summary ?? null,
      calendar_mode: existing.data?.calendar_mode ?? null,
    },
    { onConflict: 'id' },
  );
  if (error) throw new Error('The Google connection could not be saved.');
}

export async function disconnectGoogle(): Promise<void> {
  const { readGoogleEnv } = await import('./env');
  const { GoogleCalendarClient } = await import('./http');
  const env = readGoogleEnv();
  const admin = createAdminClient();
  if (env) {
    const connection = await createSupabaseSyncStore(env.encryptionKey).getConnection();
    if (connection?.refreshToken) await new GoogleCalendarClient(env).revoke(connection.refreshToken);
  }
  await admin
    .from('google_calendar_connection')
    .update({
      refresh_token_ciphertext: null,
      refresh_token_iv: null,
      refresh_token_tag: null,
      status: 'disconnected',
      busy_synced_at: null,
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1);
  await admin.from('google_busy_times').delete().not('id', 'is', null);
}

export async function readConnectionRow() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('google_calendar_connection')
    .select('status, google_email, calendar_summary, calendar_mode, busy_synced_at, last_error')
    .eq('id', 1)
    .maybeSingle();
  if (error) return { error: true as const, row: null };
  return { error: false as const, row: data };
}

function toConnection(row: ConnectionRow, encryptionKey: string): StoredConnection {
  let refreshToken: string | null = null;
  if (row.refresh_token_ciphertext && row.refresh_token_iv && row.refresh_token_tag) {
    try {
      refreshToken = decryptToken(
        { ciphertext: row.refresh_token_ciphertext, iv: row.refresh_token_iv, tag: row.refresh_token_tag },
        encryptionKey,
      );
    } catch {
      refreshToken = null;
    }
  }
  return {
    status: row.status,
    refreshToken,
    calendarId: row.calendar_id,
    calendarSummary: row.calendar_summary,
    calendarMode: row.calendar_mode,
    googleEmail: row.google_email,
  };
}

function readName(value: unknown): string | null {
  if (!value) return null;
  if (Array.isArray(value)) return readName(value[0]);
  if (typeof value === 'object' && value && 'name' in value) {
    const name = (value as { name?: unknown }).name;
    return typeof name === 'string' && name.trim() ? name.trim() : null;
  }
  return null;
}
