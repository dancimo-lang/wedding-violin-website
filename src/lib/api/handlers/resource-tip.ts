import { NextResponse } from 'next/server';
import { beginResourceTip, resourceTipsCheckoutEnabled } from '@/lib/payments/resource-tip';
import { isStripeSecretKey } from '@/lib/payments/stripe-key';
import { STRIPE_CHECKOUT_API_VERSION, stripeCheckoutErrorDetails } from '@/lib/payments/stripe-session';
import { siteOrigin } from '@/lib/payments/urls';

function noStore(body: unknown, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

async function createResourceTipCheckout(
  fields: Record<string, string>,
  idempotencyKey: string,
): Promise<{ url: string } | { error: string }> {
  // Second gate: preview deploys share the production secret and must not call Stripe.
  if (!resourceTipsCheckoutEnabled(process.env.VERCEL_ENV)) return { error: 'disabled' };
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim() ?? '';
  if (!isStripeSecretKey(secretKey)) return { error: 'stripe' };
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) params.append(key, value);
  let response: Response;
  try {
    response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': idempotencyKey,
        'Stripe-Version': STRIPE_CHECKOUT_API_VERSION,
      },
      body: params.toString(),
    });
  } catch {
    return { error: 'network' };
  }
  const payload = (await response.json().catch(() => null)) as { url?: unknown } | null;
  if (!response.ok || typeof payload?.url !== 'string' || !payload.url.startsWith('https://')) {
    console.error(
      'Resource tip checkout was not created',
      stripeCheckoutErrorDetails({
        status: response.status,
        requestId: response.headers.get('request-id'),
        payload,
      }),
    );
    return { error: 'stripe' };
  }
  return { url: payload.url };
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return noStore({ error: 'Could not read that request.' }, 400);
  }
  const result = await beginResourceTip({
    vercelEnv: process.env.VERCEL_ENV,
    body,
    origin: siteOrigin(request),
    createCheckout: createResourceTipCheckout,
  });
  return noStore(result.body, result.status);
}
