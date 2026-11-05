import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { checkoutSessionFields } from './stripe-session';
import {
  RESOURCE_TIP_PRODUCT_NAME,
  RESOURCE_TIP_PURPOSE,
  TIP_PROMPT_STORAGE_KEY,
  TIP_PROMPT_SUPPRESS_MS,
  beginResourceTip,
  dollarsToCents,
  isResourceTipMetadata,
  nextTipPromptUntil,
  readTipPromptSuppressed,
  resourceTipCheckoutFields,
  resourceTipsCheckoutEnabled,
  safeTuneReturnPath,
  tipReturnState,
  writeTipPromptSuppressed,
} from './resource-tip';

const tunePath = '/services/lessons/resources/cook-in-the-kitchen';

test('tips stay off unless the deployment is production', () => {
  assert.equal(resourceTipsCheckoutEnabled('production'), true);
  assert.equal(resourceTipsCheckoutEnabled('preview'), false);
  assert.equal(resourceTipsCheckoutEnabled('development'), false);
  assert.equal(resourceTipsCheckoutEnabled(''), false);
  assert.equal(resourceTipsCheckoutEnabled(undefined), false);
});

test('a preview tip never calls Stripe', async () => {
  let called = false;
  const result = await beginResourceTip({
    vercelEnv: 'preview',
    body: { amountCents: 500, returnPath: tunePath },
    origin: 'https://preview.example',
    createCheckout: async () => {
      called = true;
      return { url: 'https://checkout.stripe.com/c/pay/cs_test' };
    },
  });
  assert.equal(called, false);
  assert.equal(result.status, 200);
  assert.equal(result.body.testSite, true);
});

test('a production tip checkout is a one-time payment and not a booking', async () => {
  let fields: Record<string, string> | null = null;
  const result = await beginResourceTip({
    vercelEnv: 'production',
    body: { amountCents: 1000, returnPath: tunePath },
    origin: 'https://danielcimo.com',
    createCheckout: async (next) => {
      fields = next;
      return { url: 'https://checkout.stripe.com/c/pay/cs_live_tip' };
    },
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.url, 'https://checkout.stripe.com/c/pay/cs_live_tip');
  assert.ok(fields);
  const sent = fields as unknown as Record<string, string>;
  assert.equal(sent.mode, 'payment');
  assert.equal(sent['line_items[0][price_data][product_data][name]'], RESOURCE_TIP_PRODUCT_NAME);
  assert.equal(sent['line_items[0][price_data][unit_amount]'], '1000');
  assert.equal(sent['metadata[purpose]'], RESOURCE_TIP_PURPOSE);
  assert.equal(sent['metadata[tune_id]'], 'cook-in-the-kitchen');
  assert.equal(sent.success_url?.includes('tip=thanks'), true);
  assert.equal(sent.cancel_url?.includes('tip=canceled'), true);
  assert.equal(Object.keys(sent).some((key) => key.includes('booking') || key.includes('obligation')), false);

  const booking = checkoutSessionFields({
    method: 'stripe_card',
    amountCents: 10000,
    feeCents: 0,
    bookingCode: 'DC-4827',
    kind: 'retainer',
    obligationId: '11111111-1111-1111-1111-111111111111',
    bookingId: '22222222-2222-2222-2222-222222222222',
    successUrl: 'https://danielcimo.com/pay?return=paid',
    cancelUrl: 'https://danielcimo.com/pay?return=canceled',
  });
  assert.equal(booking['metadata[purpose]'], undefined);
  assert.equal(isResourceTipMetadata({ purpose: RESOURCE_TIP_PURPOSE, booking_id: 'nope' }), true);
  assert.equal(isResourceTipMetadata({ kind: 'retainer', booking_id: 'booking-1', obligation_id: 'ob-1' }), false);
});

test('tip amounts and return paths stay on the tune library', () => {
  assert.equal(dollarsToCents('3'), 300);
  assert.equal(dollarsToCents('5.50'), 550);
  assert.equal(dollarsToCents('0.50'), null);
  assert.equal(dollarsToCents('201'), null);
  assert.equal(dollarsToCents('15.999'), null);
  assert.equal(safeTuneReturnPath(tunePath), tunePath);
  assert.equal(safeTuneReturnPath('/services/lessons/resources'), '/services/lessons/resources');
  assert.equal(safeTuneReturnPath('https://evil.example/services/lessons/resources'), null);
  assert.equal(safeTuneReturnPath('//evil.example'), null);
  assert.equal(safeTuneReturnPath('/services/lessons/resources/../admin'), null);
  assert.equal(tipReturnState('thanks'), 'thanks');
  assert.equal(tipReturnState(['canceled']), 'canceled');
  assert.equal(tipReturnState('paid'), null);
});

test('dismissing a tip hides the download prompt for seven days', () => {
  const memory = new Map<string, string>();
  const storage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value);
    },
  };
  const now = Date.parse('2026-11-05T00:00:00Z');
  assert.equal(readTipPromptSuppressed(storage, now), false);
  writeTipPromptSuppressed(storage, now);
  assert.equal(memory.get(TIP_PROMPT_STORAGE_KEY), String(nextTipPromptUntil(now)));
  assert.equal(readTipPromptSuppressed(storage, now + TIP_PROMPT_SUPPRESS_MS - 1), true);
  assert.equal(readTipPromptSuppressed(storage, now + TIP_PROMPT_SUPPRESS_MS), false);
});

test('the booking webhook ignores a tip before it can touch a payment record', () => {
  const source = fs.readFileSync(new URL('./stripe-checkout.ts', import.meta.url), 'utf8');
  const ingest = source.slice(source.indexOf('export async function ingestStripeWebhook'));
  const tip = ingest.indexOf('isResourceTipMetadata(');
  const admin = ingest.indexOf('adminOrNull()');
  const sessions = ingest.indexOf("from('stripe_checkout_sessions')");
  const mail = ingest.indexOf('sendContractMail');
  assert.ok(tip > 0);
  assert.ok(tip < admin);
  assert.ok(tip < sessions);
  assert.ok(mail === -1 || tip < mail);
});
