import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/require-admin-api';
import { searchVenues } from '@/lib/venues/search';

export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if (auth.response || !auth.session) return auth.response;
  const query = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  if (query.length < 3) return NextResponse.json({ results: [] });
  try {
    const results = await searchVenues(query);
    console.info(`venue search count=${results.length} qLen=${query.length}`);
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
