/**
 * Pure rules for adding a wedding that was booked outside the site.
 * These rows send no email and create no agreement. Money still owed is
 * saved as an open payment so the couple can pay it later.
 */
import { finalPaymentDueDate, formatMoney, isIsoDate } from '../contracts/money';
import { PACKAGES, PACKAGE_IDS, type PackageId } from '../contracts/packages';

export const EXISTING_PAYMENT_STATUSES = ['paid_in_full', 'partial', 'nothing_paid', 'retainer_paid'] as const;
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
  partial: 'Partly paid',
  nothing_paid: 'Nothing paid yet',
  retainer_paid: 'Retainer paid, balance due',
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
  paid_cents: number;
  balance_due_on: string | null;
  /** Unguessable link token for /pay. Null when nothing is owed. Not a booking code. */
  payment_token: string | null;
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

export function paymentStatusFor(paidCents: number, totalCents: number): ExistingPaymentStatus {
  if (paidCents <= 0) return 'nothing_paid';
  if (paidCents >= totalCents) return 'paid_in_full';
  return 'partial';
}

/** Memo on the manual payment row created for money received before the site. */
export function outsidePaymentMemo(methodLabel: string): string {
  return `Paid outside the site (${methodLabel}). Added manually as an existing booking.`;
}

/** True only for the manual rows this form created. Real Zelle or card payments are not these. */
export function isReplaceableOutsidePayment(row: {
  method: string | null;
  memo: string | null;
  status: string | null;
}): boolean {
  if (row.method !== 'manual' || row.status !== 'Completed' || typeof row.memo !== 'string') return false;
  return row.memo.startsWith('Paid outside the site (') && row.memo.endsWith('Added manually as an existing booking.');
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

/**
 * Record the amount already received and one open obligation for whatever is left.
 * A blank due date uses 30 days before the wedding. Nothing is split to 50% unless
 * that is the amount the owner entered.
 */
export function planExistingPayments(
  totalCents: number,
  weddingDate: string,
  paidCents: number,
  balanceDueDate?: string | null,
): PaymentPlan | { error: string } {
  if (!Number.isInteger(totalCents) || totalCents < 0) return { error: 'Enter a total price of $0 or more.' };
  if (!Number.isInteger(paidCents) || paidCents < 0) return { error: 'Enter the amount already paid, or 0.' };
  if (paidCents > totalCents) return { error: 'The amount already paid cannot be more than the total.' };
  if (!isIsoDate(weddingDate)) return { error: 'Enter the wedding date.' };
  const requested = typeof balanceDueDate === 'string' ? balanceDueDate.trim() : '';
  const due = requested || finalPaymentDueDate(weddingDate);
  if (!due || !isIsoDate(due)) return { error: 'Enter the date the balance is due.' };
  const owedCents = totalCents - paidCents;
  const obligations: ObligationPlan[] = [];
  if (paidCents === 0 && owedCents > 0) {
    obligations.push({ kind: 'retainer', amountCents: owedCents, dueOn: due, paid: false });
  } else {
    if (paidCents > 0) obligations.push({ kind: 'retainer', amountCents: paidCents, dueOn: null, paid: true });
    if (owedCents > 0) obligations.push({ kind: 'balance', amountCents: owedCents, dueOn: due, paid: false });
  }
  return {
    totalCents,
    retainerCents: paidCents > 0 ? paidCents : owedCents,
    balanceCents: paidCents > 0 ? owedCents : 0,
    paidCents,
    owedCents,
    balanceDueDate: due,
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
  paidCents: number;
  balanceDueDate: string | null;
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
  const paidCents = dollarsToCents(body.amountPaid);
  if (paidCents == null) return { error: 'Enter the amount already paid, or 0.' };
  if (paidCents > totalCents) return { error: 'The amount already paid cannot be more than the total.' };
  const dueRaw = text(body.balanceDueDate, 10);
  if (dueRaw === undefined) return { error: 'Enter the date the balance is due.' };
  if (dueRaw && !isIsoDate(dueRaw)) return { error: 'Enter the date the balance is due.' };
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
    paidCents,
    balanceDueDate: dueRaw,
    paymentStatus: paymentStatusFor(paidCents, totalCents),
    paymentMethod: methodRaw as ExistingPaymentMethod | null,
    notes,
    addToGoogle: body.addToGoogle === true,
  };
}

/** Text saved to bookings.special_requests so the record says where it came from. */
export function existingBookingNotes(input: ExistingBookingInput): string {
  const method = input.paidCents > 0 && input.paymentMethod ? ` via ${PAYMENT_METHOD_LABELS[input.paymentMethod]}` : '';
  const owed =
    input.totalCents - input.paidCents === 0
      ? 'Nothing is still owed.'
      : `$${formatMoney(input.totalCents - input.paidCents)} is still owed${input.balanceDueDate ? `, due ${input.balanceDueDate}` : ''}.`;
  const lines = [
    `Added manually as an existing booking. Paid outside the site: $${formatMoney(input.paidCents)} of $${formatMoney(input.totalCents)}${method}. ${owed}`,
  ];
  if (input.notes) lines.push(input.notes);
  return lines.join('\n\n');
}
