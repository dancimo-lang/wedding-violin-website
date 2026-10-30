/**
 * Pure rules for adding a wedding that was booked and paid outside the site.
 * No email, contract, or payment request is created from these rows.
 */
import { finalPaymentDueDate, isIsoDate, splitRetainer } from '../contracts/money';
import { PACKAGES, PACKAGE_IDS, type PackageId } from '../contracts/packages';

export const EXISTING_PAYMENT_STATUSES = ['paid_in_full', 'retainer_paid', 'nothing_paid'] as const;
export type ExistingPaymentStatus = (typeof EXISTING_PAYMENT_STATUSES)[number];

export const EXISTING_PAYMENT_METHODS = ['zelle', 'cash', 'check', 'venmo', 'card', 'other'] as const;
export type ExistingPaymentMethod = (typeof EXISTING_PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<ExistingPaymentMethod, string> = {
  zelle: 'Zelle',
  cash: 'Cash',
  check: 'Check',
  venmo: 'Venmo',
  card: 'Card',
  other: 'Other',
};

export const PAYMENT_STATUS_LABELS: Record<ExistingPaymentStatus, string> = {
  paid_in_full: 'Paid in full',
  retainer_paid: 'Retainer paid, balance due',
  nothing_paid: 'Nothing paid yet',
};

export type ExistingPackageChoice = PackageId | 'OTHER';

/** activity_events.metadata.source on the marker row for an imported booking. */
export const EXISTING_BOOKING_SOURCE = 'existing_booking';

export type ExistingBookingMarker = {
  source: typeof EXISTING_BOOKING_SOURCE;
  manually_added: true;
  paid_outside_site: true;
  google_sync: boolean;
  payment_status: ExistingPaymentStatus;
  payment_method: ExistingPaymentMethod | null;
  package: ExistingPackageChoice;
};

/** True when any marker row for the booking says it must stay off Google. */
export function isGoogleSyncExcluded(metadataRows: readonly unknown[]): boolean {
  return metadataRows.some((row) => {
    if (!row || typeof row !== 'object') return false;
    const meta = row as Record<string, unknown>;
    return meta.source === EXISTING_BOOKING_SOURCE && meta.google_sync === false;
  });
}

export function packagePriceCents(choice: ExistingPackageChoice): number | null {
  return choice === 'OTHER' ? null : PACKAGES[choice].feeCents;
}

export function packageLabel(choice: ExistingPackageChoice): string {
  return choice === 'OTHER' ? 'Other / custom' : PACKAGES[choice].title;
}

export type ObligationPlan = {
  kind: 'retainer' | 'balance';
  amountCents: number;
  dueOn: string | null;
  paid: boolean;
};

export type PaymentPlan = {
  totalCents: number;
  retainerCents: number;
  balanceCents: number;
  paidCents: number;
  owedCents: number;
  balanceDueDate: string | null;
  obligations: ObligationPlan[];
};

/** Split the total with the site's retainer rule and mark what was already received. */
export function planExistingPayments(
  totalCents: number,
  weddingDate: string,
  status: ExistingPaymentStatus,
): PaymentPlan | { error: string } {
  const split = splitRetainer(totalCents);
  if (!split) return { error: 'Enter a total price of $0 or more.' };
  if (!isIsoDate(weddingDate)) return { error: 'Enter the wedding date.' };
  const balanceDueDate = finalPaymentDueDate(weddingDate);
  const retainerPaid = status !== 'nothing_paid';
  const balancePaid = status === 'paid_in_full';
  const obligations: ObligationPlan[] = [];
  if (split.retainerCents > 0) {
    obligations.push({ kind: 'retainer', amountCents: split.retainerCents, dueOn: null, paid: retainerPaid });
  }
  if (split.balanceCents > 0) {
    obligations.push({ kind: 'balance', amountCents: split.balanceCents, dueOn: balanceDueDate, paid: balancePaid });
  }
  const paidCents = obligations.filter((o) => o.paid).reduce((sum, o) => sum + o.amountCents, 0);
  return {
    totalCents,
    retainerCents: split.retainerCents,
    balanceCents: split.balanceCents,
    paidCents,
    owedCents: totalCents - paidCents,
    balanceDueDate,
    obligations,
  };
}

export type ExistingBookingInput = {
  client1Name: string;
  client2Name: string | null;
  email: string | null;
  phone: string | null;
  weddingDate: string;
  startTime: string | null;
  endTime: string | null;
  venueName: string | null;
  venueAddress: string | null;
  packageChoice: ExistingPackageChoice;
  totalCents: number;
  paymentStatus: ExistingPaymentStatus;
  paymentMethod: ExistingPaymentMethod | null;
  notes: string | null;
  addToGoogle: boolean;
};

function text(value: unknown, max: number): string | null | undefined {
  if (value == null) return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? undefined : trimmed;
}

/** Dollars like "1000" or "1,000.50" to cents. */
export function dollarsToCents(value: unknown): number | null {
  const raw = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.replace(/[$,\s]/g, '') : '';
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return null;
  const [whole, frac = ''] = raw.split('.');
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'));
}

export function parseExistingBooking(body: Record<string, unknown>): ExistingBookingInput | { error: string } {
  const client1Name = text(body.client1Name, 200);
  if (!client1Name) return { error: 'Enter Client 1 name.' };
  const client2Name = text(body.client2Name, 200);
  if (client2Name === undefined) return { error: 'Client 2 name is too long.' };
  const emailRaw = text(body.email, 254);
  if (emailRaw === undefined) return { error: 'That email is too long.' };
  const email = emailRaw ? emailRaw.toLowerCase() : null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Check the email address.' };
  const phone = text(body.phone, 50);
  if (phone === undefined) return { error: 'That phone number is too long.' };
  const weddingDate = text(body.weddingDate, 10);
  if (!weddingDate || !isIsoDate(weddingDate)) return { error: 'Enter the wedding date.' };
  const times: (string | null)[] = [];
  for (const key of ['startTime', 'endTime'] as const) {
    const value = text(body[key], 8);
    if (value === undefined || (value && !/^\d{2}:\d{2}(:\d{2})?$/.test(value))) return { error: 'Check the start and end time.' };
    times.push(value ? value.slice(0, 5) : null);
  }
  if ((times[0] && !times[1]) || (!times[0] && times[1])) return { error: 'Enter both a start and end time, or neither.' };
  const venueName = text(body.venueName, 500);
  const venueAddress = text(body.venueAddress, 500);
  if (venueName === undefined || venueAddress === undefined) return { error: 'The venue is too long.' };
  const pkg = typeof body.package === 'string' ? body.package : '';
  if (pkg !== 'OTHER' && !(PACKAGE_IDS as readonly string[]).includes(pkg)) return { error: 'Choose a package.' };
  const packageChoice = pkg as ExistingPackageChoice;
  const totalCents = dollarsToCents(body.totalPrice);
  if (totalCents == null) return { error: 'Enter the total price in dollars.' };
  const status = typeof body.paymentStatus === 'string' ? body.paymentStatus : '';
  if (!(EXISTING_PAYMENT_STATUSES as readonly string[]).includes(status)) return { error: 'Choose a payment status.' };
  const methodRaw = typeof body.paymentMethod === 'string' && body.paymentMethod ? body.paymentMethod : null;
  if (methodRaw && !(EXISTING_PAYMENT_METHODS as readonly string[]).includes(methodRaw)) return { error: 'Choose a payment method.' };
  const notes = text(body.notes, 3500);
  if (notes === undefined) return { error: 'Notes are too long.' };
  return {
    client1Name,
    client2Name,
    email,
    phone,
    weddingDate,
    startTime: times[0],
    endTime: times[1],
    venueName,
    venueAddress,
    packageChoice,
    totalCents,
    paymentStatus: status as ExistingPaymentStatus,
    paymentMethod: methodRaw as ExistingPaymentMethod | null,
    notes,
    addToGoogle: body.addToGoogle === true,
  };
}

/** Text saved to bookings.special_requests so the record says where it came from. */
export function existingBookingNotes(input: ExistingBookingInput): string {
  const method = input.paymentMethod ? ` via ${PAYMENT_METHOD_LABELS[input.paymentMethod]}` : '';
  const lines = [
    `Added manually as an existing booking. Paid outside the site: ${PAYMENT_STATUS_LABELS[input.paymentStatus]}${input.paymentStatus === 'nothing_paid' ? '' : method}.`,
  ];
  if (input.notes) lines.push(input.notes);
  return lines.join('\n\n');
}
