'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addCalendarDays, monthGrid, todayInTimeZone } from '@/lib/schedule/time';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

type Props = {
  id: string;
  value: string;
  onChange: (date: string) => void;
};

function parts(date: string) {
  return { year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)), day: Number(date.slice(8, 10)) };
}

function longLabel(date: string) {
  const { year, month, day } = parts(date);
  const weekday = new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
  return `${weekday}, ${MONTHS[month - 1]} ${day}, ${year}`;
}

export function BookingCalendar({ id, value, onChange }: Props) {
  const [today] = useState(() => todayInTimeZone());
  const maxDate = useMemo(() => addCalendarDays(today, 760), [today]);
  const [unavailable, setUnavailable] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState(() => parts(value || today));
  const [focusDate, setFocusDate] = useState(value || today);
  const gridRef = useRef<HTMLDivElement>(null);
  const moveFocus = useRef(false);

  useEffect(() => {
    let active = true;
    fetch('/api/availability/dates')
      .then((response) => response.json())
      .then((body: { unavailable?: string[] }) => {
        if (active) setUnavailable(new Set(Array.isArray(body.unavailable) ? body.unavailable : []));
      })
      .catch(() => undefined)
      .finally(() => active && setLoaded(true));
    return () => {
      active = false;
    };
  }, []);

  const isDisabled = (date: string) => date < today || date > maxDate || unavailable.has(date);

  // If a selected date turns out to be unavailable, clear it.
  useEffect(() => {
    if (value && loaded && isDisabled(value)) onChange('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, value]);

  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${focusDate}"]`)?.focus();
  }, [focusDate, view]);

  const days = monthGrid(view.year, view.month);
  const monthKey = `${view.year}-${String(view.month).padStart(2, '0')}`;
  const canPrev = monthKey > today.slice(0, 7);
  const canNext = monthKey < maxDate.slice(0, 7);

  const shiftMonth = (delta: number) => {
    const index = view.year * 12 + (view.month - 1) + delta;
    setView({ year: Math.floor(index / 12), month: (index % 12) + 1, day: 1 });
  };

  const onKeyDown = (event: React.KeyboardEvent, date: string) => {
    const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    let next: string | null = null;
    if (event.key in steps) next = addCalendarDays(date, steps[event.key]);
    else if (event.key === 'PageUp') next = addCalendarDays(date, -30);
    else if (event.key === 'PageDown') next = addCalendarDays(date, 30);
    if (!next) return;
    event.preventDefault();
    if (next < today) next = today;
    if (next > maxDate) next = maxDate;
    moveFocus.current = true;
    setFocusDate(next);
    const p = parts(next);
    if (p.year !== view.year || p.month !== view.month) setView(p);
  };

  const tabbable = days.includes(focusDate) && focusDate.slice(0, 7) === monthKey ? focusDate : `${monthKey}-01` < today ? today : `${monthKey}-01`;

  return (
    <div id={id} className="rounded-xl border border-gray-300 p-4 text-black">
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          disabled={!canPrev}
          aria-label="Previous month"
          className="p-2 rounded-full hover:bg-amber-50 disabled:opacity-30 disabled:hover:bg-transparent focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h3 className="font-semibold text-gray-900" aria-live="polite" id={`${id}-month`}>
          {MONTHS[view.month - 1]} {view.year}
        </h3>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          disabled={!canNext}
          aria-label="Next month"
          className="p-2 rounded-full hover:bg-amber-50 disabled:opacity-30 disabled:hover:bg-transparent focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
      <div ref={gridRef} role="grid" aria-labelledby={`${id}-month`} className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((weekday) => (
          <div key={weekday} role="columnheader" className="text-xs font-medium text-gray-500 py-1">
            {weekday}
          </div>
        ))}
        {days.map((date) => {
          const inMonth = date.slice(0, 7) === monthKey;
          if (!inMonth) return <div key={date} role="gridcell" aria-hidden="true" />;
          const disabled = isDisabled(date);
          const taken = unavailable.has(date) && date >= today;
          const selected = date === value;
          const isToday = date === today;
          return (
            <div key={date} role="gridcell" aria-selected={selected}>
              <button
                type="button"
                data-date={date}
                tabIndex={date === tabbable ? 0 : -1}
                disabled={disabled}
                aria-disabled={disabled}
                aria-pressed={selected}
                aria-label={`${longLabel(date)}${taken ? ', unavailable' : disabled ? ', not available' : ''}`}
                onClick={() => {
                  setFocusDate(date);
                  onChange(date);
                }}
                onKeyDown={(event) => onKeyDown(event, date)}
                className={`w-full aspect-square max-h-12 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                  selected
                    ? 'bg-amber-700 text-white font-semibold'
                    : taken
                      ? 'bg-gray-200 text-gray-400 line-through cursor-not-allowed'
                      : disabled
                        ? 'text-gray-300 cursor-not-allowed'
                        : `hover:bg-amber-100 text-gray-900 ${isToday ? 'ring-1 ring-amber-700' : ''}`
                }`}
              >
                {Number(date.slice(8, 10))}
              </button>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-4 rounded bg-gray-200" aria-hidden="true" /> Unavailable
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-4 rounded bg-amber-700" aria-hidden="true" /> Selected
        </span>
        {!loaded && <span>Loading availability…</span>}
      </div>
    </div>
  );
}
