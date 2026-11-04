import 'server-only';
import { EXISTING_BOOKING_SOURCE } from '@/lib/bookings/existing-booking';
import { isContractToken } from '@/lib/contracts/token';
import { createAdminClient } from '@/lib/supabase/admin';

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Payment page for an existing booking. The token is stored on the import
 * marker. It is not a booking code and it is not an agreement link.
 */
export async function existingBookingPayTarget(
  admin: Admin,
  token: string,
): Promise<{ bookingId: string; bookingCode: string } | null> {
  if (!isContractToken(token)) return null;
  const { data } = await admin
    .from('activity_events')
    .select('booking_id')
    .contains('metadata', { source: EXISTING_BOOKING_SOURCE, payment_token: token })
    .limit(1)
    .maybeSingle();
  const bookingId = typeof data?.booking_id === 'string' ? data.booking_id : '';
  if (!bookingId) return null;
  const { data: booking } = await admin.from('bookings').select('booking_code').eq('id', bookingId).maybeSingle();
  const bookingCode = typeof booking?.booking_code === 'string' ? booking.booking_code : '';
  if (!bookingCode) return null;
  return { bookingId, bookingCode };
}
