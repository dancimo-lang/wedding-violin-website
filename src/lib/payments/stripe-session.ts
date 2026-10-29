/**
 * Checkout creates are pinned to the account's 2026-09-30.endive API.
 * That version rejects `payment_method_types` on Checkout Session create.
 * `allowed_payment_method_types` is the supported per-session allow list:
 * only methods that are both in this list and turned on in the Dashboard
 * are offered. Webhook deliveries stay on the endpoint's own API version.
 * The handler reads checkout.session id, payment_status, amount_total,
 * payment_intent, and metadata, which this version still returns.
 */
export const STRIPE_CHECKOUT_API_VERSION = '2026-09-30.endive';

export type CheckoutMethod = 'stripe_ach' | 'stripe_card';

const KEY_PATTERN = /\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]+\b/g;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const QUERY_SECRET_PATTERN = /([?&](?:t|token|email)=)[^&\s]+/gi;

export function checkoutIdempotencyKey(input: {
  obligationId: string;
  method: CheckoutMethod;
  feeCents: number;
  day: string;
}): string {
  return `ob_${input.obligationId}_${input.method}_${input.feeCents}_${input.day}_e`;
}

export function checkoutPaymentMethod(method: CheckoutMethod): 'us_bank_account' | 'card' {
  return method === 'stripe_ach' ? 'us_bank_account' : 'card';
}

export function checkoutSessionFields(input: {
  method: CheckoutMethod;
  amountCents: number;
  feeCents: number;
  bookingCode: string;
  kind: 'retainer' | 'balance';
  obligationId: string;
  bookingId: string;
  successUrl: string;
  cancelUrl: string;
}): Record<string, string> {
  const which = input.kind === 'retainer' ? 'retainer' : 'balance';
  const fields: Record<string, string> = {
    mode: 'payment',
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    client_reference_id: input.obligationId,
    'metadata[obligation_id]': input.obligationId,
    'metadata[booking_id]': input.bookingId,
    'metadata[booking_code]': input.bookingCode,
    'metadata[kind]': input.kind,
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': String(input.amountCents),
    'line_items[0][price_data][product_data][name]': `Wedding music ${which} (${input.bookingCode})`,
    'allowed_payment_method_types[0]': checkoutPaymentMethod(input.method),
    'wallet_options[link][display]': 'never',
  };
  if (input.method === 'stripe_ach') {
    fields['payment_method_options[us_bank_account][financial_connections][permissions][0]'] = 'payment_method';
    fields['payment_method_options[us_bank_account][verification_method]'] = 'automatic';
  }
  if (input.feeCents > 0) {
    const feeName = input.method === 'stripe_card' ? 'Card processing fee' : 'Bank payment processing fee';
    fields['line_items[1][quantity]'] = '1';
    fields['line_items[1][price_data][currency]'] = 'usd';
    fields['line_items[1][price_data][unit_amount]'] = String(input.feeCents);
    fields['line_items[1][price_data][product_data][name]'] = feeName;
  }
  return fields;
}

export function offeredPaymentMethodTypes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && /^[a-z0-9_]{1,64}$/.test(item));
}

/** True when Checkout offered exactly the method this button is allowed to charge. */
export function checkoutSessionAcceptsMethod(paymentMethodTypes: unknown, method: CheckoutMethod): boolean {
  const offered = offeredPaymentMethodTypes(paymentMethodTypes);
  return offered.length === 1 && offered[0] === checkoutPaymentMethod(method);
}

export type StripeCheckoutErrorDetails = {
  status: number;
  type: string | null;
  code: string | null;
  param: string | null;
  message: string | null;
  requestId: string | null;
};

function stripeText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 500) return null;
  return trimmed.replace(KEY_PATTERN, '[redacted]').replace(EMAIL_PATTERN, '[redacted]').replace(QUERY_SECRET_PATTERN, '$1[redacted]');
}

/**
 * Fields safe to print from a Stripe error. The API key and any email in the
 * message are removed. The raw response body is not included.
 */
export function stripeCheckoutErrorDetails(input: {
  status: number;
  requestId: string | null;
  payload: unknown;
}): StripeCheckoutErrorDetails {
  const error =
    input.payload && typeof input.payload === 'object' && 'error' in input.payload
      ? (input.payload as { error?: unknown }).error
      : null;
  const record = error && typeof error === 'object' ? (error as Record<string, unknown>) : {};
  return {
    status: input.status,
    type: stripeText(record.type),
    code: stripeText(record.code),
    param: stripeText(record.param),
    message: stripeText(record.message),
    requestId: stripeText(input.requestId),
  };
}
