import 'server-only';
import { contractOwnerEmail } from '@/lib/contracts/mail';
import { sendContractMail } from '@/lib/contracts/delivery';
import { isContractToken } from '@/lib/contracts/token';
import { readFeeSettings, processingFeeCents } from './fees';
import { buildPaymentView } from './view';
import type { ObligationRef } from './match';
import { verifyStripeWebhook } from './stripe-signature';
import { isStripeSecretKey } from './stripe-key';
import { planStripeEvent, type CheckoutSessionStatus } from './stripe-event';
import {
  STRIPE_CHECKOUT_API_VERSION,
  checkoutIdempotencyKey,
  checkoutPaymentMethod,
  checkoutSessionAcceptsMethod,
  checkoutSessionFields,
  offeredPaymentMethodTypes,
  stripeCheckoutErrorDetails,
} from './stripe-session';
import { paymentPageUrl, siteOrigin } from './urls';
import { zelleQrSources } from './zelle-qr';
import { zelleRecipientContact, zelleRecipientName } from './zelle-config';
import {
  adminOrNull,
  isUuid,
  notePayment,
  recordPayment,
  sendCouplePaidMail,
  sendCoupleStatusMail,
  type Admin,
} from './shared';

type ContractPayRow = {
  id: string;
  booking_id: string | null;
  booking_code: string | null;
  status: string;
  access_token: string | null;
};

async function signedContract(admin: Admin, token: string): Promise<ContractPayRow | null> {
  const { data } = await admin
    .from('contracts')
    .select('id, booking_id, booking_code, status, access_token')
    .eq('access_token', token)
    .maybeSingle();
  const row = data as ContractPayRow | null;
  if (!row || row.status !== 'signed' || !row.booking_id || !row.booking_code) return null;
  return row;
}

function stripeReady(): boolean {
  return isStripeSecretKey(process.env.STRIPE_SECRET_KEY);
}

export async function paymentView(token: string): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!isContractToken(token)) return { status: 404, body: { error: 'This payment link is not valid.' } };
  const admin = adminOrNull();
  if (!admin) return { status: 500, body: { error: 'Payments are not available.' } };
  const contract = await signedContract(admin, token);
  if (!contract || !contract.booking_id || !contract.booking_code) {
    return { status: 404, body: { error: 'This payment link is not valid.' } };
  }
  const { data, error } = await admin
    .from('payment_obligations')
    .select('id, booking_id, booking_code, kind, amount_cents, status, due_on')
    .eq('booking_id', contract.booking_id)
    .neq('status', 'void');
  if (error) return { status: 500, body: { error: 'Payments are not available.' } };
  const fees = readFeeSettings();
  if ('error' in fees) return { status: 500, body: { error: fees.error } };
  const obligations: ObligationRef[] = (data ?? [])
    .filter((row) => row.kind === 'retainer' || row.kind === 'balance')
    .map((row) => ({
      id: String(row.id),
      bookingId: String(row.booking_id),
      bookingCode: String(row.booking_code),
      kind: row.kind as 'retainer' | 'balance',
      amountCents: Number(row.amount_cents),
      status: row.status === 'paid' || row.status === 'open' ? row.status : 'void',
      dueOn: typeof row.due_on === 'string' ? row.due_on : null,
    }));
  const qr = zelleQrSources();
  return {
    status: 200,
    body: buildPaymentView({
      bookingCode: contract.booking_code,
      obligations,
      recipientName: zelleRecipientName(),
      recipientContact: zelleRecipientContact(),
      qrUrl: qr.pageUrl,
      stripeReady: stripeReady(),
      fees,
    }),
  };
}

async function processingExists(admin: Admin, obligationId: string): Promise<boolean> {
  const { data } = await admin
    .from('payments')
    .select('id')
    .eq('obligation_id', obligationId)
    .eq('status', 'Processing')
    .limit(1)
    .maybeSingle();
  return Boolean(data?.id);
}

