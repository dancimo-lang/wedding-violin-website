import { NextResponse } from 'next/server';
import { runGoogleSync } from '@/lib/google/run';
import { requireAdminApi } from '@/lib/require-admin-api';
import { createAdminClient } from '@/lib/supabase/admin';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STORAGE_PATH = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

type DeleteLeadRow = {
  client_deleted?: boolean;
  booking_ids?: unknown;
  pdf_paths?: unknown;
};

function publicMessage(message: string) {
  const line = message.split('\n')[0]?.replace(/^ERROR:\s*/i, '').trim() || 'Could not delete that inquiry.';
  if (/^(not allowed|Could not find that lead|This inquiry changed)/.test(line)) return line;
  return 'Could not delete that inquiry.';
}

function storagePaths(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const paths: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const path = item.trim();
    if (!STORAGE_PATH.test(path) || path.includes('..')) continue;
    paths.push(path);
  }
  return paths;
}

function bookingIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && UUID.test(item));
}

export async function DELETE(_request: Request, leadId: string) {
  const auth = await requireAdminApi();
  if (auth.response || !auth.session) return auth.response;

  if (!UUID.test(leadId)) {
    return NextResponse.json({ error: 'That record could not be found.' }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'Could not delete that inquiry.' }, { status: 500 });
  }

  const { data, error } = await admin.rpc('admin_delete_lead', {
    p_lead_id: leadId,
    p_actor: auth.session.id,
  });

  if (error) {
    const message = publicMessage(error.message || '');
    const statusCode =
      error.code === '42501' || message === 'not allowed' ? 403 : message === 'Could not find that lead.' ? 404 : 409;
    return NextResponse.json({ error: message }, { status: statusCode });
  }

  const row = (data || {}) as DeleteLeadRow;
  const paths = storagePaths(row.pdf_paths);
  if (paths.length > 0) {
    const { error: storageError } = await admin.storage.from('contracts').remove(paths);
    if (storageError) {
      console.error('Contract PDF removal failed');
    }
  }

  if (bookingIds(row.booking_ids).length > 0) {
    try {
      await runGoogleSync();
    } catch {
      // The outbox keeps the Google delete until the next sync.
    }
  }

  return NextResponse.json({ ok: true, clientDeleted: Boolean(row.client_deleted) });
}
