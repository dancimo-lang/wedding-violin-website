import 'server-only';
import { contractOwnerEmail } from '@/lib/contracts/mail';
import { sendContractMail } from '@/lib/contracts/delivery';
import { verifyZelleRequest } from './hmac';
import { planZelleIngest, type ObligationRef, type ZellePlan } from './match';
import { ownerUnmatchedEmail } from './messages';
import {
  adminOrNull,
  isUuid,
  mailReady,
  notePayment,
  recordPayment,
  sendCouplePaidMail,
  type Admin,
} from './shared';

type ZellePayload = {
  senderName: string;
  amountCents: number;
  sentOn: string | null;
  transactionNumber: string;
  memo: string;
};

type ReceiptRow = {
  id: string;
  outcome: 'matched' | 'unmatched' | 'ignored';
  payment_id: string | null;
  obligation_id: string | null;
  booking_id: string | null;
  extracted_code: string | null;
  amount_cents: number;
  sender_name: string | null;
  memo: string | null;
  sent_on: string | null;
  chase_transaction_number: string;
  couple_notified_at: string | null;
  owner_notified_at: string | null;
};

export type ZelleHttp = { status: number; body: Record<string, unknown> };

function readPayload(rawBody: string): ZellePayload | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const body = parsed as Record<string, unknown>;
  const senderName = typeof body.senderName === 'string' ? body.senderName.trim().slice(0, 200) : '';
  const memo = typeof body.memo === 'string' ? body.memo.trim().slice(0, 500) : '';
  const transactionNumber = typeof body.transactionNumber === 'string' ? body.transactionNumber.trim() : '';
  const sentOn = typeof body.sentOn === 'string' ? body.sentOn.trim() : '';
  const amountCents = body.amountCents;
  if (!/^[0-9]{6,22}$/.test(transactionNumber)) return null;
  if (!Number.isInteger(amountCents) || (amountCents as number) < 0 || (amountCents as number) > 10_000_000) return null;
  if (sentOn && !/^\d{4}-\d{2}-\d{2}$/.test(sentOn)) return null;
  if (!senderName) return null;
  return {
    senderName,
    amountCents: amountCents as number,
    sentOn: sentOn || null,
    transactionNumber,
    memo,
  };
}

async function openObligations(admin: Admin): Promise<ObligationRef[]> {
  const { data, error } = await admin
    .from('payment_obligations')
    .select('id, booking_id, booking_code, kind, amount_cents, status, due_on')
    .eq('status', 'open');
  if (error || !data) return [];
  return data
    .filter((row) => row.kind === 'retainer' || row.kind === 'balance')
    .map((row) => ({
      id: String(row.id),
      bookingId: String(row.booking_id),
      bookingCode: String(row.booking_code),
      kind: row.kind as 'retainer' | 'balance',
      amountCents: Number(row.amount_cents),
      status: 'open' as const,
      dueOn: typeof row.due_on === 'string' ? row.due_on : null,
    }));
}

async function receiptByTransaction(admin: Admin, transactionNumber: string): Promise<ReceiptRow | null> {
  const { data } = await admin
    .from('zelle_receipts')
    .select(
      'id, outcome, payment_id, obligation_id, booking_id, extracted_code, amount_cents, sender_name, memo, sent_on, chase_transaction_number, couple_notified_at, owner_notified_at',
    )
    .eq('chase_transaction_number', transactionNumber)
    .maybeSingle();
  return (data as ReceiptRow | null) ?? null;
}

async function notifyOwner(admin: Admin, row: ReceiptRow, reason: string): Promise<boolean> {
  if (!mailReady()) return false;
  const owner = contractOwnerEmail();
  if (!owner) return false;
  const mail = ownerUnmatchedEmail({
    senderName: row.sender_name || '',
    amountCents: row.amount_cents,
    sentOn: row.sent_on,
    memo: row.memo || '',
    code: row.extracted_code,
    transactionNumber: row.chase_transaction_number,
    reason,
  });
  return sendContractMail({ to: owner, subject: mail.subject, html: mail.html });
}

function reasonText(plan: ZellePlan): string {
  if (plan.outcome !== 'unmatched') return '';
  if (plan.reason === 'multiple_codes') return 'The memo has more than one booking code.';
  if (plan.reason === 'ambiguous') return 'More than one open payment matches this code and amount.';
  return 'No open retainer or balance matches this code and amount.';
}

