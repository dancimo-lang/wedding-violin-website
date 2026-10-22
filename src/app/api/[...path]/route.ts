import { NextRequest } from 'next/server';
import { dispatchApi } from '@/lib/api/dispatch';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Context = { params: Promise<{ path: string[] }> };

async function handle(request: NextRequest, context: Context) {
  const { path } = await context.params;
  return dispatchApi(request, path);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
