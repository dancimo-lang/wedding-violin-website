import 'server-only';
import { formatMoney } from '@/lib/contracts/money';
import {
  adminOrNull,
  isUuid,
  notePayment,
  recordPayment,
  sendCouplePaidMail,
  type Admin,
} from './shared';

export type PaymentListRow = {
  id: string;
  method: string;
  amountLabel: string;
  transactionNumber: string;
  paidOn: string;
  status: string;
  kind: string;
};

export type OpenObligationRow = {
  id: string;
  kind: string;
  amountCents: number;
  amountLabel: string;
  bookingCode: string;
  dueOn: string | null;
};

function amountLabel(cents: number | null, dollars: number | string | null): string {
  if (typeof cents === 'number') return `$${formatMoney(cents)}`;
  if (typeof dollars === 'number') return `$${dollars.toFixed(2)}`;
  if (typeof dollars === 'string' && dollars) return `$${Number(dollars).toFixed(2)}`;
  return '';
}

function methodLabel(method: string | null, paymentType: string | null): string {
  if (method === 'zelle') return 'Zelle';
  if (method === 'stripe_card') return 'Card';
  if (method === 'stripe_ach') return 'Bank account';
  if (method === 'manual') return 'Manual';
  return paymentType || 'Payment';
}

export async function bookingPayments(bookingId: string): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!isUuid(bookingId)) return { status: 400, body: { error: 'That booking was not found.' } };
  const admin = adminOrNull();
  if (!admin) return { status: 500, body: { error: 'Payments are not available.' } };
  const [{ data: payments, error: paymentError }, { data: obligations, error: obligationError }, { data: booking }] = await Promise.all([
    admin
      .from('payments')
      .select('id, method, amount, amount_cents, payment_type, status, chase_transaction_number, stripe_payment_intent_id, stripe_checkout_session_id, paid_at, created_at')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: false }),
    admin
      .from('payment_obligations')
      .select('id, kind, amount_cents, status, due_on, booking_code')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: true }),
    admin.from('bookings').select('booking_code').eq('id', bookingId).maybeSingle(),
  ]);
  if (paymentError || obligationError) return { status: 500, body: { error: 'Payments could not be loaded.' } };
  const rows: PaymentListRow[] = (payments ?? []).map((row) => ({
    id: String(row.id),
    method: methodLabel(typeof row.method === 'string' ? row.method : null, typeof row.payment_type === 'string' ? row.payment_type : null),
    amountLabel: amountLabel(typeof row.amount_cents === 'number' ? row.amount_cents : null, row.amount as number | string | null),
    transactionNumber:
      (typeof row.chase_transaction_number === 'string' && row.chase_transaction_number) ||
      (typeof row.stripe_payment_intent_id === 'string' && row.stripe_payment_intent_id) ||
      (typeof row.stripe_checkout_session_id === 'string' && row.stripe_checkout_session_id) ||
      '',
    paidOn: (typeof row.paid_at === 'string' && row.paid_at.slice(0, 10)) || (typeof row.created_at === 'string' ? row.created_at.slice(0, 10) : ''),
    status: typeof row.status === 'string' ? row.status : '',
    kind: typeof row.payment_type === 'string' ? row.payment_type : '',
  }));
  const open: OpenObligationRow[] = (obligations ?? [])
    .filter((row) => row.status === 'open')
    .map((row) => ({
      id: String(row.id),
      kind: String(row.kind),
      amountCents: Number(row.amount_cents),
      amountLabel: `$${formatMoney(Number(row.amount_cents))}`,
      bookingCode: String(row.booking_code),
      dueOn: typeof row.due_on === 'string' ? row.due_on : null,
    }));
  return {
    status: 200,
    body: {
      bookingCode: typeof booking?.booking_code === 'string' ? booking.booking_code : '',
      payments: rows,
      openObligations: open,
    },
  };
}

export type UnmatchedRow = {
  id: string;
  senderName: string;
  amountCents: number;
  amountLabel: string;
  sentOn: string | null;
  memo: string;
  code: string | null;
  transactionNumber: string;
  candidates: { id: string; bookingCode: string; kind: string; amountLabel: string }[];
};

