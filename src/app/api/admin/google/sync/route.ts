import { NextResponse } from 'next/server';
import { runGoogleSync } from '@/lib/google/run';
import { requireAdminApi } from '@/lib/require-admin-api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST() {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  try {
    const result = await runGoogleSync();
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ ok: false, message: 'Google Calendar could not be synced.' }, { status: 500 });
  }
}
