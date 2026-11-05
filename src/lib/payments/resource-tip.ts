export const RESOURCE_TIP_PURPOSE = 'resource_tip';
export const RESOURCE_TIP_PRODUCT_NAME = 'Tip for free violin resources';
export const TIP_MIN_CENTS = 100;
export const TIP_MAX_CENTS = 20_000;
export const TIP_PRESET_CENTS = [300, 500, 1000] as const;
export const TIP_PROMPT_STORAGE_KEY = 'dc-free-resources-tip-until';
export const TIP_PROMPT_SUPPRESS_MS = 7 * 24 * 60 * 60 * 1000;
export const TIP_MODAL_HEADING = 'These resources are free';
export const TIP_MODAL_LINE = 'If they help your playing, a tip helps me make more.';
export const TIP_TEST_SITE_NOTE = 'This is a test site, so tips are turned off here.';
export const TIP_THANKS = 'Thank you. Your tip helps me make more free lessons.';
export const TIP_CANCELED = 'No charge was made. The sheet music is still free to download.';
export const SUPPORT_LINK_LABEL = 'Support these free lessons';

export function isResourceTipMetadata(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== 'object') return false;
  return (metadata as { purpose?: unknown }).purpose === RESOURCE_TIP_PURPOSE;
}

/** Production only. Preview uses the live Stripe secret, so checkout stays off there. */
export function resourceTipsCheckoutEnabled(vercelEnv: string | undefined): boolean {
  return vercelEnv?.trim() === 'production';
}

export function parseTipAmountCents(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null;
  if (value < TIP_MIN_CENTS || value > TIP_MAX_CENTS) return null;
  return value;
}

export function dollarsToCents(input: string): number | null {
  const trimmed = input.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const [whole, fraction = ''] = trimmed.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return parseTipAmountCents(cents);
}

export function safeTuneReturnPath(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (value.length > 120 || value !== value.trim()) return null;
  if (/[?#\\]/.test(value) || value.includes('//')) return null;
  if (value === '/services/lessons/resources') return value;
  if (/^\/services\/lessons\/resources\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) return value;
  return null;
}

export function tuneIdFromReturnPath(returnPath: string): string {
  if (returnPath === '/services/lessons/resources') return 'library';
  return returnPath.slice(returnPath.lastIndexOf('/') + 1);
}

export function tipReturnState(value: string | string[] | undefined): 'thanks' | 'canceled' | null {
  const tip = Array.isArray(value) ? value[0] : value;
  if (tip === 'thanks' || tip === 'canceled') return tip;
  return null;
}

export function tipPromptSuppressedUntil(stored: string | null, now: number): boolean {
  if (!stored) return false;
  const until = Number(stored);
  return Number.isFinite(until) && until > now;
}

export function nextTipPromptUntil(now: number): number {
  return now + TIP_PROMPT_SUPPRESS_MS;
}

type TipStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

export function readTipPromptSuppressed(storage: Pick<TipStorage, 'getItem'>, now = Date.now()): boolean {
  try {
    return tipPromptSuppressedUntil(storage.getItem(TIP_PROMPT_STORAGE_KEY), now);
  } catch {
    return false;
  }
}

export function writeTipPromptSuppressed(storage: Pick<TipStorage, 'setItem'>, now = Date.now()): void {
  storage.setItem(TIP_PROMPT_STORAGE_KEY, String(nextTipPromptUntil(now)));
}

export function resourceTipCheckoutFields(input: {
  amountCents: number;
  tuneId: string;
  successUrl: string;
  cancelUrl: string;
}): Record<string, string> {
  return {
    mode: 'payment',
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    client_reference_id: RESOURCE_TIP_PURPOSE,
    'metadata[purpose]': RESOURCE_TIP_PURPOSE,
    'metadata[tune_id]': input.tuneId,
    'payment_intent_data[metadata][purpose]': RESOURCE_TIP_PURPOSE,
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': String(input.amountCents),
    'line_items[0][price_data][product_data][name]': RESOURCE_TIP_PRODUCT_NAME,
    'allowed_payment_method_types[0]': 'card',
    'wallet_options[link][display]': 'never',
  };
}

export function resourceTipReturnUrls(origin: string, returnPath: string): { successUrl: string; cancelUrl: string } {
  const base = origin.replace(/\/$/, '');
  return {
    successUrl: `${base}${returnPath}?tip=thanks&session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${base}${returnPath}?tip=canceled`,
  };
}

export type ResourceTipResult = { status: number; body: Record<string, unknown> };

/**
 * Starts a one-time tip checkout, or refuses before `createCheckout` on any
 * non-production deployment. Callers must not record a booking or payment row.
 */
export async function beginResourceTip(input: {
  vercelEnv: string | undefined;
  body: unknown;
  origin: string;
  createCheckout: (
    fields: Record<string, string>,
    idempotencyKey: string,
  ) => Promise<{ url: string } | { error: string }>;
}): Promise<ResourceTipResult> {
  const parsed = parseResourceTipBody(input.body);
  if (!parsed.ok) return { status: 400, body: { error: parsed.error } };
  if (!resourceTipsCheckoutEnabled(input.vercelEnv)) {
    return { status: 200, body: { testSite: true, message: TIP_TEST_SITE_NOTE } };
  }
  const urls = resourceTipReturnUrls(input.origin, parsed.returnPath);
  const fields = resourceTipCheckoutFields({
    amountCents: parsed.amountCents,
    tuneId: parsed.tuneId,
    successUrl: urls.successUrl,
    cancelUrl: urls.cancelUrl,
  });
  const created = await input.createCheckout(fields, `resource_tip_${crypto.randomUUID()}`);
  if (!('url' in created) || !created.url.startsWith('https://')) {
    return {
      status: 502,
      body: { error: 'The tip page could not be opened. The music is still free to download.' },
    };
  }
  return { status: 200, body: { url: created.url } };
}

function parseResourceTipBody(
  body: unknown,
): { ok: true; amountCents: number; tuneId: string; returnPath: string } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Could not read that request.' };
  const record = body as Record<string, unknown>;
  const amountCents = parseTipAmountCents(record.amountCents);
  if (amountCents == null) return { ok: false, error: 'Enter an amount from $1 to $200.' };
  const returnPath = safeTuneReturnPath(record.returnPath);
  if (!returnPath) return { ok: false, error: 'That page cannot accept a tip.' };
  return { ok: true, amountCents, tuneId: tuneIdFromReturnPath(returnPath), returnPath };
}
