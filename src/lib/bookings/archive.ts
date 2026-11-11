export type BookingTab = 'upcoming' | 'past' | 'all';

/** Today's date as YYYY-MM-DD in the business time zone (Pacific). */
export function todayInPacific(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Past means the event date is before today; today counts as upcoming. */
export function isPastEvent(eventDate: string, today: string): boolean {
  return eventDate.slice(0, 10) < today;
}

export function inTab(eventDate: string, tab: BookingTab, today: string): boolean {
  if (tab === 'all') return true;
  const past = isPastEvent(eventDate, today);
  return tab === 'past' ? past : !past;
}
