import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { userIsAdmin } from '@/lib/admin';
import { adminDetailShell } from '@/lib/admin-shell-path';
import { PASSWORD_RESET_API_PATH, PASSWORD_RESET_CALLBACK_PATH } from '@/lib/auth/password-reset';
import { getSupabasePublicEnv } from './env';

const CACHE_HEADERS = ['cache-control', 'expires', 'pragma'];

function isAdminPage(pathname: string) {
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

function isAdminApi(pathname: string) {
  return pathname === '/api/admin' || pathname.startsWith('/api/admin/');
}

function carrySession(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie);
  });

  for (const header of CACHE_HEADERS) {
    const value = from.headers.get(header);
    if (value) to.headers.set(header, value);
  }

  return to;
}

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Sign-out and the password-recovery email both use public paths. The handlers
  // live on the API catch-all so they do not add another Vercel function.
  if (pathname === '/auth/signout' || pathname === PASSWORD_RESET_CALLBACK_PATH) {
    const url = request.nextUrl.clone();
    url.pathname = pathname === '/auth/signout' ? '/api/auth/signout' : PASSWORD_RESET_API_PATH;
    return NextResponse.rewrite(url);
  }

  const protectedRoute = isAdminPage(pathname) || isAdminApi(pathname);
  const env = getSupabasePublicEnv();

  if (!env) {
    if (!protectedRoute) return NextResponse.next({ request });
    if (isAdminApi(pathname)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    url.searchParams.set('error', 'config');
    return NextResponse.redirect(url);
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
        Object.entries(headers).forEach(([key, value]) =>
          supabaseResponse.headers.set(key, value)
        );
      },
    },
  });

  // Refresh the session before any other Supabase call. Do not insert logic above this.
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (!protectedRoute) {
    return supabaseResponse;
  }

  const allowed = Boolean(userId) && (await userIsAdmin(supabase, userId as string));
  if (allowed) {
    const shell = adminDetailShell(pathname);
    if (!shell) return supabaseResponse;
    const url = request.nextUrl.clone();
    url.pathname = shell;
    return carrySession(supabaseResponse, NextResponse.rewrite(url));
  }

  if (isAdminApi(pathname)) {
    const denied = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return carrySession(supabaseResponse, denied);
  }

  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  if (userId) {
    url.searchParams.set('error', 'unauthorized');
  } else {
    url.searchParams.set('next', pathname + request.nextUrl.search);
  }

  return carrySession(supabaseResponse, NextResponse.redirect(url));
}
