import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import {
  PASSWORD_RESET_PAGE_PATH,
  pkceFlowId,
  recoveryExchangeError,
  recoveryRedirectError,
  type AuthFailure,
  type RecoveryLinkCode,
} from '@/lib/auth/password-reset';
import { getSupabasePublicEnv } from '@/lib/supabase/env';

/**
 * The email link lands here.
 *
 * @supabase/ssr uses PKCE, so the default recovery template redirects with
 * `?code=` after Supabase verifies the token. The code verifier is the cookie
 * written when the reset was requested in this browser.
 *
 * A recovery template that points at this URL with `token_hash` and
 * `type=recovery` is also accepted, and that link works on another device.
 */
export async function GET(request: NextRequest) {
  if (request.method === 'HEAD') {
    return new NextResponse(null, { status: 200, headers: { 'Cache-Control': 'private, no-store' } });
  }

  const params = request.nextUrl.searchParams;
  const redirectError = recoveryRedirectError({
    error: params.get('error'),
    errorCode: params.get('error_code'),
    errorDescription: params.get('error_description'),
  });
  if (redirectError) return failureRedirect(request, redirectError);

  const env = getSupabasePublicEnv();
  if (!env) return failureRedirect(request, 'config');

  const code = params.get('code');
  const tokenHash = params.get('token_hash');
  const type = params.get('type');
  if (!code && !(tokenHash && type === 'recovery')) {
    return failureRedirect(request, 'invalid');
  }

  const destination = new URL(PASSWORD_RESET_PAGE_PATH, request.url);
  destination.search = '';
  const response = NextResponse.redirect(destination);

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  const flowId = pkceFlowId(params.get('sb_flow_id'));
  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined)
    : await supabase.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash ?? '' });

  if (error) return failureRedirect(request, recoveryExchangeError(error as AuthFailure));

  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

function failureRedirect(request: NextRequest, code: RecoveryLinkCode) {
  const url = new URL(PASSWORD_RESET_PAGE_PATH, request.url);
  url.search = '';
  url.searchParams.set('error', code);
  const response = NextResponse.redirect(url);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
