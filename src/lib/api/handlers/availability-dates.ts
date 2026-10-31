import { NextResponse } from 'next/server';
import { addCalendarDays, todayInTimeZone } from '@/lib/schedule/time';
import { loadUnavailableDates } from '@/lib/schedule/unavailable-dates-server';
import { createAdminClient } from '@/lib/supabase/admin';

/** Public: only a list of unavailable Pacific dates. No event details. */
export async function GET() {
  const from = todayInTimeZone();
  const to = addCalendarDays(from, 760);
  let dates: string[] | null = null;
  try {
    dates = await loadUnavailableDates(createAdminClient(), from, to);
  } catch {
    dates = null;
  }
  if (!dates) {
    return NextResponse.json({ from, to, unavailable: [], ok: false }, { headers: { 'Cache-Control': 'no-store' } });
  }
  return NextResponse.json(
    { from, to, unavailable: dates, ok: true },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
  );
}
