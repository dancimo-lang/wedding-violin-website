import { packageIncludesCocktailHour, type PackageId } from './packages';
import { formatClock, type CoupleDetailKey, type StoredRenderFields } from './render';

/** Owner-entered details the send form knows about, including ones with no contract line yet. */
export type CoupleDetailSource = {
  packageId: PackageId;
  venueName: string;
  venueAddress: string;
  ceremonyStart: string;
  cocktailStart?: string;
  cocktailEnd?: string;
  ceremonyEnd?: string;
  preludeStart?: string;
  preludeEnd?: string;
  otherDetails?: string;
  receptionStart?: string;
  receptionEnd?: string;
};

export type DetailKey = CoupleDetailKey | 'preludeEnd' | 'receptionStart' | 'receptionEnd';

const LABELS: Record<DetailKey, string> = {
  venueName: 'Venue name',
  venueAddress: 'Venue address',
  ceremonyStart: 'Ceremony start time',
  ceremonyEnd: 'Ceremony end time',
  preludeStart: 'Prelude music start time',
  preludeEnd: 'Prelude end time',
  cocktailStart: 'Cocktail hour start time',
  cocktailEnd: 'Cocktail hour end time',
  otherDetails: 'Other agreed performance details',
  receptionStart: 'Reception start time',
  receptionEnd: 'Reception end time',
};

const EVENT_LABELS: Partial<Record<DetailKey, string>> = {
  ceremonyStart: 'Event start time',
  ceremonyEnd: 'Event end time',
};

const SHARED_REQUIRED: readonly DetailKey[] = ['venueName', 'venueAddress', 'ceremonyStart', 'ceremonyEnd'];
const COCKTAIL_REQUIRED: readonly DetailKey[] = ['cocktailStart', 'cocktailEnd'];
const RECEPTION_REQUIRED: readonly DetailKey[] = ['receptionStart', 'receptionEnd'];

/** Details that block sending. Prelude never blocks. Ceremony-only packages do not require cocktail times. */
function requiredKeys(packageId: PackageId): readonly DetailKey[] {
  if (packageId === 'EVENT') return ['venueName', 'venueAddress', 'ceremonyStart'];
  if (packageId === 'FULL') return [...SHARED_REQUIRED, ...COCKTAIL_REQUIRED, ...RECEPTION_REQUIRED];
  if (packageIncludesCocktailHour(packageId)) return [...SHARED_REQUIRED, ...COCKTAIL_REQUIRED];
  return SHARED_REQUIRED;
}

/** Optional lines. A blank prelude is left off the wedding-music schedule. Private-event end stays a blank line. */
function optionalKeys(packageId: PackageId): readonly DetailKey[] {
  if (packageId === 'EVENT') return ['ceremonyEnd'];
  return [];
}

function labelFor(packageId: PackageId, key: DetailKey): string {
  if (packageId === 'EVENT' && EVENT_LABELS[key]) return EVENT_LABELS[key] as string;
  return LABELS[key];
}

function readDetail(source: CoupleDetailSource, key: DetailKey): string {
  return (source[key] ?? '').trim();
}

function formatList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function missingLabels(source: CoupleDetailSource, keys: readonly DetailKey[]): string[] {
  return keys.filter((key) => !readDetail(source, key)).map((key) => labelFor(source.packageId, key));
}

/** Required details that are still blank, with the same labels the send error uses. */
export function missingRequiredDetails(source: CoupleDetailSource): { key: DetailKey; label: string }[] {
  return requiredKeys(source.packageId)
    .filter((key) => !readDetail(source, key))
    .map((key) => ({ key, label: labelFor(source.packageId, key) }));
}

/**
 * Blocks sending. Empty when every required detail for this agreement is filled in.
 * The client cannot supply these, so a blank would stay blank.
 */
export function missingCoupleDetailMessage(source: CoupleDetailSource): string {
  const labels = missingLabels(source, requiredKeys(source.packageId));
  if (labels.length === 0) return '';
  const list = formatList(labels);
  if (labels.length === 1) {
    return `${list} is still blank. Enter it before sending. The client cannot add it when signing.`;
  }
  return `These details are still blank: ${list}. Enter them before sending. The client cannot add them when signing.`;
}

/**
 * Already-sent agreements. Blank required details do not stop the client from signing.
 */
export function sentContractBlankDetailMessage(source: CoupleDetailSource): string {
  const labels = missingLabels(source, requiredKeys(source.packageId));
  if (labels.length === 0) return '';
  const list = formatList(labels);
  if (labels.length === 1) {
    return `${list} was still blank when this agreement was sent. The client can still sign.`;
  }
  return `These details were still blank when this agreement was sent: ${list}. The client can still sign.`;
}

/** Optional lines that will stay blank. Does not block sending. */
export function optionalBlankDetailMessage(source: CoupleDetailSource): string {
  const labels = missingLabels(source, optionalKeys(source.packageId));
  if (labels.length === 0) return '';
  const list = formatList(labels);
  if (labels.length === 1) {
    return `${list} is blank. That optional line will stay blank on the agreement.`;
  }
  return `These optional lines are blank and will stay blank on the agreement: ${list}.`;
}

/**
 * The client cannot submit event details. Missing or empty input is allowed,
 * so an agreement that was sent with blanks can still be signed.
 */
export function clientEventDetailsError(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return 'Event details cannot be changed when signing.';
  }
  if (Object.keys(raw as object).length > 0) {
    return 'Event details cannot be changed when signing.';
  }
  return null;
}

/** One sentence for an older signed agreement where the couple had supplied details. */
export function coupleSuppliedSummary(fields: StoredRenderFields | null): string {
  if (!fields?.coupleSupplied?.length) return '';
  const parts = fields.coupleSupplied.map((key) => {
    const raw = (fields[key] ?? '').trim();
    const shown = key === 'venueName' || key === 'venueAddress' || key === 'otherDetails' ? raw : formatClock(raw) || raw;
    return `${LABELS[key]}: ${shown}`;
  });
  return `The couple added ${parts.join('; ')}.`;
}
