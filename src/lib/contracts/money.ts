import { addCalendarDays } from '@/lib/schedule/time';
import { packageDefinition, type PackageId } from './packages';

export type FeeInput = {
  packageId: PackageId;
  travelFeeCents: number;
  additionalFeesCents: number;
  discountCents: number;
  weddingDateIso: string;
};

export type FeeSummary = {
  packageId: PackageId;
  packageFeeCents: number;
  travelFeeCents: number;
  additionalFeesCents: number;
  discountCents: number;
  totalCents: number;
  retainerCents: number;
  balanceCents: number;
  /** Wedding date minus 30 calendar days. YYYY-MM-DD. */
  finalPaymentDueDate: string;
};

export function formatMoney(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(Math.trunc(cents));
  const dollars = Math.floor(abs / 100);
  const remainder = String(abs % 100).padStart(2, '0');
  const withCommas = String(dollars).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}${withCommas}.${remainder}`;
}

export function centsToDollarString(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(Math.trunc(cents));
  return `${negative ? '-' : ''}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/** Whole dollars and cents. Empty input is zero. More than two decimal places is rejected. */
export function parseDollarInput(value: unknown): number | null {
  if (value == null) return 0;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return null;
    const cents = Math.round(value * 100);
    if (Math.abs(value * 100 - cents) > 1e-6) return null;
    return cents;
  }
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/[$,]/g, '');
  if (!trimmed) return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const [whole, frac = ''] = trimmed.split('.');
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'));
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export function isIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const utc = new Date(Date.UTC(year, month - 1, day));
  return utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day;
}

export function formatLongDate(isoDate: string): string {
  if (!isIsoDate(isoDate)) return '';
  const [, year, month, day] = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate) ?? [];
  return `${MONTHS[Number(month) - 1]} ${Number(day)}, ${year}`;
}

/** Final payment is due 30 calendar days before the wedding date. */
export function finalPaymentDueDate(weddingDateIso: string): string | null {
  if (!isIsoDate(weddingDateIso)) return null;
  const due = addCalendarDays(weddingDateIso, -30);
  if (!isIsoDate(due) || addCalendarDays(due, 30) !== weddingDateIso) return null;
  return due;
}

/**
 * Retainer and balance are each half of the total.
 * They always add back to the total. An odd cent goes to the retainer.
 */
export function splitRetainer(totalCents: number): { retainerCents: number; balanceCents: number } | null {
  if (!Number.isInteger(totalCents) || totalCents < 0) return null;
  const retainerCents = Math.round(totalCents / 2);
  return { retainerCents, balanceCents: totalCents - retainerCents };
}

export function computeFees(input: FeeInput): FeeSummary | { error: string } {
  const definition = packageDefinition(input.packageId);
  const amounts = [input.travelFeeCents, input.additionalFeesCents, input.discountCents];
  if (amounts.some((value) => !Number.isInteger(value) || value < 0)) {
    return { error: 'Enter fees as dollar amounts with at most two decimal places.' };
  }
  if (input.packageId === 'FULL') {
    if (input.discountCents !== 0) {
      return { error: 'The full wedding agreement has no blank for a discount.' };
    }
  }
  const due = finalPaymentDueDate(input.weddingDateIso);
  if (!due) return { error: 'Add the wedding date. The balance is due 30 days before that date.' };
  const totalCents =
    definition.feeCents + input.travelFeeCents + input.additionalFeesCents - input.discountCents;
  if (totalCents < 0) return { error: 'The discount cannot be larger than the package fee plus the other fees.' };
  const split = splitRetainer(totalCents);
  if (!split) return { error: 'The total could not be calculated.' };
  return {
    packageId: input.packageId,
    packageFeeCents: definition.feeCents,
    travelFeeCents: input.travelFeeCents,
    additionalFeesCents: input.additionalFeesCents,
    discountCents: input.discountCents,
    totalCents,
    retainerCents: split.retainerCents,
    balanceCents: split.balanceCents,
    finalPaymentDueDate: due,
  };
}
