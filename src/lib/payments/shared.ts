import 'server-only';
import { contractFromAddress, contractOwnerEmail } from '@/lib/contracts/mail';
import { sendContractMail } from '@/lib/contracts/delivery';
import { runGoogleSync } from '@/lib/google/run';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  confirmationEmail,
  failedPaymentEmail,
  ownerConflictEmail,
  processingEmail,
  receiptEmail,
} from './messages';
import { paymentPageUrl, siteOrigin } from './urls';
import { zelleRecipientContact, zelleRecipientName } from './zelle-config';
import { zelleQrSources } from './zelle-qr';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID.test(value);
}

export type Admin = ReturnType<typeof createAdminClient>;

export function adminOrNull(): Admin | null {
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

export function mailReady(): boolean {
  return Boolean(process.env.RESEND_API_KEY && contractFromAddress());
}

export type RecordResult = {
  result: 'created' | 'duplicate' | 'upgraded' | 'failed' | 'processing' | 'not_open' | 'amount_mismatch';
  payment_id?: string;
  kind?: 'retainer' | 'balance';
  booking_id?: string;
  lead_id?: string;
  payment_status?: string;
};

export async function recordPayment(
  admin: Admin,
  input: {
    obligationId: string;
    amountCents: number;
    method: 'zelle' | 'stripe_card' | 'stripe_ach' | 'manual';
    paymentStatus: 'Processing' | 'Completed' | 'Failed';
    chaseTransactionNumber?: string | null;
    stripeSessionId?: string | null;
    stripePaymentIntentId?: string | null;
    payerName?: string | null;
    memo?: string | null;
    feeCents?: number;
    paidAt?: string | null;
    externalPaidOn?: string | null;
  },
): Promise<{ ok: true; row: RecordResult } | { ok: false; error: string }> {
  const { data, error } = await admin.rpc('record_matched_payment', {
    p_obligation_id: input.obligationId,
    p_amount_cents: input.amountCents,
    p_method: input.method,
    p_payment_status: input.paymentStatus,
    p_chase_transaction_number: input.chaseTransactionNumber ?? null,
    p_stripe_session_id: input.stripeSessionId ?? null,
    p_stripe_payment_intent_id: input.stripePaymentIntentId ?? null,
    p_payer_name: input.payerName ?? null,
    p_memo: input.memo ?? null,
    p_fee_cents: input.feeCents ?? 0,
    p_paid_at: input.paidAt ?? null,
    p_external_paid_on: input.externalPaidOn ?? null,
  });
  if (error || !data || typeof data !== 'object') {
    console.error('Payment was not recorded', error?.code ?? 'unknown');
    return { ok: false, error: 'The payment could not be recorded.' };
  }
  return { ok: true, row: data as RecordResult };
}

type Couple = {
  email: string | null;
  name: string | null;
  token: string | null;
  bookingCode: string;
  balanceCents: number;
  balanceDueOn: string | null;
};

export async function loadCouple(admin: Admin, bookingId: string, bookingCode: string): Promise<Couple> {
  const [{ data: booking }, { data: contract }, { data: balance }] = await Promise.all([
    admin.from('bookings').select('client_id, booking_code').eq('id', bookingId).maybeSingle(),
    admin
      .from('contracts')
      .select('access_token, client1_name')
      .eq('booking_id', bookingId)
      .eq('status', 'signed')
      .order('signed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from('payment_obligations')
      .select('amount_cents, due_on, status')
      .eq('booking_id', bookingId)
      .eq('kind', 'balance')
      .neq('status', 'void')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  let email: string | null = null;
  let name: string | null = typeof contract?.client1_name === 'string' ? contract.client1_name : null;
  const clientId = typeof booking?.client_id === 'string' ? booking.client_id : '';
  if (clientId) {
    const { data: client } = await admin.from('clients').select('email, name').eq('id', clientId).maybeSingle();
    email = typeof client?.email === 'string' && client.email.trim() ? client.email.trim() : null;
    if (!name && typeof client?.name === 'string') name = client.name;
  }
  return {
    email,
    name,
    token: typeof contract?.access_token === 'string' ? contract.access_token : null,
    bookingCode: (typeof booking?.booking_code === 'string' && booking.booking_code) || bookingCode,
    balanceCents: typeof balance?.amount_cents === 'number' ? balance.amount_cents : 0,
    balanceDueOn: typeof balance?.due_on === 'string' ? balance.due_on : null,
  };
}

export async function confirmRetainer(
  admin: Admin,
  bookingId: string,
): Promise<{ confirmed: boolean; detail: string }> {
  const { data: booking } = await admin.from('bookings').select('id, status, lead_id').eq('id', bookingId).maybeSingle();
  if (!booking) return { confirmed: false, detail: 'The booking could not be found.' };
  if (booking.status === 'Confirmed' || booking.status === 'Completed') return { confirmed: true, detail: '' };
  if (booking.status === 'Cancelled') return { confirmed: false, detail: 'The booking is cancelled.' };

  const { data: owner } = await admin.from('admins').select('user_id').limit(1).maybeSingle();
  const actor = typeof owner?.user_id === 'string' ? owner.user_id : '';
  if (!actor) {
    const { error } = await admin
      .from('bookings')
      .update({ status: 'Confirmed', updated_at: new Date().toISOString() })
      .eq('id', bookingId)
      .eq('status', 'Tentative');
    if (error) return { confirmed: false, detail: 'The booking could not be confirmed.' };
    if (typeof booking.lead_id === 'string') {
      await admin
        .from('leads')
        .update({ status: 'Confirmed', updated_at: new Date().toISOString() })
        .eq('id', booking.lead_id);
    }
    return { confirmed: true, detail: '' };
  }

  const { error } = await admin.rpc('sync_booking_and_lead', {
    p_action: 'apply_booking',
    p_booking_id: bookingId,
    p_lead_id: booking.lead_id,
    p_status: 'Confirmed',
    p_reason: null,
    p_actor: actor,
    p_fields: {},
  });
  if (error) {
    const detail = error.message?.includes('not allowed') ? 'The booking could not be confirmed.' : error.message;
    return { confirmed: false, detail: detail || 'The booking could not be confirmed.' };
  }
  try {
    await runGoogleSync();
  } catch {
    // The calendar outbox keeps the change until the next sync.
  }
  return { confirmed: true, detail: '' };
}

export async function notePayment(
  admin: Admin,
  input: { leadId: string | null; bookingId: string; title: string; body: string },
): Promise<void> {
  try {
    await admin.from('activity_events').insert({
      lead_id: input.leadId,
      booking_id: input.bookingId,
      event_type: 'payment',
      title: input.title,
      body: input.body,
    });
  } catch {
    // The payment row is already stored.
  }
}

export async function sendCouplePaidMail(input: {
  admin: Admin;
  bookingId: string;
  bookingCode: string;
  kind: 'retainer' | 'balance';
  amountCents: number;
  request?: Request;
}): Promise<{ sent: boolean; skipped: boolean; confirmed: boolean }> {
  const couple = await loadCouple(input.admin, input.bookingId, input.bookingCode);
  const qr = zelleQrSources();
  const origin = siteOrigin(input.request);
  const payUrl = couple.token ? paymentPageUrl(origin, couple.token) : null;
  let confirmed = input.kind !== 'retainer';
  if (input.kind === 'retainer') {
    const result = await confirmRetainer(input.admin, input.bookingId);
    confirmed = result.confirmed;
    if (!result.confirmed) {
      const owner = contractOwnerEmail();
      const mail = ownerConflictEmail({
        bookingCode: couple.bookingCode,
        amountCents: input.amountCents,
        detail: result.detail,
      });
      if (owner) await sendContractMail({ to: owner, subject: mail.subject, html: mail.html });
    }
  }
  if (!couple.email) return { sent: false, skipped: true, confirmed };
  if (!mailReady()) return { sent: false, skipped: true, confirmed };
  const message =
    input.kind === 'retainer'
      ? confirmationEmail({
          name: couple.name || '',
          bookingCode: couple.bookingCode,
          amountPaidCents: input.amountCents,
          balanceCents: couple.balanceCents,
          balanceDueOn: couple.balanceDueOn,
          bookingConfirmed: confirmed,
          recipientName: zelleRecipientName(),
          recipientContact: zelleRecipientContact(),
          payUrl,
          qrEmailUrl: qr.emailUrl,
        })
      : receiptEmail({
          name: couple.name || '',
          bookingCode: couple.bookingCode,
          amountPaidCents: input.amountCents,
        });
  const sent = await sendContractMail({ to: couple.email, subject: message.subject, html: message.html });
  return { sent, skipped: false, confirmed };
}

export async function sendCoupleStatusMail(input: {
  admin: Admin;
  bookingId: string;
  bookingCode: string;
  kind: 'retainer' | 'balance';
  amountCents: number;
  which: 'processing' | 'failed';
  request?: Request;
}): Promise<{ sent: boolean; skipped: boolean }> {
  const couple = await loadCouple(input.admin, input.bookingId, input.bookingCode);
  if (!couple.email || !mailReady()) return { sent: false, skipped: true };
  const origin = siteOrigin(input.request);
  const payUrl = couple.token ? paymentPageUrl(origin, couple.token) : null;
  const message =
    input.which === 'processing'
      ? processingEmail({
          name: couple.name || '',
          bookingCode: couple.bookingCode,
          amountCents: input.amountCents,
          kind: input.kind,
        })
      : failedPaymentEmail({
          name: couple.name || '',
          bookingCode: couple.bookingCode,
          amountCents: input.amountCents,
          payUrl,
          recipientName: zelleRecipientName(),
          recipientContact: zelleRecipientContact(),
        });
  const sent = await sendContractMail({ to: couple.email, subject: message.subject, html: message.html });
  const owner = contractOwnerEmail();
  if (owner && owner.toLowerCase() !== couple.email.toLowerCase()) {
    await sendContractMail({ to: owner, subject: message.subject, html: message.html });
  }
  return { sent, skipped: false };
}
