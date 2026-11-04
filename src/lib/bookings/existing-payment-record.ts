import 'server-only';
import {
  EXISTING_BOOKING_SOURCE,
  EXISTING_PAYMENT_METHODS,
  dollarsToCents,
  isReplaceableOutsidePayment,
  outsidePaymentMemo,
  PAYMENT_METHOD_LABELS,
  paymentStatusFor,
  planExistingPayments,
  type ExistingBookingMarker,
  type ExistingPaymentMethod,
} from '@/lib/bookings/existing-booking';
import { generateBookingCode, isBookingCode } from '@/lib/contracts/booking-code';
import { formatMoney } from '@/lib/contracts/money';
import { generateContractToken, isContractToken } from '@/lib/contracts/token';
import { paymentPageUrl } from '@/lib/payments/urls';
import { createAdminClient } from '@/lib/supabase/admin';

type Admin = ReturnType<typeof createAdminClient>;

type MarkerRow = { id: string; metadata: ExistingBookingMarker };

export type ExistingPaymentView = {
  existing: boolean;
  bookingCode: string;
  totalCents: number;
  paidCents: number;
  owedCents: number;
  balanceDueDate: string | null;
  paymentLink: string | null;
  canReplace: boolean;
  blockedReason: string | null;
};

function centsFromMoney(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value * 100);
  if (typeof value === 'string') return dollarsToCents(value);
  return null;
}

function markerFrom(row: { id?: unknown; metadata?: unknown } | null): MarkerRow | null {
  if (!row || typeof row.id !== 'string' || !row.metadata || typeof row.metadata !== 'object') return null;
  const meta = row.metadata as Record<string, unknown>;
  if (meta.source !== EXISTING_BOOKING_SOURCE) return null;
  return { id: row.id, metadata: meta as ExistingBookingMarker };
}

async function loadMarker(admin: Admin, bookingId: string): Promise<MarkerRow | null> {
  const { data } = await admin
    .from('activity_events')
    .select('id, metadata')
    .eq('booking_id', bookingId)
    .eq('title', 'Added as an existing booking');
  for (const row of data ?? []) {
    const marker = markerFrom(row);
    if (marker) return marker;
  }
  return null;
}

