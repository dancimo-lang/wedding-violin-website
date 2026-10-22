import type { NextRequest } from 'next/server';
import { DELETE as deleteTune } from './handlers/admin-tune';
import { POST as postTune } from './handlers/admin-tunes';
import { GET as getAvailability } from './handlers/availability';
import { POST as postBookingStatus } from './handlers/booking-status';
import { POST as postContact } from './handlers/contact';
import { GET as syncFromCron } from './handlers/cron-google-sync';
import { GET as getGoogleCallback } from './handlers/google-callback';
import { GET as getGoogleConnect } from './handlers/google-connect';
import { POST as postGoogleDisconnect } from './handlers/google-disconnect';
import { GET as getGoogleStatus } from './handlers/google-status';
import { POST as postGoogleSync } from './handlers/google-sync';
import { GET as getPdf } from './handlers/pdf';
import { POST as restoreTunes } from './handlers/restore-tunes';
import { POST as postSignOut } from './handlers/signout';
import { GET as getTunes } from './handlers/tunes';
import { apiRouteCatalog, type ApiRouteSpec } from './route-table';
import type { ApiRequestContext } from './dispatch';

export type ApiHandler = (context: ApiRequestContext) => Promise<Response> | Response;

type RouteHandler = (
  request: NextRequest,
  context: { params: Promise<Record<string, string>> },
) => Promise<Response> | Response;

function mount(handler: RouteHandler): ApiHandler {
  return ({ request, params }) => handler(request, { params: Promise.resolve(params) });
}

export type ApiRoute = ApiRouteSpec & { handle: ApiHandler };

const handlers: Record<string, ApiHandler> = {
  'booking-status': mount(postBookingStatus),
  'google-callback': mount(getGoogleCallback),
  'google-connect': mount(getGoogleConnect),
  'google-disconnect': mount(postGoogleDisconnect),
  'google-status': mount(getGoogleStatus),
  'google-sync': mount(postGoogleSync),
  'restore-tunes': mount(restoreTunes),
  'admin-tunes': mount(postTune),
  'admin-tune': ({ request, params }) => deleteTune(request, { params: Promise.resolve({ id: params.id ?? '' }) }),
  availability: mount(getAvailability),
  contact: mount(postContact),
  'cron-google-sync': mount(syncFromCron),
  pdf: ({ request, params }) => getPdf(request, { params: Promise.resolve({ id: params.id ?? '' }) }),
  tunes: mount(getTunes),
  signout: mount(postSignOut),
};

export const apiRoutes: readonly ApiRoute[] = apiRouteCatalog.map((route) => {
  const handle = handlers[route.id];
  if (!handle) {
    throw new Error(`Missing API handler for ${route.id}`);
  }
  return { ...route, handle };
});
