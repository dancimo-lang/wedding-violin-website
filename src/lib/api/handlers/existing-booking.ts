import { NextResponse } from 'next/server';
import {
  EXISTING_BOOKING_SOURCE,
  existingBookingNotes,
  packageLabel,
  parseExistingBooking,
  planExistingPayments,
  PAYMENT_METHOD_LABELS,
  type ExistingBookingMarker,
} from '@/lib/bookings/existing-booking';
import { generateBookingCode, isBookingCode } from '@/lib/contracts/booking-code';
import { runGoogleSync } from '@/lib/google/run';
import { requireAdminApi } from '@/lib/require-admin-api';
import { createAdminClient } from '@/lib/supabase/admin';

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Adds a wedding that was booked and paid outside the site.
 * Sends no email, creates no contract, and starts no Stripe or Zelle request.
 * Paid halves are recorded as manual payments so the admin shows no money owed.
 */
export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (auth.response || !auth.session) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Could not read that request.' }, { status: 400 });
  }
  const input = parseExistingBooking(body);
  if ('error' in input) return NextResponse.json({ error: input.error }, { status: 400 });
  const plan = planExistingPayments(input.totalCents, input.weddingDate, input.paymentStatus);
  if ('error' in plan) return NextResponse.json({ error: plan.error }, { status: 400 });

  let admin: AdminClient;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'Could not save the booking.' }, { status: 500 });
  }

  let clientId: string | null = null;
  if (input.email) {
    const { data } = await admin.from('clients').select('id').eq('email', input.email).maybeSingle();
    clientId = (data?.id as string | undefined) ?? null;
  }
  if (!clientId) {
    const { data, error } = await admin
      .from('clients')
      .insert({ name: input.client1Name, partner_name: input.client2Name, email: input.email, phone: input.phone })
      .select('id')
      .single();
    if (error || !data) return NextResponse.json({ error: 'Could not save the client.' }, { status: 500 });
    clientId = data.id as string;
  }

  const { data: synced, error: bookingError } = await admin.rpc('sync_booking_and_lead', {
    p_action: 'apply_booking',
    p_booking_id: null,
    p_lead_id: null,
    p_status: 'Confirmed',
    p_reason: null,
    p_actor: auth.session.id,
    p_fields: {
      client_id: clientId,
      event_date: input.weddingDate,
      venue_name: input.venueName,
      venue_address: input.venueAddress,
      service_type: packageLabel(input.packageChoice),
      performance_start_time: input.startTime,
      performance_end_time: input.endTime,
      total_price: (plan.totalCents / 100).toFixed(2),
      retainer_amount: (plan.retainerCents / 100).toFixed(2),
      balance_due_date: plan.balanceDueDate,
      special_requests: existingBookingNotes(input),
    },
  });
  const bookingId = (synced as { booking_id?: string } | null)?.booking_id ?? null;
  if (bookingError || !bookingId) {
    const line = (bookingError?.message || '').split('\n')[0]?.replace(/^ERROR:\s*/i, '').trim();
    return NextResponse.json({ error: line || 'Could not save the booking.' }, { status: 409 });
  }

  // Marker first, then drop the queued Google push, so the sync can never pick it up.
  const marker: ExistingBookingMarker = {
    source: EXISTING_BOOKING_SOURCE,
    manually_added: true,
    paid_outside_site: true,
    google_sync: input.addToGoogle,
    payment_status: input.paymentStatus,
    payment_method: input.paymentMethod,
    package: input.packageChoice,
  };
  const { error: markerError } = await admin.from('activity_events').insert({
    booking_id: bookingId,
    event_type: 'note',
    title: 'Added as an existing booking',
    body: `Booked and paid outside the site. ${input.addToGoogle ? 'Copied to Google Calendar.' : 'Not copied to Google Calendar.'}`,
    metadata: marker,
    created_by: auth.session.id,
  });
  if (!input.addToGoogle) {
    await admin.from('google_sync_outbox').delete().eq('source_table', 'bookings').eq('source_id', bookingId);
  }
  if (markerError) {
    if (!input.addToGoogle) {
      await admin.rpc('sync_booking_and_lead', {
        p_action: 'apply_booking',
        p_booking_id: bookingId,
        p_lead_id: null,
        p_status: 'Cancelled',
        p_reason: 'Could not save the existing-booking marker.',
        p_actor: auth.session.id,
        p_fields: {},
      });
    }
    return NextResponse.json({ error: 'Could not save the booking. Try again.' }, { status: 500 });
  }

  let paymentsSaved = true;
  if (plan.obligations.length > 0) {
    try {
      const code = await ensureBookingCode(admin, bookingId);
      const { data: rows, error } = await admin
        .from('payment_obligations')
        .insert(
          plan.obligations.map((o) => ({
            booking_id: bookingId,
            contract_id: null,
            booking_code: code,
            kind: o.kind,
            amount_cents: o.amountCents,
            status: 'open',
            due_on: o.dueOn,
          })),
        )
        .select('id, kind');
      if (error || !rows) throw error ?? new Error('no rows');
      const method = input.paymentMethod ? PAYMENT_METHOD_LABELS[input.paymentMethod] : 'not recorded';
      for (const o of plan.obligations.filter((item) => item.paid)) {
        const row = rows.find((r) => r.kind === o.kind);
        if (!row) continue;
        const { error: payError } = await admin.rpc('record_matched_payment', {
          p_obligation_id: row.id,
          p_amount_cents: o.amountCents,
          p_method: 'manual',
          p_payment_status: 'Completed',
          p_chase_transaction_number: null,
          p_stripe_session_id: null,
          p_stripe_payment_intent_id: null,
          p_payer_name: input.client1Name,
          p_memo: `Paid outside the site (${method}). Added manually as an existing booking.`,
          p_fee_cents: 0,
          p_paid_at: new Date().toISOString(),
          p_external_paid_on: null,
        });
        if (payError) paymentsSaved = false;
      }
    } catch {
      paymentsSaved = false;
    }
  }

  if (input.addToGoogle) {
    try {
      await runGoogleSync();
    } catch {
      // The outbox keeps the change until the next sync.
    }
  }

  return NextResponse.json({
    ok: true,
    bookingId,
    paymentsSaved,
    owedCents: plan.owedCents,
  });
}

async function ensureBookingCode(admin: AdminClient, bookingId: string): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateBookingCode();
    const { data, error } = await admin
      .from('bookings')
      .update({ booking_code: code, updated_at: new Date().toISOString() })
      .eq('id', bookingId)
      .is('booking_code', null)
      .select('booking_code')
      .maybeSingle();
    if (!error && data?.booking_code) return data.booking_code as string;
    if (error && error.code !== '23505') throw error;
    const { data: again } = await admin.from('bookings').select('booking_code').eq('id', bookingId).maybeSingle();
    if (typeof again?.booking_code === 'string' && isBookingCode(again.booking_code)) return again.booking_code;
  }
  throw new Error('Could not assign a booking code.');
}
