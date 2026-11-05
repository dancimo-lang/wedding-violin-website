import { missingRequiredDetails, type CoupleDetailSource, type DetailKey } from './event-details';
import { computeFees } from './money';
import { guessPackageId, isPackageId, type PackageId } from './packages';
import { performanceTimeOrderMessage } from './render';

/**
 * Extra agreement fields that have no lead or booking column.
 * Ceremony start and end stay in performance_start_time / performance_end_time.
 * Venue, date, and client names stay in their existing columns.
 * This object is merged into leads.inquiry_details.agreement.
 * A booking with no lead stores the same object in a private note instead.
 * Nothing here is copied onto a sent or signed contract.
 */
export type AgreementDetails = {
  packageId: PackageId | '';
  ceremonyStart: string;
  ceremonyEnd: string;
  preludeStart: string;
  preludeEnd: string;
  cocktailStart: string;
  cocktailEnd: string;
  receptionStart: string;
  receptionEnd: string;
  otherDetails: string;
  travelFee: string;
  additionalFees: string;
  additionalFeesDescription: string;
  discount: string;
  eventType: string;
  performanceDescription: string;
  performanceFee: string;
};

export type AgreementFormValue = AgreementDetails & {
  packageId: PackageId;
  eventDate: string;
  ceremonyStart: string;
  ceremonyEnd: string;
  venueName: string;
  venueAddress: string;
};

export const AGREEMENT_FIELD_IDS = {
  package: 'field-package',
  client1: 'field-client-1',
  client2: 'field-client-2',
  email: 'field-client-email',
  eventDate: 'field-event-date',
  preludeStart: 'field-prelude-start',
  preludeEnd: 'field-prelude-end',
  ceremonyStart: 'field-ceremony-start',
  ceremonyEnd: 'field-ceremony-end',
  cocktailStart: 'field-cocktail-start',
  cocktailEnd: 'field-cocktail-end',
  receptionStart: 'field-reception-start',
  receptionEnd: 'field-reception-end',
  venueName: 'field-venue-name',
  venueAddress: 'field-venue-address',
  otherDetails: 'field-other-details',
  travelFee: 'field-travel-fee',
  additionalFees: 'field-additional-fees',
  additionalFeesDescription: 'field-additional-fees-description',
  discount: 'field-discount',
  eventType: 'field-event-type',
  performanceFee: 'field-performance-fee',
  performanceDescription: 'field-performance-description',
  record: 'record-details',
} as const;

const DETAIL_FIELD_IDS: Record<DetailKey, string> = {
  venueName: AGREEMENT_FIELD_IDS.venueName,
  venueAddress: AGREEMENT_FIELD_IDS.venueAddress,
  ceremonyStart: AGREEMENT_FIELD_IDS.ceremonyStart,
  ceremonyEnd: AGREEMENT_FIELD_IDS.ceremonyEnd,
  preludeStart: AGREEMENT_FIELD_IDS.preludeStart,
  preludeEnd: AGREEMENT_FIELD_IDS.preludeEnd,
  cocktailStart: AGREEMENT_FIELD_IDS.cocktailStart,
  cocktailEnd: AGREEMENT_FIELD_IDS.cocktailEnd,
  otherDetails: AGREEMENT_FIELD_IDS.otherDetails,
  receptionStart: AGREEMENT_FIELD_IDS.receptionStart,
  receptionEnd: AGREEMENT_FIELD_IDS.receptionEnd,
};

const FEE_CAP_CENTS = 10_000_000;

export function emptyAgreement(): AgreementDetails {
  return {
    packageId: '',
    ceremonyStart: '',
    ceremonyEnd: '',
    preludeStart: '',
    preludeEnd: '',
    cocktailStart: '',
    cocktailEnd: '',
    receptionStart: '',
    receptionEnd: '',
    otherDetails: '',
    travelFee: '0',
    additionalFees: '0',
    additionalFeesDescription: '',
    discount: '0',
    eventType: '',
    performanceDescription: '',
    performanceFee: '',
  };
}

