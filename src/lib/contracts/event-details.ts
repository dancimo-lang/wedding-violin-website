import type { PackageId } from './packages';
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
  otherDetails?: string;
  /** Full wedding only. Saved on the agreement. The template has no line for it yet. */
  receptionEnd?: string;
};

type DetailKey = CoupleDetailKey | 'receptionEnd';

const LABELS: Record<DetailKey, string> = {
  venueName: 'Venue name',
  venueAddress: 'Venue address',
  ceremonyStart: 'Ceremony start time',
  ceremonyEnd: 'Ceremony end time',
  preludeStart: 'Prelude music start time',
  cocktailStart: 'Cocktail hour start time',
  cocktailEnd: 'Cocktail hour end time',
  otherDetails: 'Other agreed performance details',
  receptionEnd: 'Reception end time',
};

const EVENT_LABELS: Partial<Record<DetailKey, string>> = {
  ceremonyStart: 'Event start time',
  ceremonyEnd: 'Event end time',
};

/**
 * Details that block sending. The client cannot fill these in.
 * Wedding music is packages A–D. Cocktail times are required on every one of
 * those packages, including ceremony-only A and C, because they share this agreement.
 * Full wedding also requires reception end. Private events require the start only.
 */
const REQUIRED_KEYS: Record<'wedding-music' | 'FULL' | 'EVENT', readonly DetailKey[]> = {
  'wedding-music': ['venueName', 'venueAddress', 'ceremonyStart', 'ceremonyEnd', 'cocktailStart', 'cocktailEnd'],
  FULL: ['venueName', 'venueAddress', 'ceremonyStart', 'ceremonyEnd', 'cocktailStart', 'cocktailEnd', 'receptionEnd'],
  EVENT: ['venueName', 'venueAddress', 'ceremonyStart'],
};

/** Optional lines that already appear in the agreement. A blank one stays blank. */
const OPTIONAL_KEYS: Record<'wedding-music' | 'FULL' | 'EVENT', readonly DetailKey[]> = {
  'wedding-music': ['preludeStart'],
  FULL: [],
  EVENT: ['ceremonyEnd'],
};

function groupOf(packageId: PackageId): 'wedding-music' | 'FULL' | 'EVENT' {
  if (packageId === 'FULL') return 'FULL';
  if (packageId === 'EVENT') return 'EVENT';
  return 'wedding-music';
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

/**
 * Blocks sending. Empty when every required detail for this agreement is filled in.
 * The client cannot supply these, so a blank would stay blank.
 */
export function missingCoupleDetailMessage(source: CoupleDetailSource): string {
  const labels = missingLabels(source, REQUIRED_KEYS[groupOf(source.packageId)]);
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
  const labels = missingLabels(source, REQUIRED_KEYS[groupOf(source.packageId)]);
  if (labels.length === 0) return '';
  const list = formatList(labels);
  if (labels.length === 1) {
    return `${list} was still blank when this agreement was sent. The client can still sign.`;
  }
  return `These details were still blank when this agreement was sent: ${list}. The client can still sign.`;
}

/** Optional lines that will stay blank. Does not block sending. */
export function optionalBlankDetailMessage(source: CoupleDetailSource): string {
  const labels = missingLabels(source, OPTIONAL_KEYS[groupOf(source.packageId)]);
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
