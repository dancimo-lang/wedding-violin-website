import { NextRequest, NextResponse } from 'next/server';
import { readGoogleEnv } from '@/lib/google/env';
import { buildAuthorizationUrl, createOAuthState, OAUTH_STATE_COOKIE, oauthStateCookieOptions } from '@/lib/google/oauth';
import { settingsRedirect } from '@/lib/google/settings-redirect';
import { requireAdminApi } from '@/lib/require-admin-api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const env = readGoogleEnv();
  if (!env) return settingsRedirect(request, 'missing');

  const state = createOAuthState();
  const response = NextResponse.redirect(
    buildAuthorizationUrl({ clientId: env.clientId, redirectUri: env.redirectUri, state }),
  );
  response.cookies.set(OAUTH_STATE_COOKIE, state, oauthStateCookieOptions());
  return response;
}
