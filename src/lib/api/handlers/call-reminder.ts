import { NextResponse } from 'next/server';
import { queueCallReminderAndSync } from '@/lib/google/call-reminder-queue';
import { requireAdminApi } from '@/lib/require-admin-api';
import { createAdminClient } from '@/lib/supabase/admin';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** After the details form is saved. Preview logs and does not touch Google. */
export async function POST(_request: Request, leadId: string) {
  const auth = await requireAdminApi();
  if (auth.response || !auth.session) return auth.response;
  if (!UUID.test(leadId)) {
    return NextResponse.json({ error: 'That record could not be found.' }, { status: 400 });
  }
  try {
    const result = await queueCallReminderAndSync(createAdminClient(), leadId);
    return NextResponse.json({ ok: true, skipped: result === 'skipped' });
  } catch {
    return NextResponse.json({ ok: true, skipped: true });
  }
}
