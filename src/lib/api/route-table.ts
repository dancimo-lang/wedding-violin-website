/**
 * Public URL table for the single /api catch-all.
 * Adding a row here does not add a Vercel function.
 *
 * Upcoming phases plug in as more rows:
 * - Stripe webhook: POST ["stripe", "webhook"] with rawBody so the signature
 *   is checked against the unparsed body. ACH stays the default; card is the backup.
 * - Contract signing lives on GET contracts/view and POST contracts/sign.
 *   Admin send, void, resend, countersign, and PDF download are sibling rows.
 * - Resend confirmation, payment receipt, and thank-you mail are sends inside
 *   handlers, not new routes.
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
  { id: 'pdf', methods: ['GET'], segments: ['pdf', param('id')] },
  { id: 'tunes', methods: ['GET'], segments: ['tunes'] },
  { id: 'signout', methods: ['POST'], segments: ['auth', 'signout'] },
];
