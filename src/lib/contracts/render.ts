import { fullWeddingTemplate } from '@/data/contracts/full-wedding';
import { weddingMusicTemplate } from '@/data/contracts/wedding-music';
import { BUSINESS_TIME_ZONE, todayInTimeZone } from '@/lib/schedule/time';
import { formatLongDate, formatMoney, type FeeSummary } from './money';
import { packageDefinition, type ContractTemplateId, type PackageId } from './packages';

export const BLANK = '__________________________________';

const PHOTO_SENTENCE = 'The Client opts out of promotional use of photographs and video clips from the event.';

export type StoredRenderFields = {
  templateId: ContractTemplateId;
  packageId: PackageId;
  /**
   * Absent on agreements created before package-specific text.
   * Those keep the master checklist so a later signature still matches the stored text.
   * Edition 2 prints only the chosen wedding-music package, with no package checkboxes.
   */
  renderEdition?: 2;
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
  totalCents: number;
  retainerCents: number;
  balanceCents: number;
  finalPaymentDueDate: string;
};

export type SignatureOverlay = {
  client1SignedName: string;
  client2SignedName: string;
  signedOn: string;
  photoOptOut: boolean;
  musicianSignedName: string;
  musicianSignedOn: string;
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

/** A message when an entered end is earlier than its start. A blank side is not a range. */
export function performanceTimeOrderMessage(input: {
  ceremonyStart: string;
  ceremonyEnd: string;
  cocktailStart: string;
  cocktailEnd: string;
}): string {
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
  return `${lines.join(' ')} Fix the times before sending this agreement.`;
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

/** Drop the other package options and the checkbox in front of the chosen one. The words stay as written. */
function weddingMusicTemplateForPackage(packageId: PackageId): string {
  if (packageId === 'FULL') throw new Error('That package does not use this agreement.');
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
  const index = WEDDING_PACKAGE_IDS.indexOf(packageId);
  const checkbox = markers[index];
  const block = weddingMusicTemplate.slice(boundaries[index], boundaries[index + 1]);
  if (!checkbox || !block.startsWith(checkbox)) throw new Error('Wedding music agreement is missing a package option.');
  return weddingMusicTemplate.slice(0, starts[0]) + block.slice(checkbox.length) + weddingMusicTemplate.slice(selectedAt);
}

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
  const musician = signature.musicianSignedName.trim();
  const musicianOn = signature.musicianSignedOn.trim();

  if (fields.templateId === 'wedding-music') {
    const packageSpecific = fields.renderEdition === 2;
    return fillTemplate(packageSpecific ? weddingMusicTemplateForPackage(fields.packageId) : weddingMusicTemplate, {
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
      ADDITIONAL_FEES: formatMoney(fields.additionalFeesCents),
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
      CLIENT_1_DATE: filled(signedOn),
      CLIENT_2_PRINTED_NAME: filled(client2),
      CLIENT_2_SIGNATURE: filled(client2),
      CLIENT_2_DATE: client2 ? filled(signedOn) : BLANK,
      MUSICIAN_SIGNATURE: filled(musician),
      MUSICIAN_DATE: filled(musicianOn),
    });
  }

  const body = fillTemplate(fullWeddingTemplate, {
    CLIENT_1_NAME: filled(fields.client1Name),
    CLIENT_2_NAME: filled(fields.client2Name),
    EVENT_DATE: filled(formatLongDate(fields.weddingDateIso)),
    VENUE: filled(fields.venueName),
    LOCATION: filled(fields.venueAddress),
    EVENT_TIME: filled(eventTime(fields.ceremonyStart, fields.ceremonyEnd)),
    CLIENT_PRINTED_NAME: filled(client1),
    CLIENT_SIGNATURE: filled(client1),
    CLIENT_DATE: filled(signedOn),
    MUSICIAN_SIGNATURE: filled(musician),
    MUSICIAN_DATE: filled(musicianOn),
  });

  // Section 11 already allows a written opt-out. The sentence is the one the
  // owner approved on the master agreement, so the checkbox is inside the
  // signed text. The paragraphs of this agreement are otherwise unchanged.
  const notice = `\n${photoLine(signature.photoOptOut)}\n`;
  const marker = '\n12. Entire Agreement\n';
  if (!body.includes(marker)) throw new Error('Full wedding agreement is missing section 12.');
  return body.replace(marker, `${notice}${marker}`);
}

export function feeSnapshot(summary: FeeSummary, fields: Omit<StoredRenderFields, keyof FeeSummary | 'templateId' | 'packageId'> & { templateId?: never }): StoredRenderFields {
  const definition = packageDefinition(summary.packageId);
  return {
    templateId: definition.templateId,
    packageId: summary.packageId,
    renderEdition: 2,
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
  return {
    ...row,
    renderEdition: row.renderEdition === 2 ? 2 : undefined,
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
}

export function isStoredRenderFields(value: unknown): value is StoredRenderFields {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<StoredRenderFields>;
  return (
    (row.templateId === 'wedding-music' || row.templateId === 'full-wedding') &&
    (row.packageId === 'A' || row.packageId === 'B' || row.packageId === 'C' || row.packageId === 'D' || row.packageId === 'FULL') &&
    typeof row.client1Name === 'string' &&
    typeof row.weddingDateIso === 'string' &&
    typeof row.totalCents === 'number' &&
    typeof row.retainerCents === 'number' &&
    typeof row.balanceCents === 'number'
  );
}
