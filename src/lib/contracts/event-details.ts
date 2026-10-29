import { packageIncludesCocktailHour, type PackageId } from './packages';
import {
  formatClock,
  performanceTimeOrderMessage,
  type CoupleDetailKey,
  type StoredRenderFields,
} from './render';

const SIGNING_TIME_CLOSING = 'Fix the times before signing this agreement.';

export type CoupleDetailField = {
  key: CoupleDetailKey;
  label: string;
  kind: 'text' | 'time';
  max: number;
};

export type CoupleDetailSource = {
  packageId: PackageId;
  venueName: string;
  venueAddress: string;
  ceremonyStart: string;
  cocktailStart: string;
  cocktailEnd: string;
};

const DETAIL_SPECS: readonly CoupleDetailField[] = [
  { key: 'venueName', label: 'Venue name', kind: 'text', max: 255 },
  { key: 'venueAddress', label: 'Venue address', kind: 'text', max: 500 },
  { key: 'ceremonyStart', label: 'Ceremony start time', kind: 'time', max: 5 },
  { key: 'cocktailStart', label: 'Cocktail hour start time', kind: 'time', max: 5 },
  { key: 'cocktailEnd', label: 'Cocktail hour end time', kind: 'time', max: 5 },
];

const COCKTAIL_KEYS = new Set<CoupleDetailKey>(['cocktailStart', 'cocktailEnd']);

export type CoupleDetailResult =
  | { ok: true; fields: StoredRenderFields; supplied: CoupleDetailKey[] }
  | { ok: false; error: string };

export function emptyCoupleDetailDraft(): Record<CoupleDetailKey, string> {
  return {
    venueName: '',
    venueAddress: '',
    ceremonyStart: '',
    cocktailStart: '',
    cocktailEnd: '',
  };
}

function specFor(key: CoupleDetailKey): CoupleDetailField {
  const spec = DETAIL_SPECS.find((field) => field.key === key);
  if (!spec) throw new Error('Unknown event detail.');
  return spec;
}

function applies(field: CoupleDetailField, packageId: PackageId): boolean {
  if (!COCKTAIL_KEYS.has(field.key)) return true;
  return packageIncludesCocktailHour(packageId);
}

/** Blank details the couple must fill. Cocktail times apply only on packages B and D. */
export function coupleFillableDetails(source: CoupleDetailSource): CoupleDetailField[] {
  return DETAIL_SPECS.filter((field) => applies(field, source.packageId) && !source[field.key].trim());
}

function formatList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

/** Admin note. Empty when every couple-fillable detail already has a value. */
export function missingCoupleDetailMessage(source: CoupleDetailSource): string {
  const labels = coupleFillableDetails(source).map((field) => field.label);
  if (labels.length === 0) return '';
  const list = formatList(labels);
  if (labels.length === 1) {
    return `This event detail is still blank: ${list}. The couple will be asked to fill it in before signing.`;
  }
  return `These event details are still blank: ${list}. The couple will be asked to fill them in before signing.`;
}

function lowerLabel(label: string): string {
  return label.charAt(0).toLowerCase() + label.slice(1);
}

function isClock(value: string): boolean {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return false;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour <= 23 && minute <= 59;
}

function detailProblem(field: CoupleDetailField, value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return 'blank';
  if (field.kind === 'time') {
    if (!isClock(trimmed)) return `Enter a valid ${lowerLabel(field.label)}.`;
    return null;
  }
  if (trimmed.length > field.max) return `${field.label} is too long.`;
  if (/[\r\n]/.test(trimmed) || trimmed.includes('{{') || trimmed.includes('}}')) {
    return `Enter the ${lowerLabel(field.label)} on one line.`;
  }
  return null;
}

function timeMessageForSupplied(fields: StoredRenderFields, supplied: readonly CoupleDetailKey[]): string {
  const ceremonyTouched = supplied.includes('ceremonyStart');
  const cocktailTouched = supplied.includes('cocktailStart') || supplied.includes('cocktailEnd');
  return performanceTimeOrderMessage(
    {
      ceremonyStart: ceremonyTouched ? fields.ceremonyStart : '',
      ceremonyEnd: ceremonyTouched ? fields.ceremonyEnd : '',
      cocktailStart: cocktailTouched ? fields.cocktailStart : '',
      cocktailEnd: cocktailTouched ? fields.cocktailEnd : '',
    },
    SIGNING_TIME_CLOSING,
  );
}

