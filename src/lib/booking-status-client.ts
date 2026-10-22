export type BookingStatusAction =
  | 'apply_booking'
  | 'restore_booking'
  | 'set_lead_status'
  | 'archive_lead'
  | 'restore_lead';

export type BookingStatusFields = {
  client_id?: string | null;
  lead_id?: string | null;
  event_date?: string | null;
  venue_name?: string | null;
  venue_address?: string | null;
  service_type?: string | null;
  performance_start_time?: string | null;
  performance_end_time?: string | null;
  setup_time?: string | null;
  breakdown_time?: string | null;
  travel_buffer_hours?: number | null;
  total_price?: number | null;
  retainer_amount?: number | null;
  retainer_due_date?: string | null;
  balance_due_date?: string | null;
  special_requests?: string | null;
  performers_needed?: number | null;
};

export type BookingStatusResult =
  | {
      ok: true;
      bookingId: string | null;
      bookingStatus: string | null;
      leadId: string | null;
      leadStatus: string | null;
    }
  | { ok: false; error: string };

export async function postBookingStatus(input: {
  action: BookingStatusAction;
  bookingId?: string | null;
  leadId?: string | null;
  status?: string | null;
  reason?: string | null;
  fields?: BookingStatusFields | null;
}): Promise<BookingStatusResult> {
  try {
    const response = await fetch('/api/admin/booking-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      bookingId?: string | null;
      bookingStatus?: string | null;
      leadId?: string | null;
      leadStatus?: string | null;
    };
    if (!response.ok) {
      return { ok: false, error: payload.error || 'Could not update the booking.' };
    }
    return {
      ok: true,
      bookingId: payload.bookingId ?? null,
      bookingStatus: payload.bookingStatus ?? null,
      leadId: payload.leadId ?? null,
      leadStatus: payload.leadStatus ?? null,
    };
  } catch {
    return { ok: false, error: 'Could not update the booking.' };
  }
}

export function friendlyWriteError(message: string | undefined, fallback: string) {
  if (!message) return fallback;
  if (/permission denied|row-level security|JWT|schema cache/i.test(message)) return fallback;
  return message;
}
