import { NextResponse } from 'next/server';
import { runGoogleSync } from '@/lib/google/run';
import { requireAdminApi } from '@/lib/require-admin-api';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ACTIONS = new Set([
  'apply_booking',
  'restore_booking',
  'set_lead_status',
  'archive_lead',
  'restore_lead',
]);

const BOOKING_STATUSES = new Set(['Tentative', 'Confirmed', 'Cancelled', 'Completed']);
const LEAD_STATUSES = new Set([
  'New Inquiry',
  'Needs Information',
  'Quote Sent',
  'Awaiting Response',
  'Contract Sent',
  'Awaiting Retainer',
  'Confirmed',
  'Lost',
  'Completed',
]);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function uuidOrNull(value: unknown): string | null | undefined {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || !UUID.test(value)) return undefined;
  return value;
}

function textOrNull(value: unknown, max: number): string | null | undefined {
  if (value == null) return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > max) return undefined;
  return trimmed;
}

function dateOrNull(value: unknown): string | null | undefined {
  const text = textOrNull(value, 10);
  if (text == null) return text;
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : undefined;
}

function timeOrNull(value: unknown): string | null | undefined {
  const text = textOrNull(value, 8);
  if (text == null) return text;
  return /^\d{2}:\d{2}(?::\d{2})?$/.test(text) ? text.slice(0, 5) : undefined;
}

function numberOrNull(value: unknown): number | null | undefined {
  if (value == null || value === '') return null;
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
}

function fieldsFrom(input: unknown): Record<string, string | number | null> | null {
  if (input == null) return {};
  if (typeof input !== 'object' || Array.isArray(input)) return null;
  const source = input as Record<string, unknown>;
  const fields: Record<string, string | number | null> = {};
  const textKeys = ['venue_name', 'venue_address', 'service_type', 'special_requests'] as const;
  const dateKeys = ['event_date', 'retainer_due_date', 'balance_due_date'] as const;
  const timeKeys = ['performance_start_time', 'performance_end_time', 'setup_time', 'breakdown_time'] as const;
  const idKeys = ['client_id', 'lead_id'] as const;
  const numberKeys = ['travel_buffer_hours', 'total_price', 'retainer_amount', 'performers_needed'] as const;

  for (const key of idKeys) {
    if (!(key in source)) continue;
    const parsed = uuidOrNull(source[key]);
    if (parsed === undefined) return null;
    fields[key] = parsed;
  }
  for (const key of textKeys) {
    if (!(key in source)) continue;
    const parsed = textOrNull(source[key], key === 'special_requests' ? 4000 : 500);
    if (parsed === undefined) return null;
    fields[key] = parsed;
  }
  for (const key of dateKeys) {
    if (!(key in source)) continue;
    const parsed = dateOrNull(source[key]);
    if (parsed === undefined) return null;
    fields[key] = parsed;
  }
  for (const key of timeKeys) {
    if (!(key in source)) continue;
    const parsed = timeOrNull(source[key]);
    if (parsed === undefined) return null;
    fields[key] = parsed;
  }
  for (const key of numberKeys) {
    if (!(key in source)) continue;
    const parsed = numberOrNull(source[key]);
    if (parsed === undefined) return null;
    if (key === 'performers_needed' && parsed != null && (!Number.isInteger(parsed) || parsed < 1 || parsed > 12)) {
      return null;
    }
    fields[key] = parsed;
  }
  return fields;
}

function publicMessage(message: string) {
  const line = message.split('\n')[0]?.replace(/^ERROR:\s*/i, '').trim() || 'Could not update the booking.';
  if (/^(not allowed|Could not|That |This |Add |Only |Choose |A client|Musicians|The cancellation|Unknown|Confirm the booking|Booking status|Bookings are|Lead status)/.test(line)) {
    return line;
  }
  return 'Could not update the booking.';
}

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (auth.response || !auth.session) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Could not read that request.' }, { status: 400 });
  }

  const action = typeof body.action === 'string' ? body.action : '';
  if (!ACTIONS.has(action)) {
    return NextResponse.json({ error: 'Unknown booking action.' }, { status: 400 });
  }

  const bookingId = uuidOrNull(body.bookingId);
  const leadId = uuidOrNull(body.leadId);
  if (bookingId === undefined || leadId === undefined) {
    return NextResponse.json({ error: 'That record could not be found.' }, { status: 400 });
  }

  const reason = textOrNull(body.reason, 500);
  if (reason === undefined) {
    return NextResponse.json({ error: 'The cancellation reason must be 500 characters or fewer.' }, { status: 400 });
  }

  const status = textOrNull(body.status, 40);
  if (status === undefined) {
    return NextResponse.json({ error: 'That status is not one this site uses.' }, { status: 400 });
  }
  if (status && action === 'apply_booking' && !BOOKING_STATUSES.has(status)) {
    return NextResponse.json({ error: 'That booking status is not one this site uses.' }, { status: 400 });
  }
  if (status && action === 'set_lead_status' && !LEAD_STATUSES.has(status)) {
    return NextResponse.json({ error: 'That lead status is not one this site uses.' }, { status: 400 });
  }

  const fields = fieldsFrom(body.fields);
  if (!fields) {
    return NextResponse.json({ error: 'Check the date, time, and musician count.' }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'Could not update the booking.' }, { status: 500 });
  }

  const { data, error } = await admin.rpc('sync_booking_and_lead', {
    p_action: action,
    p_booking_id: bookingId,
    p_lead_id: leadId,
    p_status: status,
    p_reason: reason,
    p_actor: auth.session.id,
    p_fields: fields,
  });

  if (error) {
    const message = publicMessage(error.message || '');
    const statusCode = error.code === '42501' || message === 'not allowed' ? 403 : 409;
    return NextResponse.json({ error: message }, { status: statusCode });
  }

  const row = (data || {}) as {
    booking_id?: string | null;
    booking_status?: string | null;
    lead_id?: string | null;
    lead_status?: string | null;
  };

  const touchesCalendar =
    action === 'apply_booking' ||
    action === 'restore_booking' ||
    (action === 'set_lead_status' && (status === 'Confirmed' || status === 'Lost' || status === 'Completed'));
  if (touchesCalendar) {
    try {
      await runGoogleSync();
    } catch {
      // The outbox keeps the Google change until the next sync.
    }
  }

  return NextResponse.json({
    ok: true,
    bookingId: row.booking_id ?? null,
    bookingStatus: row.booking_status ?? null,
    leadId: row.lead_id ?? null,
    leadStatus: row.lead_status ?? null,
  });
}
