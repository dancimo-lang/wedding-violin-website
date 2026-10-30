import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  blockToOccupancy,
  bookingToOccupancy,
  DEFAULT_SCHEDULE_SETTINGS,
  evaluateAvailability,
  externalCalendarState,
  publicExternalOccupancies,
  type ExternalCalendarState,
  type ScheduleSettings,
} from '@/lib/schedule/availability';
import { refreshStaleBusyForAvailability } from '@/lib/google/run';
import { addCalendarDays, zonedWallTimeToUtc } from '@/lib/schedule/time';
import { createAdminClient } from '@/lib/supabase/admin';

const NO_STORE = { 'Cache-Control': 'no-store' };

function manual() {
  return NextResponse.json({ result: 'requires_manual_confirmation' }, { headers: NO_STORE });
}

function clientIp(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown';
  return request.headers.get('x-real-ip') || 'unknown';
}

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get('date') || '';
  const start = request.nextUrl.searchParams.get('start');
  const end = request.nextUrl.searchParams.get('end');

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Check a single date.' }, { status: 400, headers: NO_STORE });
  }

  const year = Number(date.slice(0, 4));
  if (year < 2024 || year > 2036) return manual();
  if ((start && !/^\d{2}:\d{2}$/.test(start)) || (end && !/^\d{2}:\d{2}$/.test(end))) return manual();

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return manual();
  }

  const ipHash = createHash('sha256').update(clientIp(request)).digest('hex');
  const [minute, hour] = await Promise.all([
    admin.rpc('consume_availability_check', { p_ip_hash: ipHash, p_window_seconds: 60, p_limit: 30 }),
    admin.rpc('consume_availability_check', { p_ip_hash: ipHash, p_window_seconds: 3600, p_limit: 40 }),
  ]);

  if (minute.error || hour.error) return manual();
  if (minute.data !== true || hour.data !== true) {
    return NextResponse.json(
      { error: 'Please wait a little while before checking another date.' },
      { status: 429, headers: NO_STORE },
    );
  }

  const from = addCalendarDays(date, -1);
  const to = addCalendarDays(date, 1);
  const windowStart = zonedWallTimeToUtc(from, '00:00');
  const windowEnd = zonedWallTimeToUtc(addCalendarDays(to, 1), '00:00');
  if (!windowStart.ok || !windowEnd.ok) return manual();

  const readConnection = () =>
    admin.from('google_calendar_connection').select('status, busy_synced_at').eq('id', 1).maybeSingle();
  const readBusy = () =>
    admin
      .from('google_busy_times')
      .select('id, starts_at, ends_at')
      .lt('starts_at', new Date(windowEnd.utcMs).toISOString())
      .gt('ends_at', new Date(windowStart.utcMs).toISOString());

  const [settingsResult, bookingsResult, blocksResult, initialConnection, initialBusy] = await Promise.all([
    admin
      .from('business_settings')
      .select('setup_buffer_minutes, breakdown_buffer_minutes, travel_buffer_minutes, performer_count')
      .eq('id', 1)
      .maybeSingle(),
    admin
      .from('bookings')
      .select('id, status, event_date, performance_start_time, performance_end_time, venue_name, venue_address, performers_needed')
      .gte('event_date', from)
      .lte('event_date', to),
    admin
      .from('availability_blocks')
      .select('id, block_type, start_date, end_date, start_time, end_time, all_day')
      .lte('start_date', to)
      .gte('end_date', from),
    readConnection(),
    readBusy(),
  ]);
  let connectionResult = initialConnection;
  let busyResult = initialBusy;

  // Stored busy times older than the freshness limit: try one throttled,
  // time-boxed busy-only refresh from Google, then re-read. On any failure the
  // stale state stays and the answer is requires_manual_confirmation as before.
  if (!connectionResult.error) {
    const state = externalCalendarState(connectionResult.data);
    if ((state === 'stale' || state === 'unsynced') && (await refreshStaleBusyForAvailability())) {
      const [freshConnection, freshBusy] = await Promise.all([readConnection(), readBusy()]);
      connectionResult = freshConnection;
      busyResult = freshBusy;
    }
  }

  if (bookingsResult.error || blocksResult.error) return manual();

  let externalState: ExternalCalendarState = 'disconnected';
  if (!connectionResult.error) {
    externalState = externalCalendarState(connectionResult.data);
    if (externalState !== 'disconnected' && busyResult.error) externalState = 'stale';
  }

  const row = settingsResult.data;
  const settings: ScheduleSettings = row
    ? {
        setupBufferMinutes: row.setup_buffer_minutes,
        breakdownBufferMinutes: row.breakdown_buffer_minutes,
        travelBufferMinutes: row.travel_buffer_minutes,
        performerCount: row.performer_count,
      }
    : DEFAULT_SCHEDULE_SETTINGS;

  const occupancies = [
    ...(bookingsResult.data || []).flatMap((booking) => {
      const occupancy = bookingToOccupancy(booking);
      return occupancy ? [occupancy] : [];
    }),
    ...(blocksResult.data || []).map(blockToOccupancy),
    ...publicExternalOccupancies(
      externalState,
      externalState === 'disconnected' || busyResult.error ? [] : busyResult.data || [],
    ),
  ];

  const assessment = evaluateAvailability(
    { date, startTime: start, endTime: end, venue: null },
    occupancies,
    settings,
    undefined,
    externalState,
  );

  return NextResponse.json({ result: assessment.result }, { headers: NO_STORE });
}