export async function unmatchedQueue(): Promise<{ status: number; body: Record<string, unknown> }> {
  const admin = adminOrNull();
  if (!admin) return { status: 500, body: { error: 'Payments are not available.' } };
  const [{ data: receipts, error }, { data: open }] = await Promise.all([
    admin
      .from('zelle_receipts')
      .select('id, sender_name, amount_cents, sent_on, memo, extracted_code, chase_transaction_number')
      .eq('outcome', 'unmatched')
      .order('created_at', { ascending: false })
      .limit(100),
    admin.from('payment_obligations').select('id, booking_code, kind, amount_cents').eq('status', 'open'),
  ]);
  if (error) return { status: 500, body: { error: 'Unmatched Zelle payments could not be loaded.' } };
  const obligations = open ?? [];
  const rows: UnmatchedRow[] = (receipts ?? []).map((row) => {
    const amountCents = Number(row.amount_cents);
    return {
      id: String(row.id),
      senderName: typeof row.sender_name === 'string' ? row.sender_name : '',
      amountCents,
      amountLabel: `$${formatMoney(amountCents)}`,
      sentOn: typeof row.sent_on === 'string' ? row.sent_on : null,
      memo: typeof row.memo === 'string' ? row.memo : '',
      code: typeof row.extracted_code === 'string' ? row.extracted_code : null,
      transactionNumber: String(row.chase_transaction_number),
      candidates: obligations
        .filter((item) => Number(item.amount_cents) === amountCents)
        .map((item) => ({
          id: String(item.id),
          bookingCode: String(item.booking_code),
          kind: String(item.kind),
          amountLabel: `$${formatMoney(Number(item.amount_cents))}`,
        })),
    };
  });
  return { status: 200, body: { receipts: rows } };
}

async function applyRecorded(
  admin: Admin,
  input: {
    bookingId: string;
    bookingCode: string;
    kind: 'retainer' | 'balance';
    amountCents: number;
    leadId: string | null;
    title: string;
    request?: Request;
  },
): Promise<{ emailSent: boolean; emailSkipped: boolean }> {
  await notePayment(admin, {
    leadId: input.leadId,
    bookingId: input.bookingId,
    title: input.title,
    body: input.bookingCode,
  });
  const mailed = await sendCouplePaidMail({
    admin,
    bookingId: input.bookingId,
    bookingCode: input.bookingCode,
    kind: input.kind,
    amountCents: input.amountCents,
    request: input.request,
  });
  return { emailSent: mailed.sent, emailSkipped: mailed.skipped };
}

