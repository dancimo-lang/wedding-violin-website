import { NextResponse } from 'next/server';
import { googleConfigured } from '@/lib/google/env';
import { readConnectionRow } from '@/lib/google/store';
import { statusViewFromRow } from '@/lib/google/status';
import { requireAdminApi } from '@/lib/require-admin-api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET() {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const configured = googleConfigured();
  try {
    const connection = await readConnectionRow();
    if (connection.error) {
      return NextResponse.json(statusViewFromRow(configured, null), { headers: NO_STORE });
    }
    return NextResponse.json(statusViewFromRow(configured, connection.row), { headers: NO_STORE });
  } catch {
    return NextResponse.json(statusViewFromRow(configured, null), { headers: NO_STORE });
  }
}
