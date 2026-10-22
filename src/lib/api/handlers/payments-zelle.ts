import { NextResponse } from 'next/server';
import { ZELLE_SIGNATURE_HEADER, ZELLE_TIMESTAMP_HEADER } from '@/lib/payments/hmac';
import { ingestZelle } from '@/lib/payments/ingest-zelle';

export async function postZelle(request: Request, rawBody: string) {
  const result = await ingestZelle({
    rawBody,
    timestamp: request.headers.get(ZELLE_TIMESTAMP_HEADER),
    signature: request.headers.get(ZELLE_SIGNATURE_HEADER),
    request,
  });
  return NextResponse.json(result.body, { status: result.status });
}
