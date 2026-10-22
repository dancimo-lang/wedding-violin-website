import { NextRequest } from 'next/server';
import { readGoogleEnv } from '@/lib/google/env';
import { GoogleCalendarClient } from '@/lib/google/http';
import { OAUTH_STATE_COOKIE, oauthStateCookieOptions, secretsMatch } from '@/lib/google/oauth';
import { runGoogleSync } from '@/lib/google/run';
import { saveOAuthConnection } from '@/lib/google/store';
import { settingsRedirect } from '@/lib/google/settings-redirect';
import { requireAdminApi } from '@/lib/require-admin-api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const env = readGoogleEnv();
  if (!env) return clearState(settingsRedirect(request, 'missing'));

  const googleError = request.nextUrl.searchParams.get('error');
  if (googleError === 'access_denied') return clearState(settingsRedirect(request, 'denied'));
  if (googleError) return clearState(settingsRedirect(request, 'error'));

  const code = request.nextUrl.searchParams.get('code') || '';
  const state = request.nextUrl.searchParams.get('state') || '';
  const cookie = request.cookies.get(OAUTH_STATE_COOKIE)?.value || '';
  if (!code || !secretsMatch(state, cookie)) return clearState(settingsRedirect(request, 'error'));

  try {
    const google = new GoogleCalendarClient(env);
    const tokens = await google.exchangeCode(code);
    const email = await google.userEmail(tokens.accessToken);
    await saveOAuthConnection({ refreshToken: tokens.refreshToken, email });
  } catch {
    return clearState(settingsRedirect(request, 'error'));
  }

  try {
    const sync = await runGoogleSync();
    return clearState(settingsRedirect(request, sync.needsReconnect ? 'reconnect' : 'connected'));
  } catch {
    return clearState(settingsRedirect(request, 'connected'));
  }
}

function clearState(response: ReturnType<typeof settingsRedirect>) {
  response.cookies.set(OAUTH_STATE_COOKIE, '', { ...oauthStateCookieOptions(), maxAge: 0 });
  return response;
}
