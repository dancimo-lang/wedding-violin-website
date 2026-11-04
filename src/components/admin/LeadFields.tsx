import { AgreementFields, FieldLabel, FormSection } from '@/components/admin/AgreementFields';
import { AGREEMENT_FIELD_IDS, applyFormValue, formValueFromDraft } from '@/lib/contracts/agreement-details';
import {
  CONTRACT_STATUSES,
  fieldClass,
  HOW_FOUND_OPTIONS,
  INQUIRY_SOURCES,
  LEAD_STATUSES,
  PAYMENT_STATUSES,
  type LeadDraft,
} from '@/lib/leads';

const inputClass = `${fieldClass} mt-1 font-normal`;

export function LeadFields({
  draft,
  onChange,
  leadId,
  bookingId,
}: {
  draft: LeadDraft;
  onChange: (next: LeadDraft) => void;
  leadId?: string | null;
  bookingId?: string | null;
}) {
  const set = <K extends keyof LeadDraft>(key: K, value: LeadDraft[K]) => onChange({ ...draft, [key]: value });

  return (
    <div className="space-y-4">
      <AgreementFields
        value={formValueFromDraft(draft)}
        onChange={(next) => onChange(applyFormValue(draft, next))}
        leadId={leadId}
        bookingId={bookingId}
        afterPackage={
          <FormSection title="Client">
            <div className="grid gap-4 md:grid-cols-2">
              <FieldLabel label="Client 1" required>
                <input
                  id={AGREEMENT_FIELD_IDS.client1}
                  className={inputClass}
                  maxLength={200}
                  value={draft.clientName}
                  onChange={(event) => set('clientName', event.target.value)}
                />
              </FieldLabel>
              <FieldLabel label="Client 2, if any">
                <input
                  id={AGREEMENT_FIELD_IDS.client2}
                  className={inputClass}
                  maxLength={200}
                  value={draft.partnerName}
                  onChange={(event) => set('partnerName', event.target.value)}
                />
              </FieldLabel>
              <FieldLabel label="Email" required>
                <input
                  id={AGREEMENT_FIELD_IDS.email}
                  type="email"
                  className={inputClass}
                  value={draft.clientEmail}
                  onChange={(event) => set('clientEmail', event.target.value)}
                />
              </FieldLabel>
              <FieldLabel label="Phone">
                <input className={inputClass} value={draft.clientPhone} onChange={(event) => set('clientPhone', event.target.value)} />
              </FieldLabel>
            </div>
          </FormSection>
        }
      />
      <FormSection title="Follow-up">
        <div className="grid gap-4 md:grid-cols-2">
          <FieldLabel label="How this lead was received" required>
            <select className={inputClass} value={draft.inquirySource} onChange={(event) => set('inquirySource', event.target.value)}>
              {INQUIRY_SOURCES.map((source) => (
                <option key={source.value} value={source.value}>{source.label}</option>
              ))}
            </select>
          </FieldLabel>
          <FieldLabel label="Lead status" required>
            <select className={inputClass} value={draft.status} onChange={(event) => set('status', event.target.value)}>
              {LEAD_STATUSES.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </FieldLabel>
          <FieldLabel label="Musicians needed">
            <input
              type="number"
              min={1}
              max={12}
              className={inputClass}
              value={draft.performersNeeded}
              onChange={(event) => set('performersNeeded', event.target.value)}
            />
          </FieldLabel>
          <FieldLabel label="Estimated duration (hours)">
            <input
              className={inputClass}
              value={draft.estimatedDuration}
              placeholder="Filled from the ceremony times if left blank"
              onChange={(event) => set('estimatedDuration', event.target.value)}
            />
          </FieldLabel>
          <FieldLabel label="Guest count">
            <input className={inputClass} value={draft.guestCount} onChange={(event) => set('guestCount', event.target.value)} />
          </FieldLabel>
          <FieldLabel label="Budget">
            <input className={inputClass} value={draft.budget} placeholder="Optional" onChange={(event) => set('budget', event.target.value)} />
          </FieldLabel>
          <FieldLabel label="How they found Daniel">
            <input className={inputClass} list="how-found" value={draft.howFound} onChange={(event) => set('howFound', event.target.value)} />
            <datalist id="how-found">
              {HOW_FOUND_OPTIONS.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </FieldLabel>
          <FieldLabel label="Quoted price">
            <input className={inputClass} value={draft.quotedPrice} placeholder="Optional" onChange={(event) => set('quotedPrice', event.target.value)} />
          </FieldLabel>
          <FieldLabel label="Next follow-up">
            <input type="date" className={inputClass} value={draft.nextFollowUp} onChange={(event) => set('nextFollowUp', event.target.value)} />
          </FieldLabel>
          <FieldLabel label="Contract status">
            <select className={inputClass} value={draft.contractStatus} onChange={(event) => set('contractStatus', event.target.value)}>
              {CONTRACT_STATUSES.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </FieldLabel>
          <FieldLabel label="Payment status">
            <select className={inputClass} value={draft.paymentStatus} onChange={(event) => set('paymentStatus', event.target.value)}>
              {PAYMENT_STATUSES.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </FieldLabel>
          <div className="md:col-span-2">
            <FieldLabel label="Requested services">
              <textarea
                className={inputClass}
                rows={2}
                value={draft.requestedServices}
                placeholder="Ceremony violin, cocktail hour, reception"
                onChange={(event) => set('requestedServices', event.target.value)}
              />
            </FieldLabel>
          </div>
          <div className="md:col-span-2">
            <FieldLabel label="Inquiry notes">
              <textarea className={inputClass} rows={4} value={draft.message} onChange={(event) => set('message', event.target.value)} />
            </FieldLabel>
          </div>
        </div>
      </FormSection>
    </div>
  );
}

export function SubmittedDetails({ details }: { details: unknown }) {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return null;
  const entries = Object.entries(details as Record<string, unknown>).filter(([key, value]) => {
    if (key === 'agreement') return false;
    return (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') && value !== '';
  });
  if (entries.length === 0) return null;
  return (
    <div className="bg-white rounded-xl shadow p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-3">Original submitted details</h3>
      <dl className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {entries.map(([key, value]) => (
          <div key={key}>
            <dt className="text-xs uppercase tracking-wide text-gray-500">{key.replace(/([A-Z])/g, ' $1')}</dt>
            <dd className="text-sm text-gray-900 whitespace-pre-wrap">{String(value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
