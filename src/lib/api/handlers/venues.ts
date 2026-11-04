import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/require-admin-api';
import { searchPhoton } from '@/lib/venues/photon';

export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if (auth.response || !auth.session) return auth.response;
  const query = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  if (query.length < 3) return NextResponse.json({ results: [] });
  try {
    const results = await searchPhoton(query);
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
