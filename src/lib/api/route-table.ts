/**
 * Public URL table for the single /api catch-all.
 * Adding a row here does not add a Vercel function.
 *
 * Payment routes stay on this catch-all. Stripe's webhook sets rawBody so the
 * signature is checked against the unparsed body. Zelle ingest does the same.
 * Confirmation, receipt, and processing mail are sends inside handlers.
 */
export type PathSegment = string | { readonly param: string };

export type ApiRouteSpec = {
  readonly id: string;
  readonly methods: readonly string[];
  readonly segments: readonly PathSegment[];
  /** When true, the dispatcher reads request.text() before the handler runs. */
  readonly rawBody?: boolean;
};

export function param(name: string): PathSegment {
  return { param: name };
}

export const apiRouteCatalog: readonly ApiRouteSpec[] = [
  { id: 'booking-status', methods: ['POST'], segments: ['admin', 'booking-status'] },
  { id: 'contract-send', methods: ['POST'], segments: ['admin', 'contracts'] },
  { id: 'contract-void', methods: ['POST'], segments: ['admin', 'contracts', param('id'), 'void'] },
  { id: 'contract-resend', methods: ['POST'], segments: ['admin', 'contracts', param('id'), 'resend'] },
  { id: 'contract-countersign', methods: ['POST'], segments: ['admin', 'contracts', param('id'), 'countersign'] },
  { id: 'contract-pdf', methods: ['GET'], segments: ['admin', 'contracts', param('id'), 'pdf'] },
  { id: 'google-callback', methods: ['GET'], segments: ['admin', 'google', 'callback'] },
  { id: 'google-connect', methods: ['GET'], segments: ['admin', 'google', 'connect'] },
  { id: 'google-disconnect', methods: ['POST'], segments: ['admin', 'google', 'disconnect'] },
  { id: 'google-status', methods: ['GET'], segments: ['admin', 'google', 'status'] },
  { id: 'google-sync', methods: ['POST'], segments: ['admin', 'google', 'sync'] },
  { id: 'restore-tunes', methods: ['POST'], segments: ['admin', 'restore-tunes'] },
  { id: 'admin-tunes', methods: ['POST'], segments: ['admin', 'tunes'] },
  { id: 'admin-tune', methods: ['DELETE'], segments: ['admin', 'tunes', param('id')] },
  { id: 'availability', methods: ['GET'], segments: ['availability'] },
  { id: 'contact', methods: ['POST'], segments: ['contact'] },
  { id: 'contract-view', methods: ['GET'], segments: ['contracts', 'view'] },
  { id: 'contract-sign', methods: ['POST'], segments: ['contracts', 'sign'] },
  { id: 'cron-google-sync', methods: ['GET', 'POST'], segments: ['cron', 'google-sync'] },
  { id: 'payments-zelle', methods: ['POST'], segments: ['payments', 'zelle'], rawBody: true },
  { id: 'payments-stripe-webhook', methods: ['POST'], segments: ['payments', 'stripe', 'webhook'], rawBody: true },
  { id: 'payments-checkout', methods: ['POST'], segments: ['payments', 'checkout'] },
  { id: 'payments-view', methods: ['GET'], segments: ['payments', 'view'] },
  { id: 'admin-payments', methods: ['GET'], segments: ['admin', 'payments'] },
  { id: 'admin-payments-manual', methods: ['POST'], segments: ['admin', 'payments', 'manual'] },
  { id: 'admin-payments-assign', methods: ['POST'], segments: ['admin', 'payments', 'assign'] },
  { id: 'pdf', methods: ['GET'], segments: ['pdf', param('id')] },
  { id: 'tunes', methods: ['GET'], segments: ['tunes'] },
  { id: 'password-recovery', methods: ['GET'], segments: ['auth', 'callback'] },
  { id: 'signout', methods: ['POST'], segments: ['auth', 'signout'] },
];
