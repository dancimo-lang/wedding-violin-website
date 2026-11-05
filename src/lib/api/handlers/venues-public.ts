import { NextResponse } from 'next/server';
import { searchVenues } from '@/lib/venues/search';
import { allowVenueQuery, clientIp, type RateBucket } from '@/lib/venues/rate-limit';

const buckets = new Map<string, RateBucket>();
const MAX_QUERY = 80;

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  if (query.length < 3 || query.length > MAX_QUERY) return NextResponse.json({ results: [] });
  if (!allowVenueQuery(buckets, clientIp(request), Date.now())) {
    return NextResponse.json({ results: [] }, { status: 429 });
  }
  try {
    const results = await searchVenues(query);
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
