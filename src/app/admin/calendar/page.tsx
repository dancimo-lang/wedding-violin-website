'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { fieldClass } from '@/lib/leads';
import { postBookingStatus } from '@/lib/booking-status-client';
import { fetchGoogleStatus, loadGoogleBusy, requestGoogleSync, statusToExternalState, type GoogleBusyRow } from '@/lib/google/browser';
import {
  blockToOccupancy,
  bookingToOccupancy,
  DEFAULT_SCHEDULE_SETTINGS,
  evaluateAvailability,
  googleBusyChip,
  publicExternalOccupancies,
  rosterWarning,
  type ExternalCalendarState,
  type ScheduleSettings,
} from '@/lib/schedule/availability';
import { addCalendarDays, monthGrid, todayInTimeZone, venueRef } from '@/lib/schedule/time';

function supabase() {
  return createClient();
}

type CalendarBooking = {
  id: string;
  status: string;
  event_date: string;
  venue_name: string | null;
  venue_address: string | null;
  service_type: string;
  performance_start_time: string | null;
  performance_end_time: string | null;
  performers_needed: number | null;
  clients: { name: string } | null;
};

type CalendarBlock = {
  id: string;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  all_day: boolean;
  block_type: string;
  reason: string | null;
};

export default function CalendarPage() {
  const today = todayInTimeZone();
  const [cursor, setCursor] = useState(today.slice(0, 7) + '-01');
  const [view, setView] = useState<'month' | 'week' | 'agenda'>('month');
  const [selected, setSelected] = useState(today);
  const [bookings, setBookings] = useState<CalendarBooking[]>([]);
  const [blocks, setBlocks] = useState<CalendarBlock[]>([]);
  const [settings, setSettings] = useState<ScheduleSettings>(DEFAULT_SCHEDULE_SETTINGS);
  const [googleBusy, setGoogleBusy] = useState<GoogleBusyRow[]>([]);
  const [externalState, setExternalState] = useState<ExternalCalendarState>('disconnected');
  const [error, setError] = useState('');

  const range = useMemo(() => {
    if (view === 'week') return { from: addCalendarDays(weekStart(selected), -1), to: addCalendarDays(weekStart(selected), 8) };
    if (view === 'agenda') return { from: addCalendarDays(today, -7), to: addCalendarDays(today, 60) };
    const [year, month] = cursor.split('-').map(Number);
    const days = monthGrid(year, month);
    return { from: addCalendarDays(days[0], -1), to: addCalendarDays(days[41], 1) };
  }, [view, cursor, selected, today]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [settingsResult, bookingsResult, blocksResult, googleStatus, busyRows] = await Promise.all([
        supabase().from('business_settings').select('setup_buffer_minutes, breakdown_buffer_minutes, travel_buffer_minutes, performer_count').eq('id', 1).maybeSingle(),
        supabase().from('bookings').select('id, status, event_date, venue_name, venue_address, service_type, performance_start_time, performance_end_time, performers_needed, clients(name)').gte('event_date', range.from).lte('event_date', range.to).neq('status', 'Cancelled'),
        supabase().from('availability_blocks').select('id, start_date, end_date, start_time, end_time, all_day, block_type, reason').lte('start_date', range.to).gte('end_date', range.from),
        fetchGoogleStatus(),
        loadGoogleBusy(supabase(), range.from, range.to),
      ]);
      if (cancelled) return;
      setExternalState(statusToExternalState(googleStatus));
      setGoogleBusy(busyRows);
      if (bookingsResult.error || blocksResult.error) setError('Could not load the calendar.');
      if (settingsResult.data) {
        setSettings({
          setupBufferMinutes: settingsResult.data.setup_buffer_minutes,
          breakdownBufferMinutes: settingsResult.data.breakdown_buffer_minutes,
          travelBufferMinutes: settingsResult.data.travel_buffer_minutes,
          performerCount: settingsResult.data.performer_count,
        });
      }
      setBookings((bookingsResult.data || []) as unknown as CalendarBooking[]);
      setBlocks((blocksResult.data || []) as CalendarBlock[]);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to]);

  const [year, month] = cursor.split('-').map(Number);
  const days = monthGrid(year, month);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Calendar</h2>
          <p className="text-sm text-gray-600">Pacific Time, San Luis Obispo. Setup {settings.setupBufferMinutes} min, breakdown {settings.breakdownBufferMinutes} min, travel {settings.travelBufferMinutes} min.</p>
          <p className="text-xs text-gray-500 mt-1">Green is confirmed, amber is tentative, light gray is a block, and darker gray is busy on Google Calendar.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            type="month"
            className={fieldClass}
            value={cursor.slice(0, 7)}
            onChange={(event) => {
              if (!event.target.value) return;
              const next = `${event.target.value}-01`;
              setCursor(next);
              setSelected(next);
            }}
          />
          {(['month', 'week', 'agenda'] as const).map((item) => (
            <button key={item} type="button" onClick={() => setView(item)} className={`px-3 py-2 rounded-lg capitalize ${view === item ? 'bg-blue-600 text-white' : 'bg-white text-gray-800 border border-gray-300'}`}>
              {item}
            </button>
          ))}
          <Link href="/admin/settings" className="px-3 py-2 rounded-lg border border-gray-300 text-gray-800">Settings</Link>
        </div>
      </div>
      {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</div>}

      {view === 'month' && (
        <MonthView
          cursor={cursor}
          days={days}
          today={today}
          selected={selected}
          bookings={bookings}
          blocks={blocks}
          googleBusy={googleBusy}
          onSelect={(date) => {
            setSelected(date);
            setCursor(date.slice(0, 7) + '-01');
          }}
          onMonth={(delta) => setCursor(shiftMonth(cursor, delta))}
        />
      )}
      {view === 'week' && (
        <WeekView
          start={weekStart(selected)}
          today={today}
          bookings={bookings}
          blocks={blocks}
          googleBusy={googleBusy}
          onPrev={() => setSelected(addCalendarDays(selected, -7))}
          onNext={() => setSelected(addCalendarDays(selected, 7))}
        />
      )}
      {view === 'agenda' && <AgendaView today={today} bookings={bookings} blocks={blocks} googleBusy={googleBusy} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <BlockForm selected={selected} onSaved={(block) => setBlocks((current) => [...current, block])} />
        <HoldForm selected={selected} settings={settings} bookings={bookings} blocks={blocks} googleBusy={googleBusy} externalState={externalState} onSaved={(booking) => setBookings((current) => [...current, booking])} />
      </div>
      <DayList date={selected} bookings={bookings} blocks={blocks} googleBusy={googleBusy} onDelete={async (id) => {
        const { error: deleteError } = await supabase().from('availability_blocks').delete().eq('id', id);
        if (deleteError) setError('Could not remove that block.');
        else {
          setBlocks((current) => current.filter((block) => block.id !== id));
          await requestGoogleSync();
        }
      }} />
    </div>
  );
}