function clip(value: unknown, max: number) {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return String(value)
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function clock(value: unknown) {
  const text = clip(value, 8);
  const match = text.match(/^(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : '';
}

export function normalizeAgreement(raw: unknown): AgreementDetails {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const packageId = typeof source.packageId === 'string' && isPackageId(source.packageId) ? source.packageId : '';
  return {
    packageId,
    ceremonyStart: clock(source.ceremonyStart),
    ceremonyEnd: clock(source.ceremonyEnd),
    preludeStart: clock(source.preludeStart),
    preludeEnd: clock(source.preludeEnd),
    cocktailStart: clock(source.cocktailStart),
    cocktailEnd: clock(source.cocktailEnd),
    receptionStart: clock(source.receptionStart),
    receptionEnd: clock(source.receptionEnd),
    otherDetails: clip(source.otherDetails, 400),
    travelFee: clip(source.travelFee, 12) || '0',
    additionalFees: clip(source.additionalFees, 12) || '0',
    additionalFeesDescription: clip(source.additionalFeesDescription, 80),
    discount: clip(source.discount, 12) || '0',
    eventType: clip(source.eventType, 120),
    performanceDescription: clip(source.performanceDescription, 600),
    performanceFee: clip(source.performanceFee, 12),
  };
}

export function readAgreement(inquiryDetails: unknown): AgreementDetails {
  if (!inquiryDetails || typeof inquiryDetails !== 'object' || Array.isArray(inquiryDetails)) return emptyAgreement();
  return normalizeAgreement((inquiryDetails as Record<string, unknown>).agreement);
}

/** Keeps every other inquiry_details key and replaces only the agreement object. */
export function mergeAgreement(inquiryDetails: unknown, details: AgreementDetails): Record<string, unknown> {
  const base =
    inquiryDetails && typeof inquiryDetails === 'object' && !Array.isArray(inquiryDetails)
      ? { ...(inquiryDetails as Record<string, unknown>) }
      : {};
  base.agreement = normalizeAgreement(details);
  return base;
}

export function agreementNote(details: AgreementDetails): string {
  return JSON.stringify({ kind: 'agreement-details', agreement: normalizeAgreement(details) });
}

export function readAgreementNote(content: string | null | undefined): AgreementDetails | null {
  if (!content || !content.includes('"agreement-details"')) return null;
  try {
    const parsed = JSON.parse(content) as { kind?: unknown; agreement?: unknown };
    if (parsed.kind !== 'agreement-details') return null;
    return normalizeAgreement(parsed.agreement);
  } catch {
    return null;
  }
}

type ColumnRecord = {
  eventDate: string;
  venueName: string;
  venueAddress: string;
  performanceStart: string;
  performanceEnd: string;
  agreement: AgreementDetails;
};

export function formValueFromDraft(draft: ColumnRecord): AgreementFormValue {
  const packageId = isPackageId(draft.agreement.packageId) ? draft.agreement.packageId : 'A';
  return {
    ...draft.agreement,
    packageId,
    eventDate: draft.eventDate,
    ceremonyStart: draft.agreement.ceremonyStart || draft.performanceStart,
    ceremonyEnd: draft.agreement.ceremonyEnd || draft.performanceEnd,
    venueName: draft.venueName,
    venueAddress: draft.venueAddress,
  };
}

export function applyFormValue<T extends ColumnRecord>(draft: T, value: AgreementFormValue): T {
  return {
    ...draft,
    eventDate: value.eventDate,
    venueName: value.venueName,
    venueAddress: value.venueAddress,
    performanceStart: value.ceremonyStart,
    performanceEnd: value.ceremonyEnd,
    agreement: {
      packageId: value.packageId,
      ceremonyStart: value.ceremonyStart,
      ceremonyEnd: value.ceremonyEnd,
      preludeStart: value.preludeStart,
      preludeEnd: value.preludeEnd,
      cocktailStart: value.cocktailStart,
      cocktailEnd: value.cocktailEnd,
      receptionStart: value.receptionStart,
      receptionEnd: value.receptionEnd,
      otherDetails: value.otherDetails,
      travelFee: value.travelFee,
      additionalFees: value.additionalFees,
      additionalFeesDescription: value.additionalFeesDescription,
      discount: value.discount,
      eventType: value.eventType,
      performanceDescription: value.performanceDescription,
      performanceFee: value.performanceFee,
    },
  };
}

function clockMinutes(value: string) {
  const match = value.trim().match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function clockFromMinutes(total: number) {
  const minutes = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** Prelude begins 30 minutes before the ceremony and ends when the ceremony starts. */
export function preludeFromCeremony(ceremonyStart: string): { preludeStart: string; preludeEnd: string } | null {
  const minutes = clockMinutes(ceremonyStart);
  if (minutes == null) return null;
  return { preludeStart: clockFromMinutes(minutes - 30), preludeEnd: ceremonyStart.trim().slice(0, 5) };
}

/**
 * New prelude times when the ceremony start changes.
 * Empty fields, and fields that still match the previous automatic times, follow the ceremony.
 * Hand-typed times are left alone. Null means do not change the prelude.
 */
export function preludeAfterCeremonyChange(
  current: { ceremonyStart: string; preludeStart: string; preludeEnd: string },
  nextCeremonyStart: string,
): { preludeStart: string; preludeEnd: string } | null {
  const start = current.preludeStart.trim();
  const end = current.preludeEnd.trim();
  const previous = preludeFromCeremony(current.ceremonyStart);
  const empty = !start && !end;
  const stillAuto = Boolean(previous && start === previous.preludeStart && end === previous.preludeEnd);
  if (!empty && !stillAuto) return null;
  return preludeFromCeremony(nextCeremonyStart) ?? { preludeStart: '', preludeEnd: '' };
}

function earliestClock(values: string[]) {
  let best = '';
  let bestMinutes = Number.POSITIVE_INFINITY;
  for (const value of values) {
    const minutes = clockMinutes(value);
    if (minutes == null || minutes >= bestMinutes) continue;
    bestMinutes = minutes;
    best = value.trim().slice(0, 5);
  }
  return best;
}

function latestClock(values: string[]) {
  let best = '';
  let bestMinutes = -1;
  for (const value of values) {
    const minutes = clockMinutes(value);
    if (minutes == null || minutes <= bestMinutes) continue;
    bestMinutes = minutes;
    best = value.trim().slice(0, 5);
  }
  return best;
}

/**
 * Calendar block for this event. Ceremony start and end stay on the agreement.
 * The performance columns cover the whole time Daniel is playing, through cocktail or reception when those are later.
 */
export function calendarPerformanceTimes(value: AgreementFormValue): { start: string; end: string } {
  const privateEvent = value.packageId === 'EVENT';
  const receptionStart = value.packageId === 'FULL' && !value.receptionStart.trim() ? value.cocktailEnd : value.receptionStart;
  return {
    start: earliestClock([value.ceremonyStart, privateEvent ? '' : value.preludeStart]) || value.ceremonyStart.trim(),
    end:
      latestClock([
        value.ceremonyEnd,
        privateEvent ? '' : value.cocktailEnd,
        value.packageId === 'FULL' ? value.receptionEnd || receptionStart : '',
      ]) || value.ceremonyEnd.trim(),
  };
}

/** Full wedding reception begins at the cocktail-hour end until a different time is entered. */
export function agreementForStorage(value: AgreementFormValue): AgreementDetails {
  const receptionStart =
    value.packageId === 'FULL' && !value.receptionStart.trim() ? value.cocktailEnd.trim() : value.receptionStart.trim();
  return normalizeAgreement({ ...value, packageId: value.packageId, receptionStart });
}

export type SavedAgreement = {
  packageId: PackageId;
  client1Name: string;
  client2Name: string;
  email: string;
  weddingDate: string;
  leadEventDate: string;
  bookingEventDate: string;
  venueName: string;
  venueAddress: string;
  ceremonyStart: string;
  ceremonyEnd: string;
  preludeStart: string;
  preludeEnd: string;
  cocktailStart: string;
  cocktailEnd: string;
  receptionStart: string;
  receptionEnd: string;
  otherDetails: string;
  travelFee: string;
  additionalFees: string;
  additionalFeesDescription: string;
  discount: string;
  eventType: string;
  performanceDescription: string;
  performanceFee: string;
  quotedPrice: number | null;
  datesDiffer: boolean;
};

function cell(row: Record<string, unknown> | null, key: string) {
  const value = row?.[key];
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
}

function clockCell(row: Record<string, unknown> | null, key: string) {
  return clock(cell(row, key));
}

function money(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

export function dollarInputToCents(value: string): number | null {
  const trimmed = value.trim().replace(/[$,]/g, '');
  if (!trimmed) return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const [whole, frac = ''] = trimmed.split('.');
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'));
}

/**
 * Saved lead and booking columns, plus agreement extras.
 * Shared columns prefer the booking when both are filled, matching the previous contract form.
 */
export function buildSavedAgreement(input: {
  lead: Record<string, unknown> | null;
  booking: Record<string, unknown> | null;
  client: Record<string, unknown> | null;
  agreement: AgreementDetails;
}): SavedAgreement {
  const lead = input.lead;
  const booking = input.booking;
  const quotedPrice = money(lead?.quoted_price) ?? money(booking?.total_price);
  const storedPackage = isPackageId(input.agreement.packageId) ? input.agreement.packageId : '';
  const packageId =
    storedPackage ||
    guessPackageId({
      packageInterest: cell(lead, 'package_interest'),
      service: cell(booking, 'service_type') || cell(lead, 'requested_services') || cell(lead, 'service_type'),
      quotedPrice,
    });
  const privateEvent = packageId === 'EVENT';
  const fullWedding = packageId === 'FULL';
  const cocktailEnd = privateEvent ? '' : input.agreement.cocktailEnd;
  const receptionStart =
    fullWedding && !input.agreement.receptionStart.trim() ? cocktailEnd : fullWedding ? input.agreement.receptionStart : '';
  const leadEventDate = cell(lead, 'event_date');
  const bookingEventDate = cell(booking, 'event_date');
  return {
    packageId,
    client1Name: cell(input.client, 'name'),
    client2Name: cell(input.client, 'partner_name'),
    email: cell(input.client, 'email'),
    weddingDate: bookingEventDate || leadEventDate,
    leadEventDate,
    bookingEventDate,
    venueName: cell(booking, 'venue_name') || cell(lead, 'venue_name'),
    venueAddress: cell(booking, 'venue_address') || cell(lead, 'venue_address'),
    ceremonyStart: input.agreement.ceremonyStart || clockCell(booking, 'performance_start_time') || clockCell(lead, 'performance_start_time'),
    ceremonyEnd: input.agreement.ceremonyEnd || clockCell(booking, 'performance_end_time') || clockCell(lead, 'performance_end_time'),
    preludeStart: privateEvent ? '' : input.agreement.preludeStart,
    preludeEnd: privateEvent ? '' : input.agreement.preludeEnd,
    cocktailStart: privateEvent ? '' : input.agreement.cocktailStart,
    cocktailEnd,
    receptionStart,
    receptionEnd: fullWedding ? input.agreement.receptionEnd : '',
    otherDetails: input.agreement.otherDetails,
    travelFee: input.agreement.travelFee || '0',
    additionalFees: input.agreement.additionalFees || '0',
    additionalFeesDescription: input.agreement.additionalFeesDescription,
    discount: fullWedding ? '0' : input.agreement.discount || '0',
    eventType: privateEvent ? input.agreement.eventType : '',
    performanceDescription: privateEvent ? input.agreement.performanceDescription : '',
    performanceFee: privateEvent ? input.agreement.performanceFee : '',
    quotedPrice,
    datesDiffer: Boolean(lead && booking && leadEventDate !== bookingEventDate),
  };
}

export type AgreementGap = { id: string; label: string };

function feeGap(id: string, label: string, raw: string, requiredPositive = false): AgreementGap | null {
  const cents = dollarInputToCents(raw);
  if (cents == null) return { id, label: `${label} must be a dollar amount.` };
  if (cents > FEE_CAP_CENTS) return { id, label: `${label} must be $100,000 or less.` };
  if (requiredPositive && cents <= 0) return { id, label };
  return null;
}

function withReceptionDefault(saved: SavedAgreement): SavedAgreement {
  if (saved.packageId !== 'FULL' || saved.receptionStart.trim() || !saved.cocktailEnd.trim()) return saved;
  return { ...saved, receptionStart: saved.cocktailEnd.trim() };
}

/** Everything that still blocks Send for signature, each pointing at a details-form field. */
export function agreementGaps(input: SavedAgreement): AgreementGap[] {
  const saved = withReceptionDefault(input);
  const gaps: AgreementGap[] = [];
  const privateEvent = saved.packageId === 'EVENT';
  if (!saved.client1Name.trim()) gaps.push({ id: AGREEMENT_FIELD_IDS.client1, label: 'Client name' });
  const email = saved.email.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    gaps.push({ id: AGREEMENT_FIELD_IDS.email, label: 'Client email' });
  }
  if (!saved.weddingDate) {
    gaps.push({ id: AGREEMENT_FIELD_IDS.eventDate, label: privateEvent ? 'Event date' : 'Wedding date' });
  }
  if (saved.datesDiffer) {
    gaps.push({
      id: AGREEMENT_FIELD_IDS.eventDate,
      label: 'Lead and booking event dates differ. Save this form so they match.',
    });
  }
  const source: CoupleDetailSource = saved;
  for (const item of missingRequiredDetails(source)) {
    gaps.push({ id: DETAIL_FIELD_IDS[item.key], label: item.label });
  }
  if (privateEvent) {
    if (!saved.eventType.trim()) gaps.push({ id: AGREEMENT_FIELD_IDS.eventType, label: 'Event type' });
    if (!saved.performanceDescription.trim()) {
      gaps.push({ id: AGREEMENT_FIELD_IDS.performanceDescription, label: 'Performance description' });
    }
    const fee = feeGap(AGREEMENT_FIELD_IDS.performanceFee, 'Performance fee', saved.performanceFee, true);
    if (fee) gaps.push(fee);
  }
  const travel = feeGap(AGREEMENT_FIELD_IDS.travelFee, 'Travel fee', saved.travelFee);
  const additional = feeGap(AGREEMENT_FIELD_IDS.additionalFees, 'Additional fees', saved.additionalFees);
  const discount = saved.packageId === 'FULL' ? null : feeGap(AGREEMENT_FIELD_IDS.discount, 'Discount', saved.discount);
  for (const item of [travel, additional, discount]) {
    if (item) gaps.push(item);
  }
  if (saved.weddingDate && !gaps.some((gap) => gap.label.includes('dollar') || gap.label.includes('$100,000') || gap.label === 'Performance fee')) {
    const summary = computeFees({
      packageId: saved.packageId,
      travelFeeCents: dollarInputToCents(saved.travelFee) ?? 0,
      additionalFeesCents: dollarInputToCents(saved.additionalFees) ?? 0,
      discountCents: dollarInputToCents(saved.discount) ?? 0,
      weddingDateIso: saved.weddingDate,
      performanceFeeCents: privateEvent ? dollarInputToCents(saved.performanceFee) ?? 0 : undefined,
    });
    if ('error' in summary && !summary.error.toLowerCase().includes('date')) {
      gaps.push({
        id: privateEvent ? AGREEMENT_FIELD_IDS.performanceFee : AGREEMENT_FIELD_IDS.discount,
        label: summary.error,
      });
    }
  }
  return gaps;
}

export function agreementTimeOrder(input: SavedAgreement): string {
  const saved = withReceptionDefault(input);
  return performanceTimeOrderMessage({
    ceremonyStart: saved.ceremonyStart,
    ceremonyEnd: saved.ceremonyEnd,
    cocktailStart: saved.cocktailStart,
    cocktailEnd: saved.cocktailEnd,
    preludeStart: saved.preludeStart,
    preludeEnd: saved.preludeEnd,
    receptionStart: saved.receptionStart,
    receptionEnd: saved.receptionEnd,
  });
}

export function contractRequestBody(
  ids: { leadId: string | null; bookingId: string | null },
  input: SavedAgreement,
) {
  const saved = withReceptionDefault(input);
  const privateEvent = saved.packageId === 'EVENT';
  const fullWedding = saved.packageId === 'FULL';
  return {
    leadId: ids.leadId,
    bookingId: ids.bookingId,
    packageId: saved.packageId,
    travelFee: saved.travelFee,
    additionalFees: saved.additionalFees,
    additionalFeesDescription: saved.additionalFeesDescription.trim().slice(0, 80),
    discount: fullWedding ? '0' : saved.discount,
    client1Name: saved.client1Name,
    client2Name: saved.client2Name,
    weddingDate: saved.weddingDate,
    venueName: saved.venueName,
    venueAddress: saved.venueAddress,
    ceremonyStart: saved.ceremonyStart,
    ceremonyEnd: saved.ceremonyEnd,
    cocktailStart: privateEvent ? '' : saved.cocktailStart,
    cocktailEnd: privateEvent ? '' : saved.cocktailEnd,
    preludeStart: privateEvent ? '' : saved.preludeStart,
    preludeEnd: privateEvent ? '' : saved.preludeEnd,
    otherDetails: saved.otherDetails,
    receptionStart: fullWedding ? saved.receptionStart : '',
    receptionEnd: fullWedding ? saved.receptionEnd : '',
    ...(privateEvent
      ? {
          performanceFee: saved.performanceFee,
          eventType: saved.eventType.trim(),
          performanceDescription: saved.performanceDescription.trim(),
        }
      : {}),
  };
}
