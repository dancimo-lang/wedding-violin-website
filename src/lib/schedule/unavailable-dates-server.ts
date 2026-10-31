import 'server-only';
import { computeUnavailableDates, DATE_BLOCKING_BLOCK_TYPES, DATE_BLOCKING_STATUSES } from './unavailable-dates';
import type { createAdminClient } from '@/lib/supabase/admin';

type Admin = ReturnType<typeof createAdminClient>;

/** Loads unavailable Pacific dates in [from, to]. Returns null if bookings could not be read. */
export async function loadUnavailableDates(admin: Admin, from: string, to: string): Promise<string[] | null> {
  const [bookings, blocks] = await Promise.all([
    admin
      .from('bookings')
      .select('status, event_date')
      .in('status', [...DATE_BLOCKING_STATUSES])
      .gte('event_date', from)
      .lte('event_date', to),
    admin
      .from('availability_blocks')
      .select('block_type, start_date, end_date')
      .in('block_type', [...DATE_BLOCKING_BLOCK_TYPES])
      .lte('start_date', to)
      .gte('end_date', from),
  ]);
  if (bookings.error) return null;
  // A block read failure is treated as no blocks rather than hiding the whole calendar.
  return computeUnavailableDates(from, to, bookings.data || [], blocks.error ? [] : blocks.data || []);
}
