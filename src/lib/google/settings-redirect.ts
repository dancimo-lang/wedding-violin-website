import { NextRequest, NextResponse } from 'next/server';

const FLAGS = new Set(['connected', 'error', 'reconnect', 'missing', 'denied']);

export function settingsRedirect(request: NextRequest, flag: string) {
  const safe = FLAGS.has(flag) ? flag : 'error';
  const url = request.nextUrl.clone();
  url.pathname = '/admin/settings';
  url.search = `?google=${safe}`;
  return NextResponse.redirect(url);
}
