import {
  CONTRACT_STATUSES,
  fieldClass,
  HOW_FOUND_OPTIONS,
  INQUIRY_SOURCES,
  LEAD_STATUSES,
  PAYMENT_STATUSES,
  type LeadDraft,
} from '@/lib/leads';

export function LeadFields({
  draft,
  onChange,
}: {
  draft: LeadDraft;
  onChange: (next: LeadDraft) => void;
}) {
  const set = (key: keyof LeadDraft, value: string) => onChange({ ...draft, [key]: value });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <Field label="Client name *">
        <input className={fieldClass} value={draft.clientName} onChange={(event) => set('clientName', event.target.value)} />
      </Field>
      <Field label="Email">
        <input type="email" className={fieldClass} value={draft.clientEmail} onChange={(event) => set('clientEmail', event.target.value)} />
      </Field>
      <Field label="Phone">
        <input className={fieldClass} value={draft.clientPhone} onChange={(event) => set('clientPhone', event.target.value)} />
      </Field>
      <Field label="Partner's name">
        <input className={fieldClass} value={draft.partnerName} onChange={(event) => set('partnerName', event.target.value)} />
      </Field>
      <Field label="How this lead was received *">
        <select className={fieldClass} value={draft.inquirySource} onChange={(event) => set('inquirySource', event.target.value)}>
          {INQUIRY_SOURCES.map((source) => (
            <option key={source.value} value={source.value}>{source.label}</option>
          ))}
        </select>
      </Field>
      <Field label="Lead status *">
        <select className={fieldClass} value={draft.status} onChange={(event) => set('status', event.target.value)}>
          {LEAD_STATUSES.map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
      </Field>
      <Field label="Event date">
        <input type="date" className={fieldClass} value={draft.eventDate} onChange={(event) => set('eventDate', event.target.value)} />
      </Field>
      <Field label="Musicians needed">
        <input type="number" min={1} max={12} className={fieldClass} value={draft.performersNeeded} onChange={(event) => set('performersNeeded', event.target.value)} />
      </Field>
      <Field label="Performance start">
        <input type="time" className={fieldClass} value={draft.performanceStart} onChange={(event) => set('performanceStart', event.target.value)} />
      </Field>
      <Field label="Performance end">
        <input type="time" className={fieldClass} value={draft.performanceEnd} onChange={(event) => set('performanceEnd', event.target.value)} />
      </Field>
      <Field label="Estimated duration (hours)">
        <input className={fieldClass} value={draft.estimatedDuration} onChange={(event) => set('estimatedDuration', event.target.value)} placeholder="Filled from the times if left blank" />
      </Field>
      <Field label="Guest count">
        <input className={fieldClass} value={draft.guestCount} onChange={(event) => set('guestCount', event.target.value)} />
      </Field>
      <Field label="Venue name">
        <input className={fieldClass} value={draft.venueName} onChange={(event) => set('venueName', event.target.value)} />
      </Field>
      <Field label="Venue address">
        <input className={fieldClass} value={draft.venueAddress} onChange={(event) => set('venueAddress', event.target.value)} />
      </Field>
      <Field label="Requested services" wide>
        <textarea className={fieldClass} rows={2} value={draft.requestedServices} onChange={(event) => set('requestedServices', event.target.value)} placeholder="Ceremony violin, cocktail hour, reception" />
      </Field>
      <Field label="Budget">
        <input className={fieldClass} value={draft.budget} onChange={(event) => set('budget', event.target.value)} placeholder="Optional" />
      </Field>
      <Field label="How they found Daniel">
        <input className={fieldClass} list="how-found" value={draft.howFound} onChange={(event) => set('howFound', event.target.value)} />
        <datalist id="how-found">
          {HOW_FOUND_OPTIONS.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      </Field>
      <Field label="Quoted price">
        <input className={fieldClass} value={draft.quotedPrice} onChange={(event) => set('quotedPrice', event.target.value)} placeholder="Optional" />
      </Field>
      <Field label="Next follow-up">
        <input type="date" className={fieldClass} value={draft.nextFollowUp} onChange={(event) => set('nextFollowUp', event.target.value)} />
      </Field>
      <Field label="Contract status">
        <select className={fieldClass} value={draft.contractStatus} onChange={(event) => set('contractStatus', event.target.value)}>
          {CONTRACT_STATUSES.map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
      </Field>
      <Field label="Payment status">
        <select className={fieldClass} value={draft.paymentStatus} onChange={(event) => set('paymentStatus', event.target.value)}>
          {PAYMENT_STATUSES.map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
      </Field>
      <Field label="Inquiry notes" wide>
        <textarea className={fieldClass} rows={4} value={draft.message} onChange={(event) => set('message', event.target.value)} />
      </Field>
    </div>
  );
}

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={wide ? 'md:col-span-2 block' : 'block'}>
      <span className="block text-sm font-medium text-gray-700 mb-2">{label}</span>
      {children}
    </label>
  );
}

export function SubmittedDetails({ details }: { details: unknown }) {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return null;
  const entries = Object.entries(details as Record<string, unknown>).filter(([, value]) => value != null && value !== '');
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
