import 'server-only';
import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/admin-session';

export async function requireAdminApi() {
  try {
    const session = await getAdminSession();
    if (!session) {
      return {
        session: null,
        response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      };
    }
    return { session, response: null };
  } catch {
    return {
      session: null,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }
}
