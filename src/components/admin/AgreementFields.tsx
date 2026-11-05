'use client';

import { useEffect, type ReactNode } from 'react';
import { CustomSongsFields } from '@/components/admin/CustomSongsFields';
import { VenueNameField } from '@/components/admin/VenueNameField';
import {
  AGREEMENT_FIELD_IDS,
  preludeAfterCeremonyChange,
  preludeFromCeremony,
  type AgreementFormValue,
} from '@/lib/contracts/agreement-details';
import { computeFees, formatMoney, type FeeSummary } from '@/lib/contracts/money';
import { packageIncludesCocktailHour, PACKAGES, type PackageId } from '@/lib/contracts/packages';
import { fieldClass } from '@/lib/leads';

const inputClass = `${fieldClass} mt-1 font-normal`;

export function AgreementFields({
  value,
  onChange,
  leadId,
  bookingId,
  afterPackage,
}: {
  value: AgreementFormValue;
  onChange: (next: AgreementFormValue) => void;
  leadId?: string | null;
  bookingId?: string | null;
  afterPackage?: ReactNode;
}) {
  const set = (patch: Partial<AgreementFormValue>) => onChange({ ...value, ...patch });
  const privateEvent = value.packageId === 'EVENT';
  const fullWedding = value.packageId === 'FULL';
  const cocktailRequired = fullWedding || packageIncludesCocktailHour(value.packageId);
  const receptionStartShown = fullWedding && !value.receptionStart.trim() ? value.cocktailEnd : value.receptionStart;
  const ceremonyStart = value.ceremonyStart;

  useEffect(() => {
    if (privateEvent || !ceremonyStart || value.preludeStart.trim() || value.preludeEnd.trim()) return;
    const auto = preludeFromCeremony(ceremonyStart);
    if (!auto) return;
    onChange({ ...value, ...auto });
    // Fill once when the ceremony start is set and the prelude is still blank.
    // Clearing the prelude must not run this again until the ceremony start changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ceremonyStart, privateEvent]);

  const setCeremonyStart = (nextCeremonyStart: string) => {
    const prelude = preludeAfterCeremonyChange(value, nextCeremonyStart);
    set({ ceremonyStart: nextCeremonyStart, ...(prelude ?? {}) });
  };
  const summary = computeFees({
    packageId: value.packageId,
    travelFeeCents: cents(value.travelFee),
    additionalFeesCents: cents(value.additionalFees),
    discountCents: cents(value.discount),
    weddingDateIso: value.eventDate,
    performanceFeeCents: privateEvent ? cents(value.performanceFee) : undefined,
  });

  return (
    <div className="space-y-4">
      <FormSection title="Package">
        <FieldLabel label="Contract type / package">
          <select
            id={AGREEMENT_FIELD_IDS.package}
            className={inputClass}
            value={value.packageId}
            onChange={(event) => set({ packageId: event.target.value as PackageId })}
          >
            {(Object.keys(PACKAGES) as PackageId[]).map((id) => (
              <option key={id} value={id}>
                {PACKAGES[id].customFee
                  ? `${PACKAGES[id].title} agreement (non-wedding) — fee entered below`
                  : `${PACKAGES[id].title} — $${formatMoney(PACKAGES[id].feeCents)}`}
              </option>
            ))}
          </select>
        </FieldLabel>
        {privateEvent ? (
          <p className="text-sm font-normal text-gray-700">
            Private event agreement for birthdays, parties, corporate and other non-wedding events.
          </p>
        ) : null}
      </FormSection>
      {afterPackage}
      <FormSection title="Date & Times">
        <FieldLabel label={privateEvent ? 'Event date' : 'Wedding date'} required>
          <input
            id={AGREEMENT_FIELD_IDS.eventDate}
            type="date"
            className={inputClass}
            value={value.eventDate}
            onChange={(event) => set({ eventDate: event.target.value })}
          />
        </FieldLabel>
        {privateEvent ? (
          <div className="grid gap-4 md:grid-cols-2">
            <TimeField id={AGREEMENT_FIELD_IDS.ceremonyStart} label="Event start" value={value.ceremonyStart} required onChange={(ceremonyStart) => set({ ceremonyStart })} />
            <TimeField id={AGREEMENT_FIELD_IDS.ceremonyEnd} label="Event end" value={value.ceremonyEnd} onChange={(ceremonyEnd) => set({ ceremonyEnd })} />
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <TimeField id={AGREEMENT_FIELD_IDS.preludeStart} label="Prelude begins" value={value.preludeStart} onChange={(preludeStart) => set({ preludeStart })} />
              <TimeField id={AGREEMENT_FIELD_IDS.preludeEnd} label="Prelude ends" value={value.preludeEnd} onChange={(preludeEnd) => set({ preludeEnd })} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <TimeField id={AGREEMENT_FIELD_IDS.ceremonyStart} label="Ceremony start" value={value.ceremonyStart} required onChange={setCeremonyStart} />
              <TimeField id={AGREEMENT_FIELD_IDS.ceremonyEnd} label="Ceremony end" value={value.ceremonyEnd} required onChange={(ceremonyEnd) => set({ ceremonyEnd })} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <TimeField
                id={AGREEMENT_FIELD_IDS.cocktailStart}
                label="Cocktail hour begins"
                value={value.cocktailStart}
                required={cocktailRequired}
                onChange={(cocktailStart) => set({ cocktailStart })}
              />
              <TimeField
                id={AGREEMENT_FIELD_IDS.cocktailEnd}
                label="Cocktail hour ends"
                value={value.cocktailEnd}
                required={cocktailRequired}
                onChange={(cocktailEnd) => set({ cocktailEnd })}
              />
            </div>
            {fullWedding ? (
              <div className="grid gap-4 md:grid-cols-2">
                <TimeField
                  id={AGREEMENT_FIELD_IDS.receptionStart}
                  label="Reception begins"
                  value={receptionStartShown}
                  required
                  onChange={(receptionStart) => set({ receptionStart })}
                />
                <TimeField
                  id={AGREEMENT_FIELD_IDS.receptionEnd}
                  label="Reception ends"
                  value={value.receptionEnd}
                  required
                  onChange={(receptionEnd) => set({ receptionEnd })}
                />
              </div>
            ) : (
              <p className="text-sm font-normal text-gray-700">
                Prelude fills in as the 30 minutes before the ceremony and can be changed or cleared. Cocktail hour is required for ceremony-and-cocktail packages. On a ceremony-only package it prints only when you enter those times.
              </p>
            )}
          </>
        )}
        {fullWedding ? (
          <p className="text-sm font-normal text-gray-700">
            Prelude fills in as the 30 minutes before the ceremony and can be changed or cleared. Reception begins starts as the cocktail-hour end and can be changed.
          </p>
        ) : null}
      </FormSection>
      <FormSection title="Venue" className="relative z-30">
        <VenueNameField
          name={value.venueName}
          address={value.venueAddress}
          onName={(venueName) => set({ venueName })}
          onAddress={(venueAddress) => set({ venueAddress })}
          nameInputId={AGREEMENT_FIELD_IDS.venueName}
          addressInputId={AGREEMENT_FIELD_IDS.venueAddress}
          nameRequired
          addressRequired
        />
      </FormSection>
      {privateEvent ? (
        <FormSection title="Performance">
          <div className="grid gap-4 md:grid-cols-2">
            <FieldLabel label="Event type (e.g. Birthday party)" required>
              <input
                id={AGREEMENT_FIELD_IDS.eventType}
                className={inputClass}
                maxLength={120}
                value={value.eventType}
                onChange={(event) => set({ eventType: event.target.value })}
              />
            </FieldLabel>
            <FieldLabel label="Performance fee" required>
              <input
                id={AGREEMENT_FIELD_IDS.performanceFee}
                className={inputClass}
                value={value.performanceFee}
                onChange={(event) => set({ performanceFee: event.target.value })}
              />
            </FieldLabel>
          </div>
          <FieldLabel label="Performance description (shown in section 1)" required>
            <input
              id={AGREEMENT_FIELD_IDS.performanceDescription}
              className={inputClass}
              maxLength={600}
              value={value.performanceDescription}
              placeholder="e.g. Solo violin, two hours of background music during dinner"
              onChange={(event) => set({ performanceDescription: event.target.value })}
            />
          </FieldLabel>
        </FormSection>
      ) : null}
      <FormSection title="Custom Songs">
        <CustomSongsFields leadId={leadId} bookingId={bookingId} />
      </FormSection>
      <FormSection title="Other Details">
        <FieldLabel label="Other agreed performance details">
          <input
            id={AGREEMENT_FIELD_IDS.otherDetails}
            className={inputClass}
            maxLength={400}
            value={value.otherDetails}
            onChange={(event) => set({ otherDetails: event.target.value })}
          />
        </FieldLabel>
      </FormSection>
      <FormSection title="Fees">
        <div className="grid gap-4 md:grid-cols-3">
          <FieldLabel label="Travel fee">
            <input id={AGREEMENT_FIELD_IDS.travelFee} className={inputClass} value={value.travelFee} onChange={(event) => set({ travelFee: event.target.value })} />
          </FieldLabel>
          <FieldLabel label="Additional fees">
            <input
              id={AGREEMENT_FIELD_IDS.additionalFees}
              className={inputClass}
              value={value.additionalFees}
              onChange={(event) => set({ additionalFees: event.target.value })}
            />
          </FieldLabel>
          <FieldLabel label="Discount">
            <input
              id={AGREEMENT_FIELD_IDS.discount}
              className={inputClass}
              value={value.discount}
              onChange={(event) => set({ discount: event.target.value })}
            />
          </FieldLabel>
        </div>
        <FieldLabel label="Additional fees description (optional, shown in the agreement)">
          <input
            id={AGREEMENT_FIELD_IDS.additionalFeesDescription}
            className={inputClass}
            maxLength={80}
            value={value.additionalFeesDescription}
            placeholder="e.g. New Year's Day holiday fee"
            onChange={(event) => set({ additionalFeesDescription: event.target.value })}
          />
        </FieldLabel>
        {fullWedding ? (
          <p className="text-sm font-normal text-gray-700">
            The package fee is $3,000.00. A travel fee or additional fees (for example a holiday fee) are added, and a discount is subtracted. The retainer and balance are each 50% of that total.
          </p>
        ) : null}
        <FeeReadout
          summary={'error' in summary ? null : summary}
          error={'error' in summary && !summary.error.toLowerCase().includes('date') ? summary.error : ''}
          packageFee={'error' in summary ? PACKAGES[value.packageId].feeCents : summary.packageFeeCents}
        />
      </FormSection>
    </div>
  );
}

function cents(value: string) {
  const trimmed = value.trim().replace(/[$,]/g, '');
  if (!trimmed) return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return -1;
  const [whole, frac = ''] = trimmed.split('.');
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'));
}

export function FormSection({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-gray-200 bg-gray-50 p-4 ${className}`}>
      <h4 className="border-b border-gray-200 pb-2 text-base font-semibold text-gray-900">{title}</h4>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export function FieldLabel({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm font-semibold text-gray-900">
      <span className="flex items-baseline justify-between gap-2">
        {label}
        {required ? <span className="text-xs font-semibold uppercase tracking-wide text-amber-800">Required</span> : null}
      </span>
      {children}
    </label>
  );
}

function TimeField({
  id,
  label,
  value,
  onChange,
  required = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <FieldLabel label={label} required={required}>
      <input id={id} type="time" className={inputClass} value={value} onChange={(event) => onChange(event.target.value)} />
    </FieldLabel>
  );
}

export function FeeReadout({
  summary,
  error,
  packageFee,
  quotedPrice = null,
}: {
  summary: FeeSummary | null;
  error: string;
  packageFee: number;
  quotedPrice?: number | null;
}) {
  if (!summary) return error ? <p className="text-sm text-red-700">{error}</p> : null;
  return (
    <div className="rounded-lg bg-white p-4 text-sm text-gray-800">
      <p>Package fee ${formatMoney(packageFee)}</p>
      <p>Total ${formatMoney(summary.totalCents)}</p>
      <p>Retainer (50%) ${formatMoney(summary.retainerCents)}</p>
      <p>Balance (50%) ${formatMoney(summary.balanceCents)}</p>
      <p>Final payment due {summary.finalPaymentDueDate}</p>
      {quotedPrice != null && Math.round(quotedPrice * 100) !== summary.totalCents ? (
        <p className="mt-2">The quote on this record is ${quotedPrice.toFixed(2)}. The agreement total is ${formatMoney(summary.totalCents)}.</p>
      ) : null}
    </div>
  );
}
