import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { processingFeeCents, readFeeSettings, stripeFeeOnTotal } from './fees';
import { verifyZelleRequest, zelleSignatureHex } from './hmac';
import { extractBookingCodes, ingestZelleOnce, planZelleIngest, selectObligation, type ObligationRef } from './match';
import { confirmationEmail, THANK_YOU_EMAIL_TODO } from './messages';
import { planStripeEvent, verifyStripeSignatureHeader } from './stripe-event';
import { buildPaymentView } from './view';
import { resolveZelleQr, zelleInstructionLine, zelleRecipientContact, zelleRecipientName } from './zelle-config';

const require = createRequire(import.meta.url);
const { parseZelleAlert } = require('../../../scripts/gmail-zelle-forwarder/parse-zelle.js') as {
  parseZelleAlert: (input: { plain?: string; html?: string; text?: string }) => {
    ok: boolean;
    senderName?: string;
    amountCents?: number;
    sentOn?: string;
    transactionNumber?: string;
    memo?: string;
  };
};

const SAMPLE = `CHASE
[badge] Zelle® payment
DOUGLAS SLOCUM sent you money
Here are the details:
Amount: $80.00
Sent on: Oct 21, 2026
Transaction number: 31308170088
Memo: Kai violin lesson - October 21
DOUGLAS SLOCUM is registered with a Zelle® member bank that supports payments in real time.
`;

const retainer = (amount: number, code = 'DC-4827', id = 'ret'): ObligationRef => ({
  id,
  bookingId: 'booking-1',
  bookingCode: code,
  kind: 'retainer',
  amountCents: amount,
  status: 'open',
  dueOn: '2026-05-16',
});

const balance = (amount: number, code = 'DC-4827', id = 'bal'): ObligationRef => ({
  id,
  bookingId: 'booking-1',
  bookingCode: code,
  kind: 'balance',
  amountCents: amount,
  status: 'open',
  dueOn: '2026-05-16',
});

test('Chase alert parser reads the sample, including an HTML fallback', () => {
  const parsed = parseZelleAlert({ plain: SAMPLE });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.senderName, 'DOUGLAS SLOCUM');
  assert.equal(parsed.amountCents, 8000);
  assert.equal(parsed.sentOn, '2026-10-21');
  assert.equal(parsed.transactionNumber, '31308170088');
  assert.equal(parsed.memo, 'Kai violin lesson - October 21');

  const html = `<html><body><p>DOUGLAS SLOCUM sent you money</p>
    <table><tr><td>Amount:</td><td>$1,500.00</td></tr>
    <tr><td>Sent on:</td><td>October 21, 2026</td></tr>
    <tr><td>Transaction number:</td><td>31308170088</td></tr>
    <tr><td>Memo:</td><td>retainer DC-4827</td></tr></table></body></html>`;
  const fromHtml = parseZelleAlert({ plain: 'not an alert', html });
  assert.equal(fromHtml.ok, true);
  assert.equal(fromHtml.amountCents, 150000);
  assert.equal(fromHtml.memo, 'retainer DC-4827');
  assert.equal(fromHtml.sentOn, '2026-10-21');

  const gas = fs.readFileSync(new URL('../../../scripts/gmail-zelle-forwarder/Code.gs', import.meta.url), 'utf8');
  const parser = fs.readFileSync(new URL('../../../scripts/gmail-zelle-forwarder/parse-zelle.js', import.meta.url), 'utf8');
  assert.ok(gas.includes(parser.trim()));
  const sandbox: { parseZelleAlert?: typeof parseZelleAlert } = {};
  vm.createContext(sandbox);
  vm.runInContext(gas, sandbox);
  assert.equal(sandbox.parseZelleAlert?.({ plain: SAMPLE }).senderName, 'DOUGLAS SLOCUM');
});