function MonthView({
  cursor,
  days,
  today,
  selected,
  bookings,
  blocks,
  googleBusy,
  onSelect,
  onMonth,
}: {
  cursor: string;
  days: string[];
  today: string;
  selected: string;
  bookings: CalendarBooking[];
  blocks: CalendarBlock[];
  googleBusy: GoogleBusyRow[];
  onSelect: (date: string) => void;
  onMonth: (delta: number) => void;
}) {
  const monthLabel = new Date(`${cursor}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return (
    <div className="bg-white rounded-xl shadow p-4">
      <div className="flex items-center justify-between mb-4">
        <button type="button" onClick={() => onMonth(-1)} className="px-3 py-1 text-gray-800">Previous</button>
        <h3 className="text-xl font-semibold text-gray-900">{monthLabel}</h3>
        <button type="button" onClick={() => onMonth(1)} className="px-3 py-1 text-gray-800">Next</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-xs text-gray-500 mb-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="px-2 py-1">{day}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((date) => {
          const inMonth = date.slice(0, 7) === cursor.slice(0, 7);
          const items = itemsOnDate(date, bookings, blocks, googleBusy);
          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelect(date)}
              className={`min-h-24 text-left p-2 rounded-lg border ${date === selected ? 'border-blue-500' : 'border-gray-100'} ${inMonth ? 'bg-white' : 'bg-gray-50'} ${date === today ? 'ring-1 ring-blue-300' : ''}`}
            >
              <span className="text-sm text-gray-900">{Number(date.slice(8))}</span>
              <div className="mt-1 space-y-1">
                {items.slice(0, 3).map((item) => (
                  <div key={item.id} className={`truncate rounded px-1 py-0.5 text-[11px] ${chipClass(item.tone)}`}>{item.label}</div>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({
  start,
  today,
  bookings,
  blocks,
  googleBusy,
  onPrev,
  onNext,
}: {
  start: string;
  today: string;
  bookings: CalendarBooking[];
  blocks: CalendarBlock[];
  googleBusy: GoogleBusyRow[];
  onPrev: () => void;
  onNext: () => void;
}) {
  const days = Array.from({ length: 7 }, (_, index) => addCalendarDays(start, index));
  return (
    <div className="bg-white rounded-xl shadow p-4">
      <div className="flex items-center justify-between mb-4">
        <button type="button" onClick={onPrev} className="px-3 py-1 text-gray-800">Previous week</button>
        <h3 className="font-semibold text-gray-900">{start} to {days[6]}</h3>
        <button type="button" onClick={onNext} className="px-3 py-1 text-gray-800">Next week</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
        {days.map((date) => (
          <div key={date} className={`rounded-lg border p-2 min-h-40 ${date === today ? 'border-blue-400' : 'border-gray-200'}`}>
            <div className="text-sm font-medium text-gray-900 mb-2">{date.slice(5)}</div>
            {itemsOnDate(date, bookings, blocks, googleBusy).map((item) => (
              <div key={item.id} className={`mb-2 rounded px-2 py-1 text-xs ${chipClass(item.tone)}`}>
                <div className="font-medium">{item.time}</div>
                <div>{item.label}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function AgendaView({ today, bookings, blocks, googleBusy }: { today: string; bookings: CalendarBooking[]; blocks: CalendarBlock[]; googleBusy: GoogleBusyRow[] }) {
  const dates = Array.from({ length: 45 }, (_, index) => addCalendarDays(today, index));
  const rows = dates.flatMap((date) => itemsOnDate(date, bookings, blocks, googleBusy).map((item) => ({ ...item, date })));
  return (
    <div className="bg-white rounded-xl shadow p-4">
      <h3 className="font-semibold text-gray-900 mb-3">Coming up</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">Nothing scheduled in the next 45 days.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {rows.map((item) => (
            <li key={`${item.date}-${item.id}`} className="py-3 flex gap-4">
              <span className="w-28 text-sm text-gray-600">{item.date}</span>
              <span className={`rounded px-2 py-1 text-sm ${chipClass(item.tone)}`}>{item.time} · {item.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BlockForm({ selected, onSaved }: { selected: string; onSaved: (block: CalendarBlock) => void }) {
  const [allDay, setAllDay] = useState(true);
  const [endDate, setEndDate] = useState(selected);
  const [startTime, setStartTime] = useState('12:00');
  const [endTime, setEndTime] = useState('13:00');
  const [blockType, setBlockType] = useState('Unavailable');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');
    const { data, error } = await supabase()
      .from('availability_blocks')
      .insert({
        start_date: selected,
        end_date: allDay ? (endDate >= selected ? endDate : selected) : selected,
        all_day: allDay,
        start_time: allDay ? null : startTime,
        end_time: allDay ? null : endTime,
        block_type: blockType,
        reason: reason || null,
      })
      .select('id, start_date, end_date, start_time, end_time, all_day, block_type, reason')
      .single();
    if (error || !data) {
      setMessage('Could not save that block.');
      return;
    }
    onSaved(data as CalendarBlock);
    setReason('');
    setMessage('Date blocked.');
    await requestGoogleSync();
  };

  return (
    <form onSubmit={save} className="bg-white rounded-xl shadow p-6 space-y-3">
      <h3 className="text-lg font-semibold text-gray-900">Block time</h3>
      <p className="text-sm text-gray-600">Selected date: {selected}</p>
      <label className="flex items-center gap-2 text-sm text-gray-800">
        <input type="checkbox" checked={allDay} onChange={(event) => setAllDay(event.target.checked)} />
        All day
      </label>
      {allDay ? (
        <input type="date" className={fieldClass} value={endDate} onChange={(event) => setEndDate(event.target.value)} />
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <input type="time" className={fieldClass} value={startTime} onChange={(event) => setStartTime(event.target.value)} />
          <input type="time" className={fieldClass} value={endTime} onChange={(event) => setEndTime(event.target.value)} />
        </div>
      )}
      <select className={fieldClass} value={blockType} onChange={(event) => setBlockType(event.target.value)}>
        <option>Unavailable</option>
        <option>Personal</option>
        <option>Tentative Hold</option>
      </select>
      <input className={fieldClass} placeholder="Reason, only you can see this" value={reason} onChange={(event) => setReason(event.target.value)} />
      <button type="submit" className="bg-gray-900 text-white px-4 py-2 rounded-lg">Save block</button>
      {message && <p className="text-sm text-gray-700">{message}</p>}
    </form>
  );
}

function HoldForm({
  selected,
  settings,
  bookings,
  blocks,
  googleBusy,
  externalState,
  onSaved,
}: {
  selected: string;
  settings: ScheduleSettings;
  bookings: CalendarBooking[];
  blocks: CalendarBlock[];
  googleBusy: GoogleBusyRow[];
  externalState: ExternalCalendarState;
  onSaved: (booking: CalendarBooking) => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [start, setStart] = useState('16:00');
  const [end, setEnd] = useState('17:00');
  const [venue, setVenue] = useState('');
  const [address, setAddress] = useState('');
  const [service, setService] = useState('Wedding performance');
  const [performers, setPerformers] = useState('1');
  const [status, setStatus] = useState<'Tentative' | 'Confirmed'>('Tentative');
  const [message, setMessage] = useState('');

  const reasons = useMemo(() => {
    const occupancies = [
      ...bookings.flatMap((booking) => {
        const occupancy = bookingToOccupancy(booking);
        return occupancy ? [occupancy] : [];
      }),
      ...blocks.map(blockToOccupancy),
      ...publicExternalOccupancies(externalState, googleBusy),
    ];
    const assessment = evaluateAvailability(
      { date: selected, startTime: start, endTime: end, venue: venueRef(address, venue) },
      occupancies,
      settings,
      undefined,
      externalState,
    );
    const roster = rosterWarning(Number(performers), settings);
    return roster ? [...assessment.reasons, roster] : assessment.reasons;
  }, [address, blocks, bookings, end, externalState, googleBusy, performers, selected, settings, start, venue]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setMessage('Enter a client name.');
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();
    let clientId: string | null = null;
    if (normalizedEmail) {
      const { data } = await supabase().from('clients').select('id').eq('email', normalizedEmail).maybeSingle();
      clientId = data?.id || null;
    }
    if (!clientId) {
      const { data, error } = await supabase().from('clients').insert({ name: name.trim(), email: normalizedEmail || null }).select('id').single();
      if (error || !data) {
        setMessage('Could not save the client.');
        return;
      }
      clientId = data.id;
    }
    const result = await postBookingStatus({
      action: 'apply_booking',
      status,
      fields: {
        client_id: clientId,
        event_date: selected,
        venue_name: venue || null,
        venue_address: address || null,
        service_type: service || 'Performance',
        performance_start_time: start,
        performance_end_time: end,
        performers_needed: Number(performers) || 1,
        total_price: 0,
      },
    });
    if (!result.ok || !result.bookingId) {
      setMessage(result.ok ? 'Could not save the hold.' : result.error);
      return;
    }
    onSaved({
      id: result.bookingId,
      status: result.bookingStatus || status,
      event_date: selected,
      venue_name: venue || null,
      venue_address: address || null,
      service_type: service || 'Performance',
      performance_start_time: start,
      performance_end_time: end,
      performers_needed: Number(performers) || 1,
      clients: { name: name.trim() },
    });
    setMessage(status === 'Confirmed' ? 'Confirmed. The calendar is blocked.' : 'Tentative hold saved.');
    setName('');
    await requestGoogleSync();
  };

  return (
    <form onSubmit={save} className="bg-white rounded-xl shadow p-6 space-y-3">
      <h3 className="text-lg font-semibold text-gray-900">Add a hold on {selected}</h3>
      <input className={fieldClass} placeholder="Client name" value={name} onChange={(event) => setName(event.target.value)} />
      <input className={fieldClass} placeholder="Email, optional" value={email} onChange={(event) => setEmail(event.target.value)} />
      <div className="grid grid-cols-2 gap-2">
        <input type="time" className={fieldClass} value={start} onChange={(event) => setStart(event.target.value)} />
        <input type="time" className={fieldClass} value={end} onChange={(event) => setEnd(event.target.value)} />
      </div>
      <input className={fieldClass} placeholder="Venue name" value={venue} onChange={(event) => setVenue(event.target.value)} />
      <input className={fieldClass} placeholder="Venue address" value={address} onChange={(event) => setAddress(event.target.value)} />
      <input className={fieldClass} placeholder="Service" value={service} onChange={(event) => setService(event.target.value)} />
      <div className="grid grid-cols-2 gap-2">
        <input type="number" min={1} max={12} className={fieldClass} value={performers} onChange={(event) => setPerformers(event.target.value)} />
        <select className={fieldClass} value={status} onChange={(event) => setStatus(event.target.value as 'Tentative' | 'Confirmed')}>
          <option value="Tentative">Tentative</option>
          <option value="Confirmed">Confirmed</option>
        </select>
      </div>
      {reasons.length > 0 && <p className="text-sm text-amber-900">{reasons[0]}</p>}
      <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg">Save hold</button>
      {message && <p className="text-sm text-gray-700">{message}</p>}
    </form>
  );
}

function DayList({
  date,
  bookings,
  blocks,
  googleBusy,
  onDelete,
}: {
  date: string;
  bookings: CalendarBooking[];
  blocks: CalendarBlock[];
  googleBusy: GoogleBusyRow[];
  onDelete: (id: string) => void;
}) {
  const items = itemsOnDate(date, bookings, blocks, googleBusy);
  return (
    <div className="bg-white rounded-xl shadow p-6 mt-6">
      <h3 className="font-semibold text-gray-900 mb-3">{date}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500">Nothing on this date.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3">
              <span className="text-sm text-gray-800">{item.time} · {item.label}</span>
              {item.href ? (
                <Link href={item.href} className="text-sm text-blue-700">Open</Link>
              ) : item.removable ? (
                <button type="button" onClick={() => onDelete(item.id)} className="text-sm text-red-700">Remove block</button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function itemsOnDate(date: string, bookings: CalendarBooking[], blocks: CalendarBlock[], googleBusy: GoogleBusyRow[]) {
  const bookingItems = bookings
    .filter((booking) => booking.event_date === date || (booking.performance_end_time && booking.performance_start_time && booking.performance_end_time <= booking.performance_start_time && addCalendarDays(booking.event_date, 1) === date))
    .map((booking) => ({
      id: booking.id,
      tone: booking.status === 'Confirmed' || booking.status === 'Completed' ? 'confirmed' as const : 'tentative' as const,
      time: `${(booking.performance_start_time || '').slice(0, 5)}–${(booking.performance_end_time || '').slice(0, 5)}`,
      label: `${booking.clients?.name || 'Hold'} · ${booking.service_type}${booking.performers_needed && booking.performers_needed > 1 ? ` · ${booking.performers_needed} musicians` : ''}`,
      href: `/admin/bookings/${booking.id}`,
      removable: false,
    }));
  const blockItems = blocks
    .filter((block) => block.start_date <= date && block.end_date >= date)
    .map((block) => ({
      id: block.id,
      tone: block.block_type === 'Tentative Hold' ? 'tentative' as const : 'block' as const,
      time: block.all_day ? 'All day' : `${(block.start_time || '').slice(0, 5)}–${(block.end_time || '').slice(0, 5)}`,
      label: block.reason || block.block_type,
      href: null,
      removable: true,
    }));
  const googleItems = googleBusy.flatMap((row) => {
    const chip = googleBusyChip(row, date);
    if (!chip) return [];
    return [{
      id: `google-${chip.id}`,
      tone: 'google' as const,
      time: chip.time,
      label: chip.label,
      href: null,
      removable: false,
    }];
  });
  return [...bookingItems, ...blockItems, ...googleItems];
}

function chipClass(tone: 'confirmed' | 'tentative' | 'block' | 'google') {
  if (tone === 'confirmed') return 'bg-green-100 text-green-900';
  if (tone === 'tentative') return 'bg-amber-100 text-amber-950';
  if (tone === 'google') return 'bg-gray-300 text-gray-600';
  return 'bg-gray-200 text-gray-800';
}

function weekStart(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return date;
  const dow = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))).getUTCDay();
  return addCalendarDays(date, -dow);
}

function shiftMonth(cursor: string, delta: number) {
  const [year, month] = cursor.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1 + delta, 1));
  return next.toISOString().slice(0, 10);
}
