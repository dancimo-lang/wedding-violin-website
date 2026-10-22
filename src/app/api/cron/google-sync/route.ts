import { NextRequest, NextResponse } from 'next/server';
import { bearerAuthorized } from '@/lib/google/oauth';
import { runGoogleSync } from '@/lib/google/run';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function handle(request: NextRequest) {
  if (!bearerAuthorized(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await runGoogleSync();
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ ok: false, message: 'Google Calendar could not be synced.' }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
