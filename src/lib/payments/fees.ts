/**
 * Stripe's published standard US rates, used only when the env vars are unset.
 * Cards: 2.9% + 30¢ per successful domestic card charge.
 *   https://stripe.com/pricing
 * ACH Direct Debit: 0.8% per successful charge, capped at $5.00, standard settlement.
 *   https://stripe.com/pricing/local-payment-methods
 * Custom Stripe pricing will not match these defaults. Set the env vars to the
 * rates on the account.
 */
export const STRIPE_PUBLISHED_CARD_BPS = 290;
export const STRIPE_PUBLISHED_CARD_FLAT_CENTS = 30;
export const STRIPE_PUBLISHED_ACH_BPS = 80;
export const STRIPE_PUBLISHED_ACH_CAP_CENTS = 500;

export type FeeRule = {
  bps: number;
  flatCents: number;
  capCents: number | null;
  passThrough: boolean;
};

export type FeeSettings = {
  card: FeeRule;
  ach: FeeRule;
};

type FeeEnv = {
  STRIPE_CARD_FEE_PERCENT?: string;
  STRIPE_CARD_FEE_FLAT_CENTS?: string;
  STRIPE_PASS_CARD_FEE?: string;
  STRIPE_ACH_FEE_PERCENT?: string;
  STRIPE_ACH_FEE_FLAT_CENTS?: string;
  STRIPE_ACH_FEE_CAP_CENTS?: string;
  STRIPE_PASS_ACH_FEE?: string;
};

function feeEnv(env?: FeeEnv): FeeEnv {
  if (env) return env;
  return {
    STRIPE_CARD_FEE_PERCENT: process.env.STRIPE_CARD_FEE_PERCENT,
    STRIPE_CARD_FEE_FLAT_CENTS: process.env.STRIPE_CARD_FEE_FLAT_CENTS,
    STRIPE_PASS_CARD_FEE: process.env.STRIPE_PASS_CARD_FEE,
    STRIPE_ACH_FEE_PERCENT: process.env.STRIPE_ACH_FEE_PERCENT,
    STRIPE_ACH_FEE_FLAT_CENTS: process.env.STRIPE_ACH_FEE_FLAT_CENTS,
    STRIPE_ACH_FEE_CAP_CENTS: process.env.STRIPE_ACH_FEE_CAP_CENTS,
    STRIPE_PASS_ACH_FEE: process.env.STRIPE_PASS_ACH_FEE,
  };
}

function parseBps(value: string | undefined, fallback: number): number | null {
  if (value == null || value.trim() === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed >= 1) return null;
  return Math.round(parsed * 10000);
}

function parseCents(value: string | undefined, fallback: number): number | null {
  if (value == null || value.trim() === '') return fallback;
  if (!/^\d+$/.test(value.trim())) return null;
  const parsed = Number(value.trim());
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 1_000_000) return null;
  return parsed;
}

/** Unset keeps the published cap. A blank value means there is no cap. Invalid text is undefined. */
function parseCap(value: string | undefined, fallback: number): number | null | undefined {
  if (value == null) return fallback;
  if (value.trim() === '') return null;
  if (!/^\d+$/.test(value.trim())) return undefined;
  const parsed = Number(value.trim());
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 1_000_000) return undefined;
  return parsed;
}

function parseFlag(value: string | undefined, fallback: boolean): boolean | null {
  if (value == null || value.trim() === '') return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
  if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
  return null;
}

/** What Stripe would take on a charge of `totalCents`, in cents, half-up. */
export function stripeFeeOnTotal(totalCents: number, rule: Pick<FeeRule, 'bps' | 'flatCents' | 'capCents'>): number {
  let fee = Math.round((totalCents * rule.bps) / 10000) + rule.flatCents;
  if (rule.capCents != null) fee = Math.min(fee, rule.capCents);
  return Math.max(0, fee);
}

/**
 * Fee added as its own Checkout line so the amount that lands is the obligation.
 * The percent is applied to the whole charge, including the fee line, then capped.
 */
export function processingFeeCents(amountCents: number, rule: FeeRule): number {
  if (!rule.passThrough) return 0;
  if (!Number.isInteger(amountCents) || amountCents < 0) {
    throw new Error('Amount must be a whole number of cents.');
  }
  if (!Number.isInteger(rule.bps) || rule.bps < 0 || rule.bps >= 10000) {
    throw new Error('The fee percent is not valid.');
  }
  if (rule.bps === 0) {
    return rule.capCents == null ? rule.flatCents : Math.min(rule.flatCents, rule.capCents);
  }
  const onObligation = Math.round((amountCents * rule.bps) / 10000) + rule.flatCents;
  if (rule.capCents != null && onObligation >= rule.capCents) return rule.capCents;

  let fee = 0;
  for (let guard = 0; guard < 20; guard += 1) {
    const stripe = stripeFeeOnTotal(amountCents + fee, rule);
    if (fee >= stripe) return fee;
    fee = stripe;
  }
  throw new Error('The processing fee could not be calculated.');
}

export function readFeeSettings(env?: FeeEnv): FeeSettings | { error: string } {
  const source = feeEnv(env);
  const cardBps = parseBps(source.STRIPE_CARD_FEE_PERCENT, STRIPE_PUBLISHED_CARD_BPS);
  const cardFlat = parseCents(source.STRIPE_CARD_FEE_FLAT_CENTS, STRIPE_PUBLISHED_CARD_FLAT_CENTS);
  const cardPass = parseFlag(source.STRIPE_PASS_CARD_FEE, true);
  const achBps = parseBps(source.STRIPE_ACH_FEE_PERCENT, STRIPE_PUBLISHED_ACH_BPS);
  const achFlat = parseCents(source.STRIPE_ACH_FEE_FLAT_CENTS, 0);
  const achCap = parseCap(source.STRIPE_ACH_FEE_CAP_CENTS, STRIPE_PUBLISHED_ACH_CAP_CENTS);
  const achPass = parseFlag(source.STRIPE_PASS_ACH_FEE, false);
  if (cardBps == null || cardFlat == null || cardPass == null || achBps == null || achFlat == null || achPass == null || achCap === undefined) {
    return { error: 'The Stripe fee settings are not valid numbers.' };
  }
  return {
    card: { bps: cardBps, flatCents: cardFlat, capCents: null, passThrough: cardPass },
    ach: { bps: achBps, flatCents: achFlat, capCents: achCap, passThrough: achPass },
  };
}
