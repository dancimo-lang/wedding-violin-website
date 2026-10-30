import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // Still clear cookies below so a failed sign-out cannot leave a usable session.
  }

  const response = NextResponse.redirect(new URL('/login', request.url), { status: 303 });
  const expired = {
    path: '/',
    maxAge: 0,
    expires: new Date(0),
    sameSite: 'lax' as const,
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
  };

  request.cookies.getAll().forEach((cookie) => {
    if (cookie.name.startsWith('sb-')) {
      response.cookies.set(cookie.name, '', expired);
    }
  });

  return response;
}