async function ensureBookingCode(admin: Admin, bookingId: string, current: string | null): Promise<string> {
  if (current && isBookingCode(current)) return current;
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

export async function existingPaymentView(admin: Admin, bookingId: string, origin: string): Promise<ExistingPaymentView | { error: string }> {
  const { data: booking } = await admin
    .from('bookings')
    .select('id, booking_code, total_price, balance_due_date')
    .eq('id', bookingId)
    .maybeSingle();
  if (!booking) return { error: 'That booking was not found.' };
  const marker = await loadMarker(admin, bookingId);
  if (!marker) {
    return {
      existing: false,
      bookingCode: '',
      totalCents: 0,
      paidCents: 0,
      owedCents: 0,
      balanceDueDate: null,
      paymentLink: null,
      canReplace: false,
      blockedReason: null,
    };
  }
  const [{ data: payments }, { data: obligations }, { data: sessions }] = await Promise.all([
    admin.from('payments').select('method, memo, status, amount_cents').eq('booking_id', bookingId),
    admin.from('payment_obligations').select('status, amount_cents').eq('booking_id', bookingId),
    admin.from('stripe_checkout_sessions').select('id').eq('booking_id', bookingId).limit(1),
  ]);
  const paymentRows = payments ?? [];
  const blocked = paymentRows.filter((row) => !isReplaceableOutsidePayment({
    method: typeof row.method === 'string' ? row.method : null,
    memo: typeof row.memo === 'string' ? row.memo : null,
    status: typeof row.status === 'string' ? row.status : null,
  }));
  const hasCheckout = (sessions ?? []).length > 0;
  const paidCents = paymentRows
    .filter((row) => row.status === 'Completed')
    .reduce((sum, row) => sum + (typeof row.amount_cents === 'number' ? row.amount_cents : 0), 0);
  const owedCents = (obligations ?? [])
    .filter((row) => row.status === 'open')
    .reduce((sum, row) => sum + (typeof row.amount_cents === 'number' ? row.amount_cents : 0), 0);
  const token = typeof marker.metadata.payment_token === 'string' ? marker.metadata.payment_token : '';
  return {
    existing: true,
    bookingCode: typeof booking.booking_code === 'string' ? booking.booking_code : '',
    totalCents: centsFromMoney(booking.total_price) ?? 0,
    paidCents,
    owedCents,
    balanceDueDate: typeof booking.balance_due_date === 'string' ? booking.balance_due_date : null,
    paymentLink: token && isContractToken(token) && owedCents > 0 ? paymentPageUrl(origin, token) : null,
    canReplace: blocked.length === 0 && !hasCheckout,
    blockedReason: hasCheckout
      ? 'A card or bank payment was already started, so this record was left as it is.'
      : blocked.length > 0
        ? 'A payment on this booking did not come from the existing-booking form, so it was left as it is.'
        : null,
  };
}

async function writeObligations(
  admin: Admin,
  input: {
    bookingId: string;
    bookingCode: string;
    payerName: string;
    methodLabel: string;
    obligations: { kind: 'retainer' | 'balance'; amountCents: number; dueOn: string | null; paid: boolean }[];
  },
): Promise<boolean> {
  if (input.obligations.length === 0) return true;
  const { data: rows, error } = await admin
    .from('payment_obligations')
    .insert(
      input.obligations.map((item) => ({
        booking_id: input.bookingId,
        contract_id: null,
        booking_code: input.bookingCode,
        kind: item.kind,
        amount_cents: item.amountCents,
        status: 'open',
        due_on: item.dueOn,
      })),
    )
    .select('id, kind');
  if (error || !rows) return false;
  for (const item of input.obligations.filter((row) => row.paid)) {
    const row = rows.find((saved) => saved.kind === item.kind);
    if (!row) return false;
    const { error: payError } = await admin.rpc('record_matched_payment', {
      p_obligation_id: row.id,
      p_amount_cents: item.amountCents,
      p_method: 'manual',
      p_payment_status: 'Completed',
      p_chase_transaction_number: null,
      p_stripe_session_id: null,
      p_stripe_payment_intent_id: null,
      p_payer_name: input.payerName,
      p_memo: outsidePaymentMemo(input.methodLabel),
      p_fee_cents: 0,
      p_paid_at: new Date().toISOString(),
      p_external_paid_on: null,
    });
    if (payError) return false;
  }
  return true;
}

export async function replaceExistingPayment(
  admin: Admin,
  input: {
    bookingId: string;
    amountPaid: unknown;
    balanceDueDate: unknown;
    paymentMethod: unknown;
    actorId: string;
    origin: string;
  },
): Promise<{ status: number; body: Record<string, unknown> }> {
  const view = await existingPaymentView(admin, input.bookingId, input.origin);
  if ('error' in view) return { status: 404, body: { error: view.error } };
  if (!view.existing) return { status: 409, body: { error: 'That booking was not added as an existing booking.' } };
  if (!view.canReplace) return { status: 409, body: { error: view.blockedReason || 'This payment record cannot be replaced.' } };

  const { data: booking } = await admin
    .from('bookings')
    .select('id, booking_code, total_price, event_date, client_id')
    .eq('id', input.bookingId)
    .maybeSingle();
  if (!booking) return { status: 404, body: { error: 'That booking was not found.' } };
  const totalCents = centsFromMoney(booking.total_price);
  const weddingDate = typeof booking.event_date === 'string' ? booking.event_date : '';
  const paidCents = dollarsToCents(input.amountPaid);
  if (totalCents == null || paidCents == null) return { status: 400, body: { error: 'Enter the amount already paid, or 0.' } };
  const dueRaw = typeof input.balanceDueDate === 'string' ? input.balanceDueDate.trim() : '';
  const plan = planExistingPayments(totalCents, weddingDate, paidCents, dueRaw || null);
  if ('error' in plan) return { status: 400, body: { error: plan.error } };

  const methodRaw = typeof input.paymentMethod === 'string' && input.paymentMethod ? input.paymentMethod : null;
  if (methodRaw && !(EXISTING_PAYMENT_METHODS as readonly string[]).includes(methodRaw)) {
    return { status: 400, body: { error: 'Choose a payment method.' } };
  }
  const method = methodRaw as ExistingPaymentMethod | null;
  const methodLabel = method ? PAYMENT_METHOD_LABELS[method] : 'not recorded';

  const marker = await loadMarker(admin, input.bookingId);
  if (!marker) return { status: 409, body: { error: 'That booking was not added as an existing booking.' } };

  const [{ data: previousObligations, error: previousError }, { data: previousPayments, error: previousPaymentError }] = await Promise.all([
    admin.from('payment_obligations').select('id, status').eq('booking_id', input.bookingId),
    admin.from('payments').select('id').eq('booking_id', input.bookingId),
  ]);
  if (previousPaymentError) return { status: 500, body: { error: 'The old payment record could not be read.' } };
  if (previousError) return { status: 500, body: { error: 'The old payment record could not be read.' } };
  const previous = previousObligations ?? [];
  const now = new Date().toISOString();
  if (previous.length > 0) {
    const { error: voidError } = await admin
      .from('payment_obligations')
      .update({ status: 'void', updated_at: now })
      .eq('booking_id', input.bookingId)
      .neq('status', 'void');
    if (voidError) return { status: 500, body: { error: 'The old payment record could not be replaced.' } };
  }

  let code: string;
  try {
    code = await ensureBookingCode(admin, input.bookingId, typeof booking.booking_code === 'string' ? booking.booking_code : null);
  } catch {
    return { status: 500, body: { error: 'Could not keep the booking code.' } };
  }

  let payerName = 'Client';
  if (typeof booking.client_id === 'string') {
    const { data: client } = await admin.from('clients').select('name').eq('id', booking.client_id).maybeSingle();
    if (typeof client?.name === 'string' && client.name.trim()) payerName = client.name.trim();
  }
  const saved = await writeObligations(admin, {
    bookingId: input.bookingId,
    bookingCode: code,
    payerName,
    methodLabel,
    obligations: plan.obligations,
  });
  if (!saved) {
    const previousIds = new Set(previous.map((row) => row.id));
    const { data: current } = await admin.from('payment_obligations').select('id').eq('booking_id', input.bookingId);
    const freshIds = (current ?? []).map((row) => String(row.id)).filter((id) => !previousIds.has(id));
    if (freshIds.length > 0) {
      await admin.from('payments').delete().in('obligation_id', freshIds);
      await admin.from('payment_obligations').delete().in('id', freshIds);
    }
    for (const row of previous) {
      if (typeof row.status === 'string') {
        await admin.from('payment_obligations').update({ status: row.status, updated_at: now }).eq('id', row.id);
      }
    }
    return { status: 500, body: { error: 'The new payment record could not be saved. The previous record was kept.' } };
  }
  const oldPaymentIds = (previousPayments ?? []).map((row) => String(row.id)).filter((id) => id.length > 0);
  if (oldPaymentIds.length > 0) {
    const { error: dropOldPayments } = await admin.from('payments').delete().in('id', oldPaymentIds);
    if (dropOldPayments) return { status: 500, body: { error: 'The new amount was saved, but the old outside payment is still listed. Do not save again until that is checked.' } };
  }

  await admin
    .from('bookings')
    .update({
      retainer_amount: (plan.retainerCents / 100).toFixed(2),
      balance_due_date: plan.balanceDueDate,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.bookingId);

  const previousToken = typeof marker.metadata.payment_token === 'string' ? marker.metadata.payment_token : '';
  const paymentToken = plan.owedCents > 0
    ? (isContractToken(previousToken) ? previousToken : generateContractToken())
    : null;
  const nextMarker: ExistingBookingMarker = {
    ...marker.metadata,
    source: EXISTING_BOOKING_SOURCE,
    manually_added: true,
    paid_outside_site: true,
    payment_status: paymentStatusFor(plan.paidCents, plan.totalCents),
    payment_method: method,
    paid_cents: plan.paidCents,
    balance_due_on: plan.balanceDueDate,
    payment_token: paymentToken,
  };
  await admin.from('activity_events').update({ metadata: nextMarker }).eq('id', marker.id);
  await admin.from('activity_events').insert({
    booking_id: input.bookingId,
    event_type: 'note',
    title: 'Existing booking payment corrected',
    body: `Amount already paid set to $${formatMoney(plan.paidCents)}. Still owed $${formatMoney(plan.owedCents)}. No email was sent.`,
    metadata: { source: EXISTING_BOOKING_SOURCE, action: 'payment_corrected' },
    created_by: input.actorId,
  });

  return {
    status: 200,
    body: {
      ok: true,
      paidCents: plan.paidCents,
      owedCents: plan.owedCents,
      bookingCode: code,
      paymentLink: paymentToken ? paymentPageUrl(input.origin, paymentToken) : null,
    },
  };
}

export async function ensureExistingPaymentLink(
  admin: Admin,
  bookingId: string,
  origin: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const view = await existingPaymentView(admin, bookingId, origin);
  if ('error' in view) return { status: 404, body: { error: view.error } };
  if (!view.existing) return { status: 409, body: { error: 'That booking was not added as an existing booking.' } };
  if (view.owedCents <= 0) return { status: 409, body: { error: 'Nothing is owed, so there is no payment link.' } };
  if (view.paymentLink) return { status: 200, body: { ok: true, paymentLink: view.paymentLink, bookingCode: view.bookingCode } };
  const marker = await loadMarker(admin, bookingId);
  if (!marker) return { status: 409, body: { error: 'That booking was not added as an existing booking.' } };
  let code = view.bookingCode;
  try {
    code = await ensureBookingCode(admin, bookingId, code || null);
  } catch {
    return { status: 500, body: { error: 'Could not keep the booking code.' } };
  }
  const paymentToken = generateContractToken();
  const nextMarker: ExistingBookingMarker = {
    ...marker.metadata,
    source: EXISTING_BOOKING_SOURCE,
    manually_added: true,
    paid_outside_site: true,
    payment_token: paymentToken,
  };
  const { error } = await admin.from('activity_events').update({ metadata: nextMarker }).eq('id', marker.id);
  if (error) return { status: 500, body: { error: 'The payment link could not be saved.' } };
  return { status: 200, body: { ok: true, paymentLink: paymentPageUrl(origin, paymentToken), bookingCode: code } };
}