/** Live contract preview. Invalid or non-blank-field edits are left out. */
export function previewCoupleEventDetails(
  stored: StoredRenderFields,
  draft: Partial<Record<CoupleDetailKey, string>>,
): StoredRenderFields {
  const next: StoredRenderFields = { ...stored };
  for (const field of coupleFillableDetails(stored)) {
    const value = (draft[field.key] ?? '').trim();
    if (!value || detailProblem(field, value)) continue;
    next[field.key] = value;
  }
  return next;
}

/** Shown while the couple is typing. Missing fields are not an error yet. */
export function coupleEventTimeMessage(
  stored: StoredRenderFields,
  draft: Partial<Record<CoupleDetailKey, string>>,
): string {
  const preview = previewCoupleEventDetails(stored, draft);
  const supplied = coupleFillableDetails(stored)
    .filter((field) => preview[field.key].trim() !== stored[field.key].trim())
    .map((field) => field.key);
  return timeMessageForSupplied(preview, supplied);
}

export function coupleDetailPayload(
  source: CoupleDetailSource,
  draft: Partial<Record<CoupleDetailKey, string>>,
): Record<string, string> {
  const payload: Record<string, string> = {};
  for (const field of coupleFillableDetails(source)) {
    payload[field.key] = draft[field.key] ?? '';
  }
  return payload;
}

/**
 * Accepts only details that are still blank on this agreement.
 * Prices, package, names, and anything the admin already filled are rejected.
 */
export function applyCoupleEventDetails(stored: StoredRenderFields, raw: unknown): CoupleDetailResult {
  if (raw == null) raw = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'Event details could not be read.' };
  }
  const input = raw as Record<string, unknown>;
  const fillable = coupleFillableDetails(stored);
  const fillableKeys = new Set(fillable.map((field) => field.key));
  for (const key of Object.keys(input)) {
    if (!fillableKeys.has(key as CoupleDetailKey)) {
      return { ok: false, error: 'Only blank event details can be filled in.' };
    }
  }

  const next: StoredRenderFields = { ...stored };
  delete next.coupleSupplied;
  const supplied: CoupleDetailKey[] = [];
  const missing: string[] = [];
  for (const field of fillable) {
    if (!Object.prototype.hasOwnProperty.call(input, field.key)) {
      missing.push(field.label);
      continue;
    }
    const value = input[field.key];
    if (typeof value !== 'string') {
      return { ok: false, error: `Enter the ${lowerLabel(field.label)} on one line.` };
    }
    const problem = detailProblem(field, value);
    if (problem === 'blank') {
      missing.push(field.label);
      continue;
    }
    if (problem) return { ok: false, error: problem };
    next[field.key] = value.trim();
    supplied.push(field.key);
  }
  if (missing.length === 1) {
    return { ok: false, error: `Fill in ${missing[0]} before signing.` };
  }
  if (missing.length > 1) {
    return { ok: false, error: `Fill in these event details before signing: ${formatList(missing)}.` };
  }

  const timeMessage = timeMessageForSupplied(next, supplied);
  if (timeMessage) return { ok: false, error: timeMessage };
  if (supplied.length > 0) next.coupleSupplied = supplied;
  return { ok: true, fields: next, supplied };
}

/** One sentence for the lead and booking when the couple supplied a cocktail time. */
export function coupleCocktailRecordLine(fields: StoredRenderFields, supplied: readonly CoupleDetailKey[]): string {
  if (!supplied.includes('cocktailStart') && !supplied.includes('cocktailEnd')) return '';
  const start = formatClock(fields.cocktailStart) || fields.cocktailStart.trim();
  const end = formatClock(fields.cocktailEnd) || fields.cocktailEnd.trim();
  if (start && end) return `Cocktail hour on the signed agreement: ${start} to ${end}.`;
  if (start) return `Cocktail hour on the signed agreement starts at ${start}.`;
  if (end) return `Cocktail hour on the signed agreement ends at ${end}.`;
  return '';
}

export function coupleSuppliedSummary(fields: StoredRenderFields | null): string {
  if (!fields?.coupleSupplied?.length) return '';
  const parts = fields.coupleSupplied.map((key) => {
    const spec = specFor(key);
    const raw = fields[key].trim();
    const shown = spec.kind === 'time' ? formatClock(raw) || raw : raw;
    return `${spec.label}: ${shown}`;
  });
  return `The couple added ${parts.join('; ')}.`;
}
