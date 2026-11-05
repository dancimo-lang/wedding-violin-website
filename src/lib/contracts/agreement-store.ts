import type { SupabaseClient } from '@supabase/supabase-js';
import {
  agreementNote,
  emptyAgreement,
  readAgreementNote,
  type AgreementDetails,
} from './agreement-details';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function uuid(value: string | null | undefined) {
  const trimmed = value?.trim() ?? '';
  return UUID.test(trimmed) ? trimmed : null;
}

/**
 * Bookings imported without a lead have no inquiry_details column.
 * The same agreement object is kept in a private Internal note.
 * Leads store it on inquiry_details instead, so this note is not read when a lead exists.
 */
export async function loadAgreementNote(client: SupabaseClient, bookingId: string | null | undefined): Promise<AgreementDetails> {
  const id = uuid(bookingId);
  if (!id) return emptyAgreement();
  const { data } = await client
    .from('notes')
    .select('id, content')
    .eq('note_type', 'Internal')
    .eq('booking_id', id)
    .order('created_at', { ascending: false })
    .limit(40);
  for (const row of data || []) {
    const details = readAgreementNote((row as { content?: string }).content);
    if (details) return details;
  }
  return emptyAgreement();
}

export async function saveAgreementNote(
  client: SupabaseClient,
  bookingId: string | null | undefined,
  details: AgreementDetails,
): Promise<string | null> {
  const id = uuid(bookingId);
  if (!id) return 'Save the booking before storing these details.';
  const content = agreementNote(details);
  const { data, error } = await client
    .from('notes')
    .select('id, content')
    .eq('note_type', 'Internal')
    .eq('booking_id', id)
    .order('created_at', { ascending: false })
    .limit(40);
  if (error) return 'Agreement details could not be saved.';
  const existing = (data || []).find((row) => readAgreementNote((row as { content?: string }).content));
  if (existing && typeof (existing as { id?: string }).id === 'string') {
    const { error: updateError } = await client.from('notes').update({ content, booking_id: id }).eq('id', (existing as { id: string }).id);
    return updateError ? 'Agreement details could not be saved.' : null;
  }
  const { error: insertError } = await client.from('notes').insert({
    note_type: 'Internal',
    content,
    is_private: true,
    booking_id: id,
  });
  return insertError ? 'Agreement details could not be saved.' : null;
}
