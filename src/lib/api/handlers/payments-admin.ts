import { NextResponse } from 'next/server';
import { assignReceipt, bookingPayments, manualPayment, unmatchedQueue } from '@/lib/payments/admin-payments';
import { requireAdminApi } from '@/lib/require-admin-api';

async function gate() {
  const auth = await requireAdminApi();
  if (auth.response || !auth.session) return { admin: null, response: auth.response ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  return { admin: auth.session, response: null };
}

export async function getAdminPayments(request: Request) {
  const auth = await gate();
  if (auth.response) return auth.response;
  const url = new URL(request.url);
  if (url.searchParams.get('queue') === 'unmatched') {
    const result = await unmatchedQueue();
    return NextResponse.json(result.body, { status: result.status });
  }
  const result = await bookingPayments(url.searchParams.get('bookingId')?.trim() ?? '');
  return NextResponse.json(result.body, { status: result.status });
}

export async function postAssign(request: Request) {
  const auth = await gate();
  if (auth.response) return auth.response;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Could not read that request.' }, { status: 400 });
  }
  const result = await assignReceipt({
    receiptId: typeof body.receiptId === 'string' ? body.receiptId : '',
    obligationId: typeof body.obligationId === 'string' ? body.obligationId : '',
    request,
  });
  return NextResponse.json(result.body, { status: result.status });
}

export async function postManual(request: Request) {
  const auth = await gate();
  if (auth.response) return auth.response;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Could not read that request.' }, { status: 400 });
  }
  const result = await manualPayment({
    bookingId: typeof body.bookingId === 'string' ? body.bookingId : '',
    obligationId: typeof body.obligationId === 'string' ? body.obligationId : '',
    method: typeof body.method === 'string' ? body.method : '',
    transactionNumber: typeof body.transactionNumber === 'string' ? body.transactionNumber : '',
    payerName: typeof body.payerName === 'string' ? body.payerName : '',
    memo: typeof body.memo === 'string' ? body.memo : '',
    paidOn: typeof body.paidOn === 'string' ? body.paidOn : '',
    request,
  });
  return NextResponse.json(result.body, { status: result.status });
}
