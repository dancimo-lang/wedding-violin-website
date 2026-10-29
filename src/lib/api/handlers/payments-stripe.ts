import { NextResponse } from 'next/server';
import { ingestStripeWebhook, paymentView, startCheckout } from '@/lib/payments/stripe-checkout';

function noStore(body: unknown, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function postStripeWebhook(request: Request, rawBody: string) {
  const result = await ingestStripeWebhook({
    rawBody,
    signature: request.headers.get('stripe-signature'),
    request,
  });
  return NextResponse.json(result.body, { status: result.status });
}

export async function getPaymentView(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('t')?.trim() ?? '';
  const hint = url.searchParams.get('return');
  const result = await paymentView(token, {
    sessionId: url.searchParams.get('session_id'),
    returnHint: hint === 'paid' || hint === 'canceled' ? hint : null,
  });
  return noStore(result.body, result.status);
}

export async function postCheckout(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return noStore({ error: 'Could not read that request.' }, 400);
  }
  const result = await startCheckout({
    token: typeof body.token === 'string' ? body.token.trim() : '',
    obligationId: typeof body.obligationId === 'string' ? body.obligationId : '',
    method: typeof body.method === 'string' ? body.method : '',
    request,
  });
  return noStore(result.body, result.status);
}
