/** Internal static page a detail URL is rewritten to. The browser URL stays the same. */
export function adminDetailShell(pathname: string): string | null {
  const booking = pathname.match(/^\/admin\/bookings\/([^/]+)$/);
  if (booking && booking[1] !== 'entry' && booking[1] !== 'existing') return '/admin/bookings/entry';

  const lead = pathname.match(/^\/admin\/leads\/([^/]+)$/);
  if (lead && lead[1] !== 'new' && lead[1] !== 'entry') return '/admin/leads/entry';

  return null;
}

export function adminRecordId(pathname: string, section: 'bookings' | 'leads'): string {
  const prefix = `/admin/${section}/`;
  if (!pathname.startsWith(prefix)) return '';
  const segment = pathname.slice(prefix.length).split('/')[0] ?? '';
  if (!segment || segment === 'entry' || (section === 'leads' && segment === 'new') || (section === 'bookings' && segment === 'existing')) return '';
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
