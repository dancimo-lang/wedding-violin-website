import { fullWeddingTemplate } from '@/data/contracts/full-wedding';
import { privateEventTemplate } from '@/data/contracts/private-event';
import { weddingMusicTemplate } from '@/data/contracts/wedding-music';
import { BUSINESS_TIME_ZONE, todayInTimeZone } from '@/lib/schedule/time';
import { formatLongDate, formatMoney, type FeeSummary } from './money';
import { DUO_DJ_OVERTIME, packageDefinition, weddingMusicOvertimeClause, type ContractTemplateId, type PackageId } from './packages';

export const BLANK = '__________________________________';

/** Event details the couple may fill when the admin left them blank. Rendering ignores this list. */
export const COUPLE_DETAIL_KEYS = [
  'venueName',
  'venueAddress',
  'ceremonyStart',
  'ceremonyEnd',
  'preludeStart',
  'cocktailStart',
  'cocktailEnd',
  'otherDetails',
] as const;

export type CoupleDetailKey = (typeof COUPLE_DETAIL_KEYS)[number];

const PHOTO_SENTENCE = 'The Client opts out of promotional use of photographs and video clips from the event.';

export type StoredRenderFields = {
  templateId: ContractTemplateId;
  packageId: PackageId;
  /**
   * Absent on agreements created before package-specific text.
   * Those keep the master checklist so a later signature still matches the stored text.
   * Edition 2 prints only the chosen wedding-music package, with no package checkboxes.
   * Edition 3 also states the selected package ("The Client has selected the following package:")
   * and prints each signer's own signing date.
   */
  renderEdition?: 2 | 3;
  client1Name: string;
  client2Name: string;
  weddingDateIso: string;
  venueName: string;
  venueAddress: string;
  ceremonyStart: string;
  ceremonyEnd: string;
  cocktailStart: string;
  cocktailEnd: string;
  preludeStart: string;
  otherDetails: string;
  packageFeeCents: number;
  travelFeeCents: number;
  additionalFeesCents: number;
  discountCents: number;
  /** Optional short plain-text note shown after Additional Agreed Fees when that fee is above zero. */
  additionalFeesDescription?: string;
  totalCents: number;
  retainerCents: number;
  balanceCents: number;
  finalPaymentDueDate: string;
  /**
   * Keys the couple filled in at signing. Absent when they added nothing.
   * Older agreements omit it, and the rendered text does not read it.
   */
  coupleSupplied?: CoupleDetailKey[];
  /** Private event agreements: the kind of event, e.g. "Birthday party". */
  eventType?: string;
  /** Private event agreements: the services the admin described. */
  performanceDescription?: string;
  /** Signing date each client typed or picked (YYYY-MM-DD). Set at signing. */
  client1SignedOnIso?: string;
  client2SignedOnIso?: string;
};

export type SignatureOverlay = {
  client1SignedName: string;
  client2SignedName: string;
  signedOn: string;
  photoOptOut: boolean;
  musicianSignedName: string;
  musicianSignedOn: string;
  /** Each client's own signing date. Falls back to signedOn when absent. */
  client1SignedOn?: string;
  client2SignedOn?: string;
  /**
   * Signing page only: replaces whole placeholder values (e.g. CLIENT_1_SIGNATURE)
   * with markers that the page draws as inputs. Never used for stored text.
   */
  display?: Partial<Record<string, string>>;
};

export function signatureDateLabel(now = new Date()): string {
  return formatLongDate(todayInTimeZone(BUSINESS_TIME_ZONE, now));
}

export const UNSIGNED: SignatureOverlay = {
  client1SignedName: '',
  client2SignedName: '',
  signedOn: '',
  photoOptOut: false,
  musicianSignedName: '',
  musicianSignedOn: '',
};

const TEMPLATES: Record<ContractTemplateId, string> = {
  'wedding-music': weddingMusicTemplate,
  'full-wedding': fullWeddingTemplate,
  'private-event': privateEventTemplate,
};

export function templateSource(templateId: ContractTemplateId): string {
  return TEMPLATES[templateId];
}

export function placeholdersIn(template: string): string[] {
  return [...template.matchAll(/\{\{([A-Z0-9_]+)\}\}/g)].map((match) => match[1] ?? '');
}

