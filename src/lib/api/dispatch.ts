import { NextRequest, NextResponse } from 'next/server';
import { matchApiRoute } from './match';
import { apiRoutes, type ApiHandler } from './routes';

export type ApiRequestContext = {
  request: NextRequest;
  params: Record<string, string>;
  /**
   * Unparsed body, set only for routes that opt into rawBody.
   * Stripe's webhook signature has to be computed from these exact bytes.
   */
  rawBody?: string;
};

export async function dispatchApi(request: NextRequest, path: readonly string[]): Promise<Response> {
  const match = matchApiRoute(request.method, path, apiRoutes);
  if (match.kind === 'miss') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (match.kind === 'method') {
    return new NextResponse(null, { status: 405, headers: { Allow: match.allow } });
  }

  const handler = match.route.handle;
  if (!handler) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const rawBody = match.route.rawBody ? await request.text() : undefined;
  return handler({ request, params: match.params, rawBody });
}

export type { ApiHandler };
