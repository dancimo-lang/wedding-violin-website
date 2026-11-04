import { NextResponse } from 'next/server';
import { isUuid } from '@/lib/payments/shared';
import { siteOrigin } from '@/lib/payments/urls';
import {
  ensureExistingPaymentLink,
  existingPaymentView,
  replaceExistingPayment,
} from '@/lib/bookings/existing-payment-record';
import { requireAdminApi } from '@/lib/require-admin-api';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Reads or corrects the outside-payment record on an existing booking.
 * Sends no email.
 */
export async function existingBookingPayment(request: Request) {
  const auth = await requireAdminApi();
  if (auth.response || !auth.session) return auth.response;
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'Payments are not available.' }, { status: 500 });
  }
  const origin = siteOrigin(request);

  if (request.method === 'GET' || request.method === 'HEAD') {
    const bookingId = new URL(request.url).searchParams.get('bookingId')?.trim() ?? '';
    if (!isUuid(bookingId)) return NextResponse.json({ error: 'That booking was not found.' }, { status: 400 });
    const view = await existingPaymentView(admin, bookingId, origin);
    if ('error' in view) return NextResponse.json({ error: view.error }, { status: 404 });
    return NextResponse.json(view);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Could not read that request.' }, { status: 400 });
  }
  const bookingId = typeof body.bookingId === 'string' ? body.bookingId.trim() : '';
  if (!isUuid(bookingId)) return NextResponse.json({ error: 'That booking was not found.' }, { status: 400 });
  const action = body.action === 'link' ? 'link' : 'replace';
  const result = action === 'link'
    ? await ensureExistingPaymentLink(admin, bookingId, origin)
    : await replaceExistingPayment(admin, {
        bookingId,
        amountPaid: body.amountPaid,
        balanceDueDate: body.balanceDueDate,
        paymentMethod: body.paymentMethod,
        actorId: auth.session.id,
        origin,
      });
  return NextResponse.json(result.body, { status: result.status });
}