test('booking codes tolerate case, spacing, and a missing dash', () => {
  assert.deepEqual(extractBookingCodes('DC-4827'), ['DC-4827']);
  assert.deepEqual(extractBookingCodes('please pay dc4827 thanks'), ['DC-4827']);
  assert.deepEqual(extractBookingCodes('DC 4827'), ['DC-4827']);
  assert.deepEqual(extractBookingCodes('dc - 4827'), ['DC-4827']);
  assert.deepEqual(extractBookingCodes('DC-48271'), []);
  assert.deepEqual(extractBookingCodes('ADC-4827'), []);
  assert.deepEqual(extractBookingCodes('DC-4827 and DC-1111'), ['DC-4827', 'DC-1111']);
});

test('an open obligation matches the code and the exact amount, and the retainer wins a tie', () => {
  const rows = [balance(150000), retainer(150000)];
  assert.equal(selectObligation(rows, 'dc-4827', 150000).outcome, 'match');
  const tied = selectObligation(rows, 'DC-4827', 150000);
  assert.equal(tied.outcome, 'match');
  if (tied.outcome === 'match') assert.equal(tied.obligation.kind, 'retainer');
  assert.equal(selectObligation(rows, 'DC-4827', 8000).outcome, 'none');

  const memo = 'Balance dc - 4827';
  assert.equal(planZelleIngest(memo, 150000, rows).outcome, 'matched');
  assert.equal(planZelleIngest('lesson for Kai', 8000, rows).outcome, 'ignored');
  assert.equal(planZelleIngest('DC-4827', 8000, rows).outcome, 'unmatched');
  assert.equal(planZelleIngest('DC-4827 DC-1111', 150000, rows).outcome, 'unmatched');

  const other = retainer(150000, 'DC-4827', 'other');
  other.bookingId = 'booking-2';
  assert.equal(selectObligation([retainer(150000), other], 'DC-4827', 150000).outcome, 'ambiguous');
});

test('the same Chase transaction number is stored once', () => {
  const store = new Map();
  const first = ingestZelleOnce(store, {
    transactionNumber: '31308170088',
    memo: 'DC-4827',
    amountCents: 150000,
    obligations: [retainer(150000), balance(150000)],
  });
  assert.equal(first.duplicate, false);
  assert.equal(first.outcome, 'matched');
  const second = ingestZelleOnce(store, {
    transactionNumber: '31308170088',
    memo: 'DC-9999',
    amountCents: 1,
    obligations: [],
  });
  assert.equal(second.duplicate, true);
  assert.equal(second.outcome, 'matched');
  assert.equal(second.plan, null);
  assert.equal(store.size, 1);
});

test('Zelle signatures cover the raw body and reject a stale timestamp', () => {
  const secret = 'test-secret';
  const timestamp = '1700000000000';
  const rawBody = '{"transactionNumber":"31308170088"}';
  const signature = zelleSignatureHex(secret, timestamp, rawBody);
  assert.equal(signature, '2adbf8a91f0638073eb41b2c0299fd74d8032c4f2d3859bf4ad0b6aa4db2dcda');
  assert.equal(
    verifyZelleRequest({ secret, timestamp, signature, rawBody, nowMs: 1700000000000 }).ok,
    true,
  );
  assert.equal(
    verifyZelleRequest({ secret, timestamp, signature: `${signature.slice(0, -1)}0`, rawBody, nowMs: 1700000000000 }).ok,
    false,
  );
  const stale = verifyZelleRequest({
    secret,
    timestamp,
    signature,
    rawBody,
    nowMs: 1700000000000 + 6 * 60 * 1000,
  });
  assert.equal(stale.ok, false);
  assert.equal(verifyZelleRequest({ secret: '', timestamp, signature, rawBody, nowMs: 1700000000000 }).ok, false);
});

