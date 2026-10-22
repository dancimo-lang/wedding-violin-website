export type ObligationKind = 'retainer' | 'balance';
export type ObligationStatus = 'open' | 'paid' | 'void';

export type ObligationRef = {
  id: string;
  bookingId: string;
  bookingCode: string;
  kind: ObligationKind;
  amountCents: number;
  status: ObligationStatus;
  dueOn: string | null;
};

const CODE = /(?:^|[^A-Za-z0-9])DC[\s-]*([0-9]{4})(?![0-9])/gi;

/** Pull DC-#### codes out of a Zelle memo. Case, dash, and spaces are optional. */
export function extractBookingCodes(memo: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  for (const match of memo.matchAll(CODE)) {
    const code = `DC-${match[1]}`;
    if (seen.has(code)) continue;
    seen.add(code);
    found.push(code);
  }
  return found;
}

export type ObligationChoice =
  | { outcome: 'match'; obligation: ObligationRef }
  | { outcome: 'none' }
  | { outcome: 'ambiguous' };

/**
 * Open obligations for this code and exact amount.
 * When the retainer and the balance are the same amount, the retainer wins.
 * Two different bookings, or two of the same kind, stay ambiguous.
 */
export function selectObligation(
  rows: readonly ObligationRef[],
  bookingCode: string,
  amountCents: number,
): ObligationChoice {
  const wanted = bookingCode.toUpperCase();
  const open = rows.filter(
    (row) =>
      row.status === 'open' &&
      row.bookingCode.toUpperCase() === wanted &&
      row.amountCents === amountCents,
  );
  if (open.length === 0) return { outcome: 'none' };
  const rank: Record<ObligationKind, number> = { retainer: 0, balance: 1 };
  open.sort((left, right) => rank[left.kind] - rank[right.kind] || left.id.localeCompare(right.id));
  const bookingIds = new Set(open.map((row) => row.bookingId));
  if (bookingIds.size > 1) return { outcome: 'ambiguous' };
  const retainers = open.filter((row) => row.kind === 'retainer').length;
  const balances = open.filter((row) => row.kind === 'balance').length;
  if (retainers > 1 || balances > 1) return { outcome: 'ambiguous' };
  return { outcome: 'match', obligation: open[0] };
}

export type ZellePlan =
  | { outcome: 'ignored'; reason: 'no_booking_code' }
  | { outcome: 'unmatched'; reason: 'no_open_obligation' | 'ambiguous' | 'multiple_codes'; code: string | null }
  | { outcome: 'matched'; code: string; obligation: ObligationRef };

/** A memo with no DC code is ignored. A code that does not match one open amount is unmatched. */
export function planZelleIngest(memo: string, amountCents: number, obligations: readonly ObligationRef[]): ZellePlan {
  const codes = extractBookingCodes(memo || '');
  if (codes.length === 0) return { outcome: 'ignored', reason: 'no_booking_code' };
  if (codes.length > 1) return { outcome: 'unmatched', reason: 'multiple_codes', code: codes[0] ?? null };
  const code = codes[0] ?? '';
  const choice = selectObligation(obligations, code, amountCents);
  if (choice.outcome === 'match') return { outcome: 'matched', code, obligation: choice.obligation };
  if (choice.outcome === 'ambiguous') return { outcome: 'unmatched', reason: 'ambiguous', code };
  return { outcome: 'unmatched', reason: 'no_open_obligation', code };
}

export function zelleNotifiesOwner(plan: ZellePlan): boolean {
  return plan.outcome === 'unmatched';
}

export type StoredReceipt = {
  transactionNumber: string;
  outcome: 'matched' | 'unmatched' | 'ignored';
};

/**
 * The Chase transaction number is the idempotency key.
 * A second delivery returns the first outcome and does not match again.
 */
export function ingestZelleOnce(
  store: Map<string, StoredReceipt>,
  input: { transactionNumber: string; memo: string; amountCents: number; obligations: readonly ObligationRef[] },
): { duplicate: boolean; outcome: StoredReceipt['outcome']; plan: ZellePlan | null } {
  const existing = store.get(input.transactionNumber);
  if (existing) return { duplicate: true, outcome: existing.outcome, plan: null };
  const plan = planZelleIngest(input.memo, input.amountCents, input.obligations);
  const outcome = plan.outcome === 'matched' ? 'matched' : plan.outcome === 'ignored' ? 'ignored' : 'unmatched';
  store.set(input.transactionNumber, { transactionNumber: input.transactionNumber, outcome });
  return { duplicate: false, outcome, plan };
}
