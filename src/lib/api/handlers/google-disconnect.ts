import { NextResponse } from 'next/server';
import { disconnectGoogle } from '@/lib/google/store';
import { requireAdminApi } from '@/lib/require-admin-api';

export async function POST() {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  try {
    await disconnectGoogle();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Google Calendar could not be disconnected.' }, { status: 500 });
  }
}