test('Stripe webhook events are idempotent, and ACH waits for success', () => {
  const seen: string[] = [];
  const first = planStripeEvent({
    eventId: 'evt_1',
    type: 'checkout.session.completed',
    paymentStatus: 'paid',
    seenEventIds: seen,
    sessionStatus: 'open',
  });
  assert.equal(first.action, 'paid');
  seen.push('evt_1');
  assert.equal(
    planStripeEvent({
      eventId: 'evt_1',
      type: 'checkout.session.completed',
      paymentStatus: 'paid',
      seenEventIds: seen,
      sessionStatus: 'paid',
    }).action,
    'duplicate',
  );
  assert.equal(
    planStripeEvent({
      eventId: 'evt_2',
      type: 'checkout.session.async_payment_succeeded',
      paymentStatus: 'paid',
      seenEventIds: seen,
      sessionStatus: 'paid',
    }).action,
    'ignore',
  );
  assert.equal(
    planStripeEvent({
      eventId: 'evt_3',
      type: 'checkout.session.completed',
      paymentStatus: 'unpaid',
      seenEventIds: [],
      sessionStatus: 'open',
    }).action,
    'processing',
  );
  assert.equal(
    planStripeEvent({
      eventId: 'evt_4',
      type: 'checkout.session.async_payment_succeeded',
      paymentStatus: 'paid',
      seenEventIds: [],
      sessionStatus: 'processing',
    }).action,
    'paid',
  );
  assert.equal(
    planStripeEvent({
      eventId: 'evt_5',
      type: 'checkout.session.async_payment_failed',
      paymentStatus: 'unpaid',
      seenEventIds: [],
      sessionStatus: 'processing',
    }).action,
    'failed',
  );
  assert.equal(
    planStripeEvent({
      eventId: 'evt_6',
      type: 'checkout.session.async_payment_failed',
      paymentStatus: 'unpaid',
      seenEventIds: [],
      sessionStatus: 'paid',
    }).action,
    'ignore',
  );

  const secret = 'whsec_test';
  const raw = '{"id":"evt_1"}';
  const timestamp = '1700000000';
  let signed = '';
  const ok = verifyStripeSignatureHeader({
    rawBody: raw,
    header: '',
    secret,
    nowSec: 1700000000,
    digestHex: (value) => {
      signed = value;
      return 'abc';
    },
    equalHex: (left, right) => left === right,
  });
  assert.equal(ok.ok, false);
  const good = verifyStripeSignatureHeader({
    rawBody: raw,
    header: `t=${timestamp},v1=abc`,
    secret,
    nowSec: 1700000000,
    digestHex: () => 'abc',
    equalHex: (left, right) => left === right,
  });
  assert.equal(good.ok, true);
  assert.equal(signed, '');
  const stale = verifyStripeSignatureHeader({
    rawBody: raw,
    header: `t=${timestamp},v1=abc`,
    secret,
    nowSec: 1700000000 + 1000,
    digestHex: () => 'abc',
    equalHex: () => true,
  });
  assert.equal(stale.ok, false);
});

test('card and ACH fees use the published defaults and can be turned on or off', () => {
  const defaults = readFeeSettings({});
  assert.ok(!('error' in defaults));
  if ('error' in defaults) return;
  assert.equal(defaults.card.bps, 290);
  assert.equal(defaults.card.flatCents, 30);
  assert.equal(defaults.card.passThrough, true);
  assert.equal(defaults.ach.passThrough, false);
  assert.equal(defaults.ach.capCents, 500);

  assert.equal(processingFeeCents(10000, defaults.card), 330);
  assert.equal(processingFeeCents(8000, defaults.card), 270);
  assert.equal(processingFeeCents(150000, defaults.ach), 0);

  const achOn = { ...defaults.ach, passThrough: true };
  assert.equal(processingFeeCents(10000, achOn), 81);
  assert.equal(processingFeeCents(150000, achOn), 500);

  for (const amount of [5000, 8000, 25750, 150000, 300000]) {
    const fee = processingFeeCents(amount, defaults.card);
    const stripe = stripeFeeOnTotal(amount + fee, defaults.card);
    assert.ok(fee >= stripe, `${amount} fee ${fee} covers stripe ${stripe}`);
    assert.ok(amount + fee - stripe >= amount);
  }

  const custom = readFeeSettings({ STRIPE_PASS_CARD_FEE: 'false', STRIPE_PASS_ACH_FEE: 'true', STRIPE_ACH_FEE_CAP_CENTS: '' });
  assert.ok(!('error' in custom));
  if ('error' in custom) return;
  assert.equal(processingFeeCents(10000, custom.card), 0);
  assert.equal(custom.ach.capCents, null);
  assert.ok(processingFeeCents(150000, custom.ach) > 500);
});