export async function startCheckout(input: {
  token: string;
  obligationId: string;
  method: string;
  request: Request;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!isContractToken(input.token)) return { status: 404, body: { error: 'This payment link is not valid.' } };
  if (!isUuid(input.obligationId)) return { status: 400, body: { error: 'Choose the open payment.' } };
  if (input.method !== 'ach' && input.method !== 'card') return { status: 400, body: { error: 'Choose bank account or card.' } };
  const admin = adminOrNull();
  if (!admin) return { status: 500, body: { error: 'Payments are not available.' } };
  const contract = await signedContract(admin, input.token);
  if (!contract?.booking_id) return { status: 404, body: { error: 'This payment link is not valid.' } };

  const { data: obligation } = await admin
    .from('payment_obligations')
    .select('id, booking_id, booking_code, kind, amount_cents, status')
    .eq('id', input.obligationId)
    .maybeSingle();
  if (!obligation || obligation.booking_id !== contract.booking_id || obligation.status !== 'open') {
    return { status: 409, body: { error: 'That payment is not open.' } };
  }
  if (await processingExists(admin, input.obligationId)) {
    return { status: 409, body: { error: 'A bank payment for this amount is already processing.' } };
  }
  if (!stripeReady()) return { status: 503, body: { error: 'Card and bank payment is not set up yet. Zelle is still available.' } };
  const fees = readFeeSettings();
  if ('error' in fees) return { status: 500, body: { error: fees.error } };

  const method = input.method === 'ach' ? 'stripe_ach' : 'stripe_card';
  const feeCents = processingFeeCents(Number(obligation.amount_cents), input.method === 'ach' ? fees.ach : fees.card);
  const totalCents = Number(obligation.amount_cents) + feeCents;
  const since = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString();
  const { data: reusable } = await admin
    .from('stripe_checkout_sessions')
    .select('url')
    .eq('obligation_id', input.obligationId)
    .eq('method', method)
    .eq('fee_cents', feeCents)
    .eq('status', 'open')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (typeof reusable?.url === 'string' && reusable.url.startsWith('https://')) {
    return { status: 200, body: { url: reusable.url } };
  }

  const origin = siteOrigin(input.request);
  const payUrl = paymentPageUrl(origin, input.token);
  const kind = obligation.kind === 'balance' ? 'balance' : 'retainer';
  const created = await createStripeCheckout({
    secretKey: process.env.STRIPE_SECRET_KEY?.trim() ?? '',
    method,
    amountCents: Number(obligation.amount_cents),
    feeCents,
    bookingCode: String(obligation.booking_code),
    kind,
    obligationId: input.obligationId,
    bookingId: contract.booking_id,
    successUrl: `${payUrl}&paid=1`,
    cancelUrl: `${payUrl}&canceled=1`,
    idempotencyKey: checkoutIdempotencyKey({
      obligationId: input.obligationId,
      method,
      feeCents,
      day: new Date().toISOString().slice(0, 10),
    }),
  });
  if ('error' in created) return { status: 502, body: { error: 'The payment page could not be opened. You can still pay by Zelle.' } };

  const { error } = await admin.from('stripe_checkout_sessions').insert({
    id: created.id,
    booking_id: contract.booking_id,
    obligation_id: input.obligationId,
    method,
    amount_cents: Number(obligation.amount_cents),
    fee_cents: feeCents,
    total_cents: totalCents,
    status: 'open',
    url: created.url,
  });
  if (error && error.code !== '23505') return { status: 500, body: { error: 'The payment page could not be opened.' } };
  return { status: 200, body: { url: created.url } };
}

async function createStripeCheckout(input: {
  secretKey: string;
  method: 'stripe_ach' | 'stripe_card';
  amountCents: number;
  feeCents: number;
  bookingCode: string;
  kind: 'retainer' | 'balance';
  obligationId: string;
  bookingId: string;
  successUrl: string;
  cancelUrl: string;
  idempotencyKey: string;
}): Promise<{ id: string; url: string } | { error: string }> {
  const fields = checkoutSessionFields(input);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) params.append(key, value);
  let response: Response;
  try {
    response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': input.idempotencyKey,
        'Stripe-Version': STRIPE_CHECKOUT_API_VERSION,
      },
      body: params.toString(),
    });
  } catch {
    return { error: 'network' };
  }
  const payload = (await response.json().catch(() => null)) as {
    id?: unknown;
    url?: unknown;
    payment_method_types?: unknown;
  } | null;
  const requestId = response.headers.get('request-id');
  if (!response.ok || typeof payload?.id !== 'string' || typeof payload.url !== 'string' || !payload.url.startsWith('https://')) {
    console.error('Stripe Checkout was not created', stripeCheckoutErrorDetails({ status: response.status, requestId, payload }));
    return { error: 'stripe' };
  }
  if (!checkoutSessionAcceptsMethod(payload.payment_method_types, input.method)) {
    console.error('Stripe Checkout omitted the requested payment method', {
      status: response.status,
      requestId: stripeCheckoutErrorDetails({ status: response.status, requestId, payload: null }).requestId,
      expected: checkoutPaymentMethod(input.method),
      offered: offeredPaymentMethodTypes(payload.payment_method_types),
    });
    return { error: 'stripe' };
  }
  return { id: payload.id, url: payload.url };
}

