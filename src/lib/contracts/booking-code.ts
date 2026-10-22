const BOOKING_CODE = /^DC-[0-9]{4}$/;

/** Human-friendly code for a later Zelle memo match. Example: DC-4827. Not a secret. */
export function generateBookingCode(random: () => number = Math.random): string {
  const sample = random();
  const fraction = sample > 0 && sample < 1 ? sample : sample % 1;
  const safe = fraction < 0 ? fraction + 1 : fraction;
  const suffix = 1000 + Math.floor(safe * 9000);
  return `DC-${suffix}`;
}

export function isBookingCode(value: string): boolean {
  return BOOKING_CODE.test(value);
}

export type ObligationKind = 'retainer' | 'balance';
export type ObligationStatus = 'open' | 'paid' | 'void';

/** Row shape a Chase Zelle alert matcher can filter by code, amount, and open status. */
export type ObligationLookupRow = {
  bookingCode: string;
  kind: ObligationKind;
  amountCents: number;
  status: ObligationStatus;
};

/**
 * Open retainer or balance rows whose code and amount match an alert.
 * Retainer is listed first when both halves are the same amount.
 */
export function findOpenObligations(
  rows: readonly ObligationLookupRow[],
  bookingCode: string,
  amountCents: number,
): ObligationLookupRow[] {
  const rank: Record<ObligationKind, number> = { retainer: 0, balance: 1 };
  return rows
    .filter((row) => row.status === 'open' && row.bookingCode === bookingCode && row.amountCents === amountCents)
    .slice()
    .sort((left, right) => rank[left.kind] - rank[right.kind]);
}
