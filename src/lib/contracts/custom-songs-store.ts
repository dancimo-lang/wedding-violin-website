import type { SupabaseClient } from '@supabase/supabase-js';
import { customSongsNote, emptyCustomSongs, readCustomSongsNote, type CustomSongs } from './custom-songs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function uuid(value: string | null | undefined) {
  const trimmed = value?.trim() ?? '';
  return UUID.test(trimmed) ? trimmed : null;
}

/**
 * Custom songs live in the existing notes table, not on the contract.
 * A signed agreement locks render_fields, so a later edit cannot change the signed text.
 */
export async function loadCustomSongs(
  client: SupabaseClient,
  ids: { leadId?: string | null; bookingId?: string | null },
): Promise<CustomSongs> {
  const leadId = uuid(ids.leadId);
  const bookingId = uuid(ids.bookingId);
  if (!leadId && !bookingId) return emptyCustomSongs();
  let query = client.from('notes').select('id, content').eq('note_type', 'Internal').order('created_at', { ascending: false }).limit(40);
  if (leadId && bookingId) query = query.or(`lead_id.eq.${leadId},booking_id.eq.${bookingId}`);
  else if (leadId) query = query.eq('lead_id', leadId);
  else query = query.eq('booking_id', bookingId!);
  const { data } = await query;
  for (const row of data || []) {
    const songs = readCustomSongsNote((row as { content?: string }).content);
    if (songs) return songs;
  }
  return emptyCustomSongs();
}

export async function saveCustomSongs(
  client: SupabaseClient,
  ids: { leadId?: string | null; bookingId?: string | null },
  songs: readonly string[],
): Promise<string | null> {
  const leadId = uuid(ids.leadId);
  const bookingId = uuid(ids.bookingId);
  if (!leadId && !bookingId) return 'Save the lead or booking before storing custom songs.';
  const content = customSongsNote(songs);
  let query = client.from('notes').select('id, content').eq('note_type', 'Internal').order('created_at', { ascending: false }).limit(40);
  if (leadId && bookingId) query = query.or(`lead_id.eq.${leadId},booking_id.eq.${bookingId}`);
  else if (leadId) query = query.eq('lead_id', leadId);
  else query = query.eq('booking_id', bookingId!);
  const { data, error } = await query;
  if (error) return 'Custom songs could not be saved.';
  const existing = (data || []).find((row) => readCustomSongsNote((row as { content?: string }).content));
  if (existing && typeof (existing as { id?: string }).id === 'string') {
    const { error: updateError } = await client
      .from('notes')
      .update({
        content,
        ...(leadId ? { lead_id: leadId } : {}),
        ...(bookingId ? { booking_id: bookingId } : {}),
      })
      .eq('id', (existing as { id: string }).id);
    return updateError ? 'Custom songs could not be saved.' : null;
  }
  const { error: insertError } = await client.from('notes').insert({
    note_type: 'Internal',
    content,
    is_private: true,
    lead_id: leadId,
    booking_id: bookingId,
  });
  return insertError ? 'Custom songs could not be saved.' : null;
}