/** Webhook payloads use the endpoint's API version, not the Checkout create version. */
type StripeSessionObject = {
  id?: string;
  payment_status?: string;
  amount_total?: number;
  payment_intent?: string | { id?: string };
  metadata?: { obligation_id?: string; booking_id?: string };
};

type SessionRow = {
  id: string;
  booking_id: string;
  obligation_id: string;
  method: 'stripe_card' | 'stripe_ach';
  amount_cents: number;
  fee_cents: number;
  total_cents: number;
  status: CheckoutSessionStatus;
  notified_kind: string | null;
};

export async function ingestStripeWebhook(input: {
  rawBody: string;
  signature: string | null;
  request?: Request;
  nowSec?: number;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const verified = verifyStripeWebhook(input.rawBody, input.signature, process.env.STRIPE_WEBHOOK_SECRET, input.nowSec);
  if (!verified.ok) return { status: verified.status, body: { ok: false, error: verified.error } };

  let event: { id?: string; type?: string; data?: { object?: StripeSessionObject } };
  try {
    event = JSON.parse(input.rawBody) as typeof event;
  } catch {
    return { status: 400, body: { ok: false, error: 'The Stripe event could not be read.' } };
  }
  const eventId = typeof event.id === 'string' ? event.id : '';
  const type = typeof event.type === 'string' ? event.type : '';
  const sessionObject = event.data?.object;
  const sessionId = typeof sessionObject?.id === 'string' ? sessionObject.id : '';
  if (!eventId.startsWith('evt_') || !sessionId.startsWith('cs_')) {
    return { status: 200, body: { ok: true, ignored: true } };
  }

  const admin = adminOrNull();
  if (!admin) return { status: 500, body: { ok: false, error: 'Payments are not available.' } };

  const { data: seen } = await admin.from('stripe_events').select('event_id').eq('event_id', eventId).maybeSingle();
  const { data: sessionData } = await admin.from('stripe_checkout_sessions').select('*').eq('id', sessionId).maybeSingle();
  const session = sessionData as SessionRow | null;
  const sessionStatus: CheckoutSessionStatus = session?.status ?? 'missing';
  const plan = planStripeEvent({
    eventId,
    type,
    paymentStatus: sessionObject?.payment_status ?? null,
    seenEventIds: seen?.event_id ? [eventId] : [],
    sessionStatus,
  });
  if (plan.action === 'duplicate' || plan.action === 'ignore') {
    if (session && (session.status === 'paid' || plan.action === 'duplicate')) {
      const mailed = await ensurePaidNotice(admin, session, input.request);
      if (mailed === 'failed') return { status: 500, body: { ok: false, error: 'The payment email could not be sent.' } };
    }
    await rememberEvent(admin, eventId, type, sessionId);
    return { status: 200, body: { ok: true, duplicate: plan.action === 'duplicate' } };
  }
  if (!session) return { status: 500, body: { ok: false, error: 'The checkout session is not on file yet.' } };

  if (typeof sessionObject?.amount_total === 'number' && sessionObject.amount_total !== session.total_cents) {
    await rememberEvent(admin, eventId, type, sessionId);
    console.error('Stripe total did not match the checkout session');
    return { status: 200, body: { ok: true, ignored: true } };
  }

  const intent = sessionObject?.payment_intent;
  const intentId = typeof intent === 'string' ? intent : typeof intent?.id === 'string' ? intent.id : null;
  const paymentStatus = plan.action === 'paid' ? 'Completed' : plan.action === 'processing' ? 'Processing' : 'Failed';
  const recorded = await recordPayment(admin, {
    obligationId: session.obligation_id,
    amountCents: session.amount_cents,
    method: session.method,
    paymentStatus,
    stripeSessionId: session.id,
    stripePaymentIntentId: intentId,
    feeCents: session.fee_cents,
    paidAt: plan.action === 'paid' ? new Date().toISOString() : null,
  });
  if (!recorded.ok) return { status: 500, body: { ok: false, error: recorded.error } };
  if (recorded.row.result === 'not_open' || recorded.row.result === 'amount_mismatch') {
    const owner = contractOwnerEmail();
    if (owner) {
      await sendContractMail({
        to: owner,
        subject: 'Stripe payment did not match an open amount',
        html: `<p>A Stripe checkout session (${session.id}) completed for an amount that is no longer open. It was not applied to a booking. Check the payment in Stripe.</p>`,
      });
    }
    await rememberEvent(admin, eventId, type, sessionId);
    return { status: 200, body: { ok: true, outcome: 'not_open' } };
  }

  const nextStatus = plan.action === 'paid' ? 'paid' : plan.action === 'processing' ? 'processing' : 'failed';
  await admin
    .from('stripe_checkout_sessions')
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq('id', session.id);

  const kind = await kindFor(admin, session.obligation_id);
  const shouldMail =
    (plan.action === 'paid' && session.notified_kind !== 'confirmation' && session.notified_kind !== 'receipt') ||
    (plan.action === 'processing' && session.notified_kind == null) ||
    (plan.action === 'failed' && session.notified_kind !== 'failed');

  if (shouldMail && (recorded.row.result === 'created' || recorded.row.result === 'upgraded' || recorded.row.result === 'processing' || recorded.row.result === 'failed')) {
    const mailed =
      plan.action === 'paid'
        ? await sendCouplePaidMail({
            admin,
            bookingId: session.booking_id,
            bookingCode: '',
            kind,
            amountCents: session.amount_cents,
            request: input.request,
          })
        : await sendCoupleStatusMail({
            admin,
            bookingId: session.booking_id,
            bookingCode: '',
            kind,
            amountCents: session.amount_cents,
            which: plan.action === 'processing' ? 'processing' : 'failed',
            request: input.request,
          });
    const notifyKind = plan.action === 'paid' ? (kind === 'retainer' ? 'confirmation' : 'receipt') : plan.action === 'processing' ? 'processing' : 'failed';
    if (('sent' in mailed && mailed.sent) || mailed.skipped) {
      await admin.from('stripe_checkout_sessions').update({ notified_kind: notifyKind }).eq('id', session.id);
    } else {
      return { status: 500, body: { ok: false, error: 'The payment email could not be sent.' } };
    }
  }

  await notePayment(admin, {
    leadId: recorded.row.lead_id ?? null,
    bookingId: session.booking_id,
    title: plan.action === 'paid' ? 'Stripe payment recorded' : plan.action === 'processing' ? 'Bank payment processing' : 'Bank payment failed',
    body: session.id,
  });
  await rememberEvent(admin, eventId, type, sessionId);
  return { status: 200, body: { ok: true, outcome: plan.action } };
}

async function ensurePaidNotice(admin: Admin, session: SessionRow, request?: Request): Promise<'sent' | 'skipped' | 'failed' | 'none'> {
  if (session.status !== 'paid') return 'none';
  if (session.notified_kind === 'confirmation' || session.notified_kind === 'receipt') return 'none';
  const kind = await kindFor(admin, session.obligation_id);
  const mailed = await sendCouplePaidMail({
    admin,
    bookingId: session.booking_id,
    bookingCode: '',
    kind,
    amountCents: session.amount_cents,
    request,
  });
  if (!mailed.sent && !mailed.skipped) return 'failed';
  await admin
    .from('stripe_checkout_sessions')
    .update({ notified_kind: kind === 'retainer' ? 'confirmation' : 'receipt' })
    .eq('id', session.id);
  return mailed.sent ? 'sent' : 'skipped';
}

async function kindFor(admin: Admin, obligationId: string): Promise<'retainer' | 'balance'> {
  const { data } = await admin.from('payment_obligations').select('kind').eq('id', obligationId).maybeSingle();
  return data?.kind === 'balance' ? 'balance' : 'retainer';
}

async function rememberEvent(admin: Admin, eventId: string, type: string, sessionId: string): Promise<void> {
  await admin.from('stripe_events').insert({ event_id: eventId, event_type: type, checkout_session_id: sessionId });
}