test('the couple is told the Zelle name, phone, amount, and booking code', () => {
  assert.equal(zelleRecipientName({}), 'Daniel Cimo');
  assert.equal(zelleRecipientContact({}), '(224) 678-2799');
  assert.equal(zelleRecipientContact({ ZELLE_RECIPIENT_CONTACT: '' }), '');
  const line = zelleInstructionLine({
    recipientName: zelleRecipientName({}),
    recipientContact: zelleRecipientContact({}),
    amountLabel: '$1,500.00',
    bookingCode: 'DC-4827',
  });
  assert.equal(line, 'Send via Zelle to Daniel Cimo at (224) 678-2799 — amount $1,500.00 — put DC-4827 in the memo.');
  assert.deepEqual(resolveZelleQr({ fileExists: true }), {
    pageUrl: '/images/zelle-qr.png',
    emailUrl: 'https://danielcimo.com/images/zelle-qr.png',
  });
  assert.deepEqual(resolveZelleQr({ fileExists: false }), { pageUrl: null, emailUrl: null });
  assert.equal(resolveZelleQr({ fileExists: false, qrUrl: 'https://cdn.example/qr.png' }).emailUrl, 'https://cdn.example/qr.png');

  const view = buildPaymentView({
    bookingCode: 'DC-4827',
    obligations: [retainer(150000), balance(150000)],
    recipientName: 'Daniel Cimo',
    recipientContact: '(224) 678-2799',
    qrUrl: '/images/zelle-qr.png',
    stripeReady: true,
    fees: readFeeSettings({}) as Exclude<ReturnType<typeof readFeeSettings>, { error: string }>,
  });
  assert.equal(view.due?.kind, 'retainer');
  assert.match(view.instruction, /Daniel Cimo at \(224\) 678-2799/);
  assert.match(view.instruction, /DC-4827/);
  assert.equal(view.qrAlt, 'Zelle QR code for Daniel Cimo');
  assert.ok(view.cardFeeLabel);

  const mail = confirmationEmail({
    name: 'Alex',
    bookingCode: 'DC-4827',
    amountPaidCents: 150000,
    balanceCents: 150000,
    balanceDueOn: '2026-05-16',
    bookingConfirmed: true,
    recipientName: 'Daniel Cimo',
    recipientContact: '(224) 678-2799',
    payUrl: 'https://danielcimo.com/pay?t=abc',
    qrEmailUrl: 'https://danielcimo.com/images/zelle-qr.png',
  });
  assert.match(mail.html, /\$1,500\.00/);
  assert.match(mail.html, /May 16, 2026/);
  assert.match(mail.html, /Daniel Cimo at \(224\) 678-2799/);
  assert.match(mail.html, /https:\/\/danielcimo.com\/images\/zelle-qr.png/);
  assert.match(mail.html, /Zelle QR code for Daniel Cimo/);
  assert.match(mail.subject, /retainer is paid/);
  assert.match(THANK_YOU_EMAIL_TODO, /no new cron/i);

  const sql = fs.readFileSync(new URL('../../../supabase/migrations/008_payments.sql', import.meta.url), 'utf8');
  assert.match(sql, /payments_chase_transaction_number_key/);
  assert.match(sql, /zelle_receipts_transaction_key/);
  assert.match(sql, /stripe_events/);
});