function filled(value: string | undefined | null): string {
  const trimmed = (value ?? '').trim();
  return trimmed ? trimmed : BLANK;
}

function mark(selected: boolean): string {
  return selected ? '☑' : '☐';
}

export function formatClock(value: string | null | undefined): string {
  if (!value) return '';
  const match = /^(\d{2}):(\d{2})/.exec(value.trim());
  if (!match) return '';
  const hour = Number(match[1]);
  const minute = match[2];
  if (hour > 23 || Number(minute) > 59) return '';
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${minute} ${suffix}`;
}

function clockMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

/**
 * A message when an entered end is earlier than its start. A blank side is not a range.
 * The closing sentence stays the send wording unless the caller is the signing page.
 */
export function performanceTimeOrderMessage(
  input: {
    ceremonyStart: string;
    ceremonyEnd: string;
    cocktailStart: string;
    cocktailEnd: string;
  },
  closing = 'Fix the times before sending this agreement.',
): string {
  const lines: string[] = [];
  const ceremonyStart = clockMinutes(input.ceremonyStart);
  const ceremonyEnd = clockMinutes(input.ceremonyEnd);
  const cocktailStart = clockMinutes(input.cocktailStart);
  const cocktailEnd = clockMinutes(input.cocktailEnd);
  if (ceremonyStart != null && ceremonyEnd != null && ceremonyEnd < ceremonyStart) {
    lines.push('Ceremony end is before ceremony start.');
  }
  if (cocktailStart != null && cocktailEnd != null && cocktailEnd < cocktailStart) {
    lines.push('Cocktail hour end is before cocktail hour start.');
  }
  if (lines.length === 0) return '';
  return `${lines.join(' ')} ${closing}`;
}

function eventTime(start: string, end: string): string {
  const startText = formatClock(start) || start.trim();
  const endText = formatClock(end) || end.trim();
  if (startText && endText) return `${startText} to ${endText}`;
  return startText || endText;
}

function clientLine(first: string, second: string): string {
  const left = first.trim();
  const right = second.trim();
  if (left && right) return `${left} and ${right}`;
  return left || right;
}

function photoLine(optOut: boolean): string {
  return `${mark(optOut)} ${PHOTO_SENTENCE}`;
}

const WEDDING_PACKAGE_IDS = ['A', 'B', 'C', 'D'] as const;

const PACKAGE_PLUS_LEAD: Partial<Record<PackageId, string>> = {
  B: 'Includes everything in Package A, plus:\n',
  D: 'Includes everything in Package C, plus:\n',
};

const PACKAGE_BASE: Partial<Record<PackageId, 'A' | 'C'>> = {
  B: 'A',
  D: 'C',
};

function weddingPackageBlocks(): Record<(typeof WEDDING_PACKAGE_IDS)[number], string> {
  const markers = WEDDING_PACKAGE_IDS.map((id) => `{{PACKAGE_${id}_MARK}} `);
  const starts = markers.map((marker) => weddingMusicTemplate.indexOf(marker));
  const selectedAt = weddingMusicTemplate.indexOf('Selected Package:');
  if (starts.some((index) => index < 0) || selectedAt < 0) {
    throw new Error('Wedding music agreement is missing a package option.');
  }
  const boundaries = [...starts, selectedAt];
  for (let i = 1; i < boundaries.length; i += 1) {
    if (boundaries[i] <= boundaries[i - 1]) throw new Error('Wedding music agreement is missing a package option.');
  }
  const blocks = {} as Record<(typeof WEDDING_PACKAGE_IDS)[number], string>;
  WEDDING_PACKAGE_IDS.forEach((id, index) => {
    const checkbox = markers[index];
    const block = weddingMusicTemplate.slice(boundaries[index], boundaries[index + 1]);
    if (!checkbox || !block.startsWith(checkbox)) throw new Error('Wedding music agreement is missing a package option.');
    blocks[id] = block.slice(checkbox.length);
  });
  return blocks;
}

/**
 * One package, with no checkbox. Packages B and D keep their own title and price,
 * then the base package's existing "Includes:" list, then their own added lines.
 * The "everything in Package …, plus" sentence is omitted because those lines are printed.
 */
function weddingMusicTemplateForPackage(packageId: PackageId): string {
  if (packageId === 'FULL' || packageId === 'EVENT') throw new Error('That package does not use this agreement.');
  const blocks = weddingPackageBlocks();
  const selectedAt = weddingMusicTemplate.indexOf('Selected Package:');
  const head = weddingMusicTemplate.slice(0, weddingMusicTemplate.indexOf('{{PACKAGE_A_MARK}} '));
  const baseId = PACKAGE_BASE[packageId];
  let description = blocks[packageId];
  if (baseId) {
    const titleBreak = description.indexOf('\n');
    const plusLead = PACKAGE_PLUS_LEAD[packageId];
    const baseBreak = blocks[baseId].indexOf('\n');
    const baseList = blocks[baseId].slice(baseBreak + 1);
    const added = description.slice(titleBreak + 1);
    if (titleBreak < 0 || !plusLead || !added.startsWith(plusLead) || !baseList.startsWith('Includes:\n')) {
      throw new Error('Wedding music agreement is missing a package option.');
    }
    description = description.slice(0, titleBreak + 1) + baseList + added.slice(plusLead.length);
  }
  return head + description + weddingMusicTemplate.slice(selectedAt);
}

const PACKAGE_CHOICE_SENTENCE =
  'The Client shall select one of the following packages. The selected package determines the services provided under this Agreement.\n';
/** DRAFT wording requested by the owner (Oct 30, 2026). */
const PACKAGE_SELECTED_SENTENCE = 'The Client has selected the following package:\n';

function statedPackageTemplate(packageId: PackageId): string {
  const template = weddingMusicTemplateForPackage(packageId);
  if (!template.includes(PACKAGE_CHOICE_SENTENCE)) throw new Error('Wedding music agreement is missing the package sentence.');
  return template.replace(PACKAGE_CHOICE_SENTENCE, PACKAGE_SELECTED_SENTENCE);
}

/** Slot marker drawn as an input on the signing page. */
export function slotMarker(name: string): string {
  return `\u27e6${name}\u27e7`;
}

export const SLOT_PATTERN = /\u27e6([A-Za-z0-9_:]+)\u27e7/g;

function fillTemplate(template: string, values: Record<string, string>): string {
  const missing: string[] = [];
  const filledText = template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (token, key: string) => {
    if (!Object.prototype.hasOwnProperty.call(values, key)) {
      missing.push(key);
      return token;
    }
    const value = values[key] ?? '';
    if (value.includes('{{')) {
      missing.push(key);
      return token;
    }
    return value;
  });
  if (missing.length > 0) {
    throw new Error(`Missing contract placeholders: ${missing.join(', ')}`);
  }
  if (/\{\{[A-Z0-9_]+\}\}/.test(filledText)) {
    throw new Error('Contract text still has placeholders.');
  }
  return filledText;
}

export function renderContract(fields: StoredRenderFields, signature: SignatureOverlay = UNSIGNED): string {
  const definition = packageDefinition(fields.packageId);
  if (definition.templateId !== fields.templateId) {
    throw new Error('That package does not use this agreement.');
  }
  const ceremony = formatClock(fields.ceremonyStart) || filled(fields.ceremonyStart);
  const cocktailStart = formatClock(fields.cocktailStart) || filled(fields.cocktailStart);
  const cocktailEnd = formatClock(fields.cocktailEnd) || filled(fields.cocktailEnd);
  const prelude = formatClock(fields.preludeStart) || filled(fields.preludeStart);
  const client1 = signature.client1SignedName.trim();
  const client2 = signature.client2SignedName.trim();
  const signedOn = signature.signedOn.trim();
  const client1On = (signature.client1SignedOn ?? '').trim() || signedOn;
  const client2On = (signature.client2SignedOn ?? '').trim() || signedOn;
  const musician = signature.musicianSignedName.trim();
  const musicianOn = signature.musicianSignedOn.trim();
  const display = signature.display ?? {};
  const shown = (values: Record<string, string>): Record<string, string> => {
    const next = { ...values };
    for (const [key, value] of Object.entries(display)) {
      if (typeof value === 'string' && Object.prototype.hasOwnProperty.call(next, key)) next[key] = value;
    }
    return next;
  };
  const moneyLines = {
    TRAVEL_FEE: formatMoney(fields.travelFeeCents),
    ADDITIONAL_FEES: `${formatMoney(fields.additionalFeesCents)}${additionalFeesNote(fields)}`,
    DISCOUNT: formatMoney(fields.discountCents),
    TOTAL: formatMoney(fields.totalCents),
    RETAINER: formatMoney(fields.retainerCents),
    BALANCE: formatMoney(fields.balanceCents),
    FINAL_DUE_DATE: filled(formatLongDate(fields.finalPaymentDueDate)),
  };
  const clientSignatures = {
    CLIENT_1_PRINTED_NAME: filled(client1),
    CLIENT_1_SIGNATURE: filled(client1),
    CLIENT_1_DATE: client1 ? filled(client1On) : BLANK,
    CLIENT_2_PRINTED_NAME: filled(client2),
    CLIENT_2_SIGNATURE: filled(client2),
    CLIENT_2_DATE: client2 ? filled(client2On) : BLANK,
    MUSICIAN_SIGNATURE: filled(musician),
    MUSICIAN_DATE: filled(musicianOn),
  };

  if (fields.templateId === 'private-event') {
    return fillTemplate(privateEventTemplate, shown({
      CLIENT_NAMES: filled(clientLine(fields.client1Name, fields.client2Name)),
      EVENT_TYPE: filled(fields.eventType),
      EVENT_DATE: filled(formatLongDate(fields.weddingDateIso)),
      VENUE_NAME: filled(fields.venueName),
      VENUE_ADDRESS: filled(fields.venueAddress),
      EVENT_START: ceremony,
      EVENT_END: formatClock(fields.ceremonyEnd) || filled(fields.ceremonyEnd),
      PERFORMANCE_DESCRIPTION: filled(fields.performanceDescription),
      PERFORMANCE_FEE: formatMoney(fields.packageFeeCents),
      ...moneyLines,
      OTHER_DETAILS: filled(fields.otherDetails),
      PHOTO_OPT_OUT_MARK: mark(signature.photoOptOut),
      ...clientSignatures,
    }));
  }

  if (fields.templateId === 'wedding-music') {
    const packageSpecific = fields.renderEdition === 2 || fields.renderEdition === 3;
    const template =
      fields.renderEdition === 3
        ? statedPackageTemplate(fields.packageId)
        : packageSpecific
          ? weddingMusicTemplateForPackage(fields.packageId)
          : weddingMusicTemplate;
    return fillTemplate(template, shown({
      CLIENT_NAMES: filled(clientLine(fields.client1Name, fields.client2Name)),
      WEDDING_DATE: filled(formatLongDate(fields.weddingDateIso)),
      VENUE_NAME: filled(fields.venueName),
      VENUE_ADDRESS: filled(fields.venueAddress),
      CEREMONY_START: ceremony,
      COCKTAIL_START: cocktailStart,
      COCKTAIL_END: cocktailEnd,
      ...(packageSpecific
        ? {}
        : {
            PACKAGE_A_MARK: mark(fields.packageId === 'A'),
            PACKAGE_B_MARK: mark(fields.packageId === 'B'),
            PACKAGE_C_MARK: mark(fields.packageId === 'C'),
            PACKAGE_D_MARK: mark(fields.packageId === 'D'),
          }),
      SELECTED_PACKAGE: definition.title,
      PACKAGE_FEE: formatMoney(fields.packageFeeCents),
      TRAVEL_FEE: formatMoney(fields.travelFeeCents),
      ADDITIONAL_FEES: `${formatMoney(fields.additionalFeesCents)}${additionalFeesNote(fields)}`,
      DISCOUNT: formatMoney(fields.discountCents),
      TOTAL: formatMoney(fields.totalCents),
      RETAINER: formatMoney(fields.retainerCents),
      BALANCE: formatMoney(fields.balanceCents),
      FINAL_DUE_DATE: filled(formatLongDate(fields.finalPaymentDueDate)),
      PRELUDE_BEGINS: prelude,
      OTHER_DETAILS: filled(fields.otherDetails),
      PHOTO_OPT_OUT_MARK: mark(signature.photoOptOut),
      CLIENT_1_PRINTED_NAME: filled(client1),
      CLIENT_1_SIGNATURE: filled(client1),
      CLIENT_1_DATE: filled(client1On),
      CLIENT_2_PRINTED_NAME: filled(client2),
      CLIENT_2_SIGNATURE: filled(client2),
      CLIENT_2_DATE: client2 ? filled(client2On) : BLANK,
      MUSICIAN_SIGNATURE: filled(musician),
      MUSICIAN_DATE: filled(musicianOn),
      // Agreements saved before this choice keep the duo and DJ sentence, so their hash still matches.
      OVERTIME_CLAUSE: packageSpecific ? weddingMusicOvertimeClause(fields.packageId) : DUO_DJ_OVERTIME,
    }));
  }

  const body = fullWeddingFees(fillTemplate(fullWeddingTemplate, shown({
    CLIENT_1_NAME: filled(fields.client1Name),
    CLIENT_2_NAME: filled(fields.client2Name),
    EVENT_DATE: filled(formatLongDate(fields.weddingDateIso)),
    VENUE: filled(fields.venueName),
    LOCATION: filled(fields.venueAddress),
    EVENT_TIME: filled(eventTime(fields.ceremonyStart, fields.ceremonyEnd)),
    CLIENT_PRINTED_NAME: filled(client1),
    CLIENT_SIGNATURE: filled(client1),
    CLIENT_DATE: client1 ? filled(client1On) : BLANK,
    MUSICIAN_SIGNATURE: filled(musician),
    MUSICIAN_DATE: filled(musicianOn),
  })), fields);

  // Section 11 already allows a written opt-out. The sentence is the one the
  // owner approved on the master agreement, so the checkbox is inside the
  // signed text. The paragraphs of this agreement are otherwise unchanged.
  const photo = display.PHOTO_OPT_OUT_MARK ? `${display.PHOTO_OPT_OUT_MARK} ${PHOTO_SENTENCE}` : photoLine(signature.photoOptOut);
  const notice = `\n${photo}\n`;
  const marker = '\n12. Entire Agreement\n';
  if (!body.includes(marker)) throw new Error('Full wedding agreement is missing section 12.');
  return body.replace(marker, `${notice}${marker}`);
}

export const ADDITIONAL_FEES_DESCRIPTION_MAX = 80;

/** Trimmed, single-line, at most 80 characters. */
export function cleanAdditionalFeesDescription(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, ADDITIONAL_FEES_DESCRIPTION_MAX).trim();
}

function additionalFeesNote(fields: StoredRenderFields): string {
  const description = cleanAdditionalFeesDescription(fields.additionalFeesDescription);
  return description && fields.additionalFeesCents > 0 ? ` (${description})` : '';
}

const FULL_FEE_ORIGINAL = 'The total fee for all services described in this Agreement is:\n$3,000.00\n';
const FULL_TRAVEL_ORIGINAL =
  'No additional travel fees shall apply unless the event location, schedule, or scope of services changes significantly after execution of this Agreement.\n';
const FULL_TRAVEL_REPLACEMENT =
  "Weddings outside the Musician's usual service area may require a travel fee to account for mileage, travel time, lodging, parking, tolls, or other necessary travel expenses. Any travel fee or additional fee is listed above and has been agreed upon in writing before this Agreement is finalized. No other travel fees shall apply unless the event location, schedule, or scope of services changes significantly after execution of this Agreement.\n";
const FULL_PAYMENT_ORIGINAL =
  'A non-refundable retainer of $1,500.00 is required to reserve the event date.\nThe remaining balance of $1,500.00 is due no later than 30 days prior to the wedding date.\n';

/**
 * Owner-approved wording for a full wedding agreement with a travel or additional fee.
 * With both fees at zero the text is returned unchanged, byte for byte.
 */
function fullWeddingFees(body: string, fields: StoredRenderFields): string {
  if (!(fields.travelFeeCents > 0) && !(fields.additionalFeesCents > 0)) return body;
  for (const part of [FULL_FEE_ORIGINAL, FULL_TRAVEL_ORIGINAL, FULL_PAYMENT_ORIGINAL]) {
    if (!body.includes(part)) throw new Error('Full wedding agreement fee wording changed.');
  }
  const fees =
    `Package Fee: $${formatMoney(fields.packageFeeCents)}\n` +
    `Travel Fee: $${formatMoney(fields.travelFeeCents)}\n` +
    `Additional Agreed Fees: $${formatMoney(fields.additionalFeesCents)}${additionalFeesNote(fields)}\n` +
    `Total Contract Price: $${formatMoney(fields.totalCents)}\n`;
  const payment =
    `A non-refundable retainer of $${formatMoney(fields.retainerCents)} (50% of the Total Contract Price) is required to reserve the event date.\n` +
    `The remaining balance of $${formatMoney(fields.balanceCents)} (50% of the Total Contract Price) is due no later than 30 days prior to the wedding date.\n`;
  return body.replace(FULL_FEE_ORIGINAL, fees).replace(FULL_TRAVEL_ORIGINAL, FULL_TRAVEL_REPLACEMENT).replace(FULL_PAYMENT_ORIGINAL, payment);
}

export function feeSnapshot(summary: FeeSummary, fields: Omit<StoredRenderFields, keyof FeeSummary | 'templateId' | 'packageId'> & { templateId?: never }): StoredRenderFields {
  const definition = packageDefinition(summary.packageId);
  const description = cleanAdditionalFeesDescription(fields.additionalFeesDescription);
  return {
    ...(description && summary.additionalFeesCents > 0 ? { additionalFeesDescription: description } : {}),
    ...(definition.templateId === 'private-event'
      ? { eventType: fields.eventType ?? '', performanceDescription: fields.performanceDescription ?? '' }
      : {}),
    templateId: definition.templateId,
    packageId: summary.packageId,
    renderEdition: 3,
    client1Name: fields.client1Name,
    client2Name: fields.client2Name,
    weddingDateIso: fields.weddingDateIso,
    venueName: fields.venueName,
    venueAddress: fields.venueAddress,
    ceremonyStart: fields.ceremonyStart,
    ceremonyEnd: fields.ceremonyEnd,
    cocktailStart: fields.cocktailStart,
    cocktailEnd: fields.cocktailEnd,
    preludeStart: fields.preludeStart,
    otherDetails: fields.otherDetails,
    packageFeeCents: summary.packageFeeCents,
    travelFeeCents: summary.travelFeeCents,
    additionalFeesCents: summary.additionalFeesCents,
    discountCents: summary.discountCents,
    totalCents: summary.totalCents,
    retainerCents: summary.retainerCents,
    balanceCents: summary.balanceCents,
    finalPaymentDueDate: summary.finalPaymentDueDate,
  };
}

export function normalizeStoredFields(value: unknown): StoredRenderFields | null {
  if (!isStoredRenderFields(value)) return null;
  const row = value as StoredRenderFields;
  const normalized: StoredRenderFields = {
    ...row,
    renderEdition: row.renderEdition === 2 || row.renderEdition === 3 ? row.renderEdition : undefined,
    client1Name: row.client1Name ?? '',
    client2Name: row.client2Name ?? '',
    venueName: row.venueName ?? '',
    venueAddress: row.venueAddress ?? '',
    ceremonyStart: row.ceremonyStart ?? '',
    ceremonyEnd: row.ceremonyEnd ?? '',
    cocktailStart: row.cocktailStart ?? '',
    cocktailEnd: row.cocktailEnd ?? '',
    preludeStart: row.preludeStart ?? '',
    otherDetails: row.otherDetails ?? '',
    finalPaymentDueDate: row.finalPaymentDueDate ?? '',
  };
  const supplied = readCoupleSupplied(row.coupleSupplied, normalized);
  if (supplied) normalized.coupleSupplied = supplied;
  else delete normalized.coupleSupplied;
  return normalized;
}

function readCoupleSupplied(value: unknown, fields: StoredRenderFields): CoupleDetailKey[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const supplied = COUPLE_DETAIL_KEYS.filter((key) => value.includes(key) && fields[key].trim());
  return supplied.length > 0 ? supplied : undefined;
}

export function isStoredRenderFields(value: unknown): value is StoredRenderFields {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<StoredRenderFields>;
  return (
    (row.templateId === 'wedding-music' || row.templateId === 'full-wedding' || row.templateId === 'private-event') &&
    (row.packageId === 'A' ||
      row.packageId === 'B' ||
      row.packageId === 'C' ||
      row.packageId === 'D' ||
      row.packageId === 'FULL' ||
      row.packageId === 'EVENT') &&
    typeof row.client1Name === 'string' &&
    typeof row.weddingDateIso === 'string' &&
    typeof row.totalCents === 'number' &&
    typeof row.retainerCents === 'number' &&
    typeof row.balanceCents === 'number'
  );
}