export async function assignReceipt(input: {
  receiptId: string;
  obligationId: string;
  request?: Request;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!isUuid(input.receiptId) || !isUuid(input.obligationId)) {
    return { status: 400, body: { error: 'Choose an unmatched payment and an open amount.' } };
  }
  const admin = adminOrNull();
  if (!admin) return { status: 500, body: { error: 'Payments are not available.' } };
  const { data: receipt } = await admin
    .from('zelle_receipts')
    .select('id, outcome, amount_cents, chase_transaction_number, sender_name, memo, sent_on')
    .eq('id', input.receiptId)
    .maybeSingle();
  if (!receipt || receipt.outcome !== 'unmatched') {
    return { status: 409, body: { error: 'That Zelle payment is not waiting to be assigned.' } };
  }
  const { data: obligation } = await admin
    .from('payment_obligations')
    .select('id, booking_id, booking_code, kind, amount_cents, status')
    .eq('id', input.obligationId)
    .maybeSingle();
  if (!obligation || obligation.status !== 'open') return { status: 409, body: { error: 'That payment is not open.' } };
  if (Number(obligation.amount_cents) !== Number(receipt.amount_cents)) {
    return { status: 409, body: { error: 'That open payment is a different amount.' } };
  }
  const kind = obligation.kind === 'balance' ? 'balance' : 'retainer';
  const recorded = await recordPayment(admin, {
    obligationId: input.obligationId,
    amountCents: Number(receipt.amount_cents),
    method: 'zelle',
    paymentStatus: 'Completed',
    chaseTransactionNumber: String(receipt.chase_transaction_number),
    payerName: typeof receipt.sender_name === 'string' ? receipt.sender_name : null,
    memo: typeof receipt.memo === 'string' ? receipt.memo : null,
    externalPaidOn: typeof receipt.sent_on === 'string' ? receipt.sent_on : null,
    paidAt: new Date().toISOString(),
  });
  if (!recorded.ok) return { status: 500, body: { error: recorded.error } };
  if (recorded.row.result === 'not_open' || recorded.row.result === 'amount_mismatch') {
    return { status: 409, body: { error: 'That payment is not open.' } };
  }
  await admin
    .from('zelle_receipts')
    .update({
      outcome: 'matched',
      obligation_id: input.obligationId,
      booking_id: obligation.booking_id,
      payment_id: recorded.row.payment_id ?? null,
      extracted_code: obligation.booking_code,
      couple_notified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.receiptId);
  const mail = await applyRecorded(admin, {
    bookingId: String(obligation.booking_id),
    bookingCode: String(obligation.booking_code),
    kind,
    amountCents: Number(receipt.amount_cents),
    leadId: recorded.row.lead_id ?? null,
    title: 'Zelle payment assigned',
    request: input.request,
  });
  if (!mail.emailSent && !mail.emailSkipped) {
    await admin.from('zelle_receipts').update({ couple_notified_at: null }).eq('id', input.receiptId);
  }
  return { status: 200, body: { ok: true, ...mail } };
}

export async function manualPayment(input: {
  bookingId: string;
  obligationId: string;
  method: string;
  transactionNumber?: string;
  payerName?: string;
  memo?: string;
  paidOn?: string;
  request?: Request;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!isUuid(input.bookingId) || !isUuid(input.obligationId)) {
    return { status: 400, body: { error: 'Choose the booking and the open payment.' } };
  }
  const method = input.method;
  if (method !== 'zelle' && method !== 'stripe_card' && method !== 'stripe_ach' && method !== 'manual') {
    return { status: 400, body: { error: 'Choose how the payment arrived.' } };
  }
  const paidOn = input.paidOn?.trim() ?? '';
  if (paidOn && !/^\d{4}-\d{2}-\d{2}$/.test(paidOn)) return { status: 400, body: { error: 'Use a real payment date.' } };
  const transactionNumber = input.transactionNumber?.trim() ?? '';
  if (transactionNumber && !/^[A-Za-z0-9_-]{4,80}$/.test(transactionNumber)) {
    return { status: 400, body: { error: 'The transaction number looks wrong.' } };
  }
  const admin = adminOrNull();
  if (!admin) return { status: 500, body: { error: 'Payments are not available.' } };
  const { data: obligation } = await admin
    .from('payment_obligations')
    .select('id, booking_id, booking_code, kind, amount_cents, status')
    .eq('id', input.obligationId)
    .maybeSingle();
  if (!obligation || obligation.booking_id !== input.bookingId || obligation.status !== 'open') {
    return { status: 409, body: { error: 'That payment is not open.' } };
  }
  const kind = obligation.kind === 'balance' ? 'balance' : 'retainer';
  const recorded = await recordPayment(admin, {
    obligationId: input.obligationId,
    amountCents: Number(obligation.amount_cents),
    method,
    paymentStatus: 'Completed',
    chaseTransactionNumber: method === 'zelle' || method === 'manual' ? transactionNumber || null : null,
    stripePaymentIntentId: method === 'stripe_card' || method === 'stripe_ach' ? transactionNumber || null : null,
    payerName: input.payerName?.trim().slice(0, 200) || null,
    memo: input.memo?.trim().slice(0, 500) || null,
    externalPaidOn: paidOn || null,
    paidAt: paidOn ? `${paidOn}T12:00:00.000Z` : new Date().toISOString(),
  });
  if (!recorded.ok) return { status: 500, body: { error: recorded.error } };
  if (recorded.row.result === 'duplicate') return { status: 200, body: { ok: true, duplicate: true } };
  if (recorded.row.result !== 'created' && recorded.row.result !== 'upgraded') {
    return { status: 409, body: { error: 'That payment is not open.' } };
  }
  const mail = await applyRecorded(admin, {
    bookingId: input.bookingId,
    bookingCode: String(obligation.booking_code),
    kind,
    amountCents: Number(obligation.amount_cents),
    leadId: recorded.row.lead_id ?? null,
    title: 'Payment recorded by hand',
    request: input.request,
  });
  return { status: 200, body: { ok: true, ...mail } };
}

export type { Admin };
