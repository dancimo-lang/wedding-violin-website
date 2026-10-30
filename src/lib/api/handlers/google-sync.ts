import { NextResponse } from 'next/server';
import { logGoogleSyncFailure } from '@/lib/google/gateway';
import { runGoogleSync } from '@/lib/google/run';
import { requireAdminApi } from '@/lib/require-admin-api';

export async function POST() {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  try {
    const result = await runGoogleSync();
    return NextResponse.json(result);
  } catch (error) {
    logGoogleSyncFailure(error);
    return NextResponse.json({ ok: false, message: 'Google Calendar could not be synced.' }, { status: 500 });
  }
}
