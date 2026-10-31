import type { NextRequest } from 'next/server';
import { DELETE as deleteTune } from './handlers/admin-tune';
import { POST as postTune } from './handlers/admin-tunes';
import { GET as getAvailability } from './handlers/availability';
import { GET as getAvailabilityDates } from './handlers/availability-dates';
import { POST as postBookingStatus } from './handlers/booking-status';
import { DELETE as deleteLead } from './handlers/delete-lead';
import { POST as postExistingBooking } from './handlers/existing-booking';
import {
  getPdf as getContractPdf,
  POST as postContractSend,
  postCountersign,
  postResend,
  postVoid,
} from './handlers/contracts-admin';
import { GET as getContractView, POST as postContractSign } from './handlers/contracts-public';
import { POST as postContact } from './handlers/contact';
import { GET as syncFromCron } from './handlers/cron-google-sync';
import { GET as getGoogleCallback } from './handlers/google-callback';
import { GET as getGoogleConnect } from './handlers/google-connect';
import { POST as postGoogleDisconnect } from './handlers/google-disconnect';
import { GET as getGoogleStatus } from './handlers/google-status';
import { POST as postGoogleSync } from './handlers/google-sync';
import { getAdminPayments, postAssign, postManual } from './handlers/payments-admin';
import { getPaymentView, postCheckout, postStripeWebhook } from './handlers/payments-stripe';
import { postZelle } from './handlers/payments-zelle';
import { GET as getPdf } from './handlers/pdf';
import { POST as restoreTunes } from './handlers/restore-tunes';
import { GET as getPasswordRecovery } from './handlers/password-recovery';
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
  'existing-booking': mount(postExistingBooking),
  'delete-lead': ({ request, params }) => deleteLead(request, params.id ?? ''),
  'contract-send': mount(postContractSend),
  'contract-void': ({ request, params }) => postVoid(request, params.id ?? ''),
  'contract-resend': ({ request, params }) => postResend(request, params.id ?? ''),
  'contract-countersign': ({ request, params }) => postCountersign(request, params.id ?? ''),
  'contract-pdf': ({ request, params }) => getContractPdf(request, params.id ?? ''),
  'contract-view': mount(getContractView),
  'contract-sign': mount(postContractSign),
  'google-callback': mount(getGoogleCallback),
  'google-connect': mount(getGoogleConnect),
  'google-disconnect': mount(postGoogleDisconnect),
  'google-status': mount(getGoogleStatus),
  'google-sync': mount(postGoogleSync),
  'restore-tunes': mount(restoreTunes),
  'admin-tunes': mount(postTune),
  'admin-tune': ({ request, params }) => deleteTune(request, { params: Promise.resolve({ id: params.id ?? '' }) }),
  availability: mount(getAvailability),
  'availability-dates': () => getAvailabilityDates(),
  contact: mount(postContact),
  'cron-google-sync': mount(syncFromCron),
  'payments-zelle': ({ request, rawBody }) => postZelle(request, rawBody ?? ''),
  'payments-stripe-webhook': ({ request, rawBody }) => postStripeWebhook(request, rawBody ?? ''),
  'payments-checkout': ({ request }) => postCheckout(request),
  'payments-view': ({ request }) => getPaymentView(request),
  'admin-payments': ({ request }) => getAdminPayments(request),
  'admin-payments-manual': ({ request }) => postManual(request),
  'admin-payments-assign': ({ request }) => postAssign(request),
  pdf: ({ request, params }) => getPdf(request, { params: Promise.resolve({ id: params.id ?? '' }) }),
  tunes: mount(getTunes),
  'password-recovery': mount(getPasswordRecovery),
  signout: mount(postSignOut),
};

export const apiRoutes: readonly ApiRoute[] = apiRouteCatalog.map((route) => {
  const handle = handlers[route.id];
  if (!handle) {
    throw new Error(`Missing API handler for ${route.id}`);
  }
  return { ...route, handle };
});