async function finishMatched(admin: Admin, row: ReceiptRow, request?: Request): Promise<ZelleHttp> {
  if (!row.obligation_id || !row.booking_id) {
    return { status: 500, body: { ok: false, error: 'The payment could not be recorded.' } };
  }
  if (!row.payment_id) {
    const recorded = await recordPayment(admin, {
      obligationId: row.obligation_id,
      amountCents: row.amount_cents,
      method: 'zelle',
      paymentStatus: 'Completed',
      chaseTransactionNumber: row.chase_transaction_number,
      payerName: row.sender_name,
      memo: row.memo,
      externalPaidOn: row.sent_on,
      paidAt: new Date().toISOString(),
    });
    if (!recorded.ok) return { status: 500, body: { ok: false, error: recorded.error } };
    if (recorded.row.result === 'not_open' || recorded.row.result === 'amount_mismatch') {
      await admin
        .from('zelle_receipts')
        .update({ outcome: 'unmatched', updated_at: new Date().toISOString() })
        .eq('id', row.id);
      const unmatched = { ...row, outcome: 'unmatched' as const };
      const sent = await notifyOwner(admin, unmatched, 'The matching amount was no longer open.');
      if (sent) {
        await admin.from('zelle_receipts').update({ owner_notified_at: new Date().toISOString() }).eq('id', row.id);
      } else if (mailReady()) {
        return { status: 500, body: { ok: false, error: 'The owner notice could not be sent.' } };
      }
      return { status: 200, body: { ok: true, outcome: 'unmatched', reason: 'not_open' } };
    }
    const paymentId = recorded.row.payment_id;
    if (paymentId && isUuid(paymentId)) {
      await admin.from('zelle_receipts').update({ payment_id: paymentId, updated_at: new Date().toISOString() }).eq('id', row.id);
    }
    await notePayment(admin, {
      leadId: recorded.row.lead_id ?? null,
      bookingId: row.booking_id,
      title: 'Zelle payment recorded',
      body: `${row.chase_transaction_number} matched ${row.extracted_code || 'the booking'}.`,
    });
  }

  if (!row.couple_notified_at) {
    const kind = await obligationKind(admin, row.obligation_id);
    const mailed = await sendCouplePaidMail({
      admin,
      bookingId: row.booking_id,
      bookingCode: row.extracted_code || '',
      kind,
      amountCents: row.amount_cents,
      request,
    });
    if (mailed.sent || mailed.skipped) {
      await admin.from('zelle_receipts').update({ couple_notified_at: new Date().toISOString() }).eq('id', row.id);
    } else if (mailReady()) {
      return { status: 500, body: { ok: false, error: 'The receipt email could not be sent.' } };
    }
  }
  return { status: 200, body: { ok: true, outcome: 'matched', bookingCode: row.extracted_code } };
}

async function obligationKind(admin: Admin, obligationId: string): Promise<'retainer' | 'balance'> {
  const { data } = await admin.from('payment_obligations').select('kind').eq('id', obligationId).maybeSingle();
  return data?.kind === 'balance' ? 'balance' : 'retainer';
}

async function finishUnmatched(admin: Admin, row: ReceiptRow, reason: string): Promise<ZelleHttp> {
  if (!row.owner_notified_at) {
    const sent = await notifyOwner(admin, row, reason);
    if (sent) {
      await admin.from('zelle_receipts').update({ owner_notified_at: new Date().toISOString() }).eq('id', row.id);
    } else if (mailReady()) {
      return { status: 500, body: { ok: false, error: 'The owner notice could not be sent.' } };
    }
  }
  return { status: 200, body: { ok: true, outcome: 'unmatched' } };
}

export async function ingestZelle(input: {
  rawBody: string;
  timestamp: string | null;
  signature: string | null;
  request?: Request;
  nowMs?: number;
}): Promise<ZelleHttp> {
  const auth = verifyZelleRequest({
    secret: process.env.ZELLE_INGEST_SECRET,
    timestamp: input.timestamp,
    signature: input.signature,
    rawBody: input.rawBody,
    nowMs: input.nowMs ?? Date.now(),
  });
  if (!auth.ok) return { status: auth.status, body: { ok: false, error: auth.error } };

  const payload = readPayload(input.rawBody);
  if (!payload) return { status: 400, body: { ok: false, error: 'The Zelle alert could not be read.' } };

  const admin = adminOrNull();
  if (!admin) return { status: 500, body: { ok: false, error: 'Payments are not available.' } };

  const existing = await receiptByTransaction(admin, payload.transactionNumber);
  if (existing) {
    if (existing.outcome === 'ignored') return { status: 200, body: { ok: true, outcome: 'ignored', duplicate: true } };
    if (existing.outcome === 'unmatched') return finishUnmatched(admin, existing, 'Still unmatched.');
    return finishMatched(admin, existing, input.request);
  }

  const plan = planZelleIngest(payload.memo, payload.amountCents, await openObligations(admin));
  const outcome = plan.outcome === 'matched' ? 'matched' : plan.outcome;
  const inserted = await admin
    .from('zelle_receipts')
    .insert({
      chase_transaction_number: payload.transactionNumber,
      sender_name: payload.senderName,
      amount_cents: payload.amountCents,
      sent_on: payload.sentOn,
      memo: payload.memo,
      extracted_code: plan.outcome === 'ignored' ? null : plan.code,
      outcome,
      obligation_id: plan.outcome === 'matched' ? plan.obligation.id : null,
      booking_id: plan.outcome === 'matched' ? plan.obligation.bookingId : null,
    })
    .select(
      'id, outcome, payment_id, obligation_id, booking_id, extracted_code, amount_cents, sender_name, memo, sent_on, chase_transaction_number, couple_notified_at, owner_notified_at',
    )
    .maybeSingle();

  if (inserted.error) {
    if (inserted.error.code === '23505') {
      const raced = await receiptByTransaction(admin, payload.transactionNumber);
      if (!raced) return { status: 500, body: { ok: false, error: 'The payment could not be recorded.' } };
      if (raced.outcome === 'ignored') return { status: 200, body: { ok: true, outcome: 'ignored', duplicate: true } };
      if (raced.outcome === 'unmatched') return finishUnmatched(admin, raced, 'Still unmatched.');
      return finishMatched(admin, raced, input.request);
    }
    console.error('Zelle receipt was not saved');
    return { status: 500, body: { ok: false, error: 'The payment could not be recorded.' } };
  }

  const row = inserted.data as ReceiptRow | null;
  if (!row) return { status: 500, body: { ok: false, error: 'The payment could not be recorded.' } };
  if (plan.outcome === 'ignored') return { status: 200, body: { ok: true, outcome: 'ignored' } };
  if (plan.outcome === 'unmatched') return finishUnmatched(admin, row, reasonText(plan));
  return finishMatched(admin, row, input.request);
}
