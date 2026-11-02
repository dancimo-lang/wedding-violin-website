'use client';

import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { PaymentOptions } from '@/components/payments/PaymentOptions';
import {
  applyCoupleEventDetails,
  coupleDetailPayload,
  coupleEventTimeMessage,
  coupleFillableDetails,
  emptyCoupleDetailDraft,
  type CoupleDetailField,
} from '@/lib/contracts/event-details';
import { formatMoney } from '@/lib/contracts/money';
import {
  normalizeStoredFields,
  renderContract,
  slotMarker,
  UNSIGNED,
  type CoupleDetailKey,
  type StoredRenderFields,
} from '@/lib/contracts/render';
import { validateSignature, validateSigningDates } from '@/lib/contracts/signers';
import { BUSINESS_TIME_ZONE, todayInTimeZone } from '@/lib/schedule/time';
import { ContractText } from '@/components/contracts/ContractText';

type ViewResponse = {
  status: string;
  canSign: boolean;
  text: string;
  renderFields: StoredRenderFields | null;
  photoOptOut: boolean;
  musicianSigned?: boolean;
  clientSignedAt?: string | null;
  musicianSignedAt?: string | null;
  client1Name?: string | null;
  client2Name?: string | null;
  bookingCode: string | null;
  retainerCents: number | null;
  balanceCents: number | null;
  retainer: string | null;
  balance: string | null;
  finalPaymentDueLabel: string;
  error?: string;
};

function useSigningToken(): string | null {
  return useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener('popstate', onStoreChange);
      return () => window.removeEventListener('popstate', onStoreChange);
    },
    () => new URLSearchParams(window.location.search).get('t') ?? '',
    () => null,
  );
}

type SignerKey = 'c1' | 'c2';

const SIGNER_SLOTS = {
  c1: { name: 'c1name', signature: 'c1sig', date: 'c1date' },
  c2: { name: 'c2name', signature: 'c2sig', date: 'c2date' },
} as const;

/** Placeholder values the signing page draws as inline inputs. */
function signingDisplay(): Record<string, string> {
  return {
    CLIENT_1_PRINTED_NAME: slotMarker(SIGNER_SLOTS.c1.name),
    CLIENT_1_SIGNATURE: slotMarker(SIGNER_SLOTS.c1.signature),
    CLIENT_1_DATE: slotMarker(SIGNER_SLOTS.c1.date),
    CLIENT_2_PRINTED_NAME: slotMarker(SIGNER_SLOTS.c2.name),
    CLIENT_2_SIGNATURE: slotMarker(SIGNER_SLOTS.c2.signature),
    CLIENT_2_DATE: slotMarker(SIGNER_SLOTS.c2.date),
    // Full wedding agreement has one client block.
    CLIENT_PRINTED_NAME: slotMarker(SIGNER_SLOTS.c1.name),
    CLIENT_SIGNATURE: slotMarker(SIGNER_SLOTS.c1.signature),
    CLIENT_DATE: slotMarker(SIGNER_SLOTS.c1.date),
    PHOTO_OPT_OUT_MARK: slotMarker('photo'),
  };
}

function hasClient2Block(fields: StoredRenderFields | null): boolean {
  return fields?.templateId !== 'full-wedding';
}

export function SignContract() {
  const token = useSigningToken();
  const [view, setView] = useState<ViewResponse | null>(null);
  const [loadError, setLoadError] = useState('');
  const [client1Name, setClient1Name] = useState('');
  const [client2Name, setClient2Name] = useState('');
  const [client1Date, setClient1Date] = useState('');
  const [client2Date, setClient2Date] = useState('');
  const [adopted, setAdopted] = useState<Record<SignerKey, boolean>>({ c1: false, c2: false });
  const [eventDetails, setEventDetails] = useState(() => emptyCoupleDetailDraft());
  const [photoOptOut, setPhotoOptOut] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState('');
  const [showMissing, setShowMissing] = useState(false);
  const [signedText, setSignedText] = useState('');
  const [signedFacts, setSignedFacts] = useState<ViewResponse | null>(null);

  useEffect(() => {
    if (!token) return;
    const signingToken = token;
    let cancelled = false;
    async function load() {
      const response = await fetch(`/api/contracts/view?t=${encodeURIComponent(signingToken)}`, { cache: 'no-store' });
      const payload = (await response.json()) as ViewResponse;
      if (cancelled) return;
      if (!response.ok) {
        setLoadError(payload.error || 'This signing link is not valid.');
        setView(null);
        return;
      }
      setView(payload);
      setPhotoOptOut(payload.photoOptOut);
      setEventDetails(emptyCoupleDetailDraft());
      // The printed-name boxes start with the names entered in admin; the
      // signature itself appears only after each signer adopts it.
      const stored = payload.canSign && payload.renderFields ? normalizeStoredFields(payload.renderFields) : null;
      setClient1Name(payload.canSign ? stored?.client1Name?.trim() || '' : payload.client1Name || '');
      setClient2Name(payload.canSign && hasClient2Block(stored) ? stored?.client2Name?.trim() || '' : '');
      setClient1Date('');
      setClient2Date('');
      setAdopted({ c1: false, c2: false });
    }
    load().catch(() => {
      if (!cancelled) setLoadError('This signing link could not be opened.');
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const fields = useMemo(
    () => (view?.renderFields ? normalizeStoredFields(view.renderFields) : null),
    [view],
  );
  const fillable = useMemo(() => (fields ? coupleFillableDetails(fields) : []), [fields]);
  const timeMessage = fields ? coupleEventTimeMessage(fields, eventDetails) : '';

  // The agreement with every blank the client can fill drawn as an inline input.
  const interactiveText = useMemo(() => {
    if (!fields || !view?.canSign) return view?.text ?? '';
    const withSlots: StoredRenderFields = { ...fields };
    for (const field of fillable) withSlots[field.key] = slotMarker(`detail:${field.key}`);
    try {
      return renderContract(withSlots, {
        ...UNSIGNED,
        client1SignedName: 'x',
        client2SignedName: 'x',
        display: signingDisplay(),
      });
    } catch {
      return view.text;
    }
  }, [fields, fillable, view]);

  const finished = signedFacts ?? (view && !view.canSign ? view : null);
  const interactive = Boolean(view?.canSign && !signedFacts);
  const documentText = signedText || (finished ? finished.text || view?.text || '' : interactiveText);
  const clientSignedAt = finished?.clientSignedAt ?? null;
  const musicianSignedAt = finished?.musicianSignedAt ?? null;

  const names: Record<SignerKey, string> = { c1: client1Name, c2: client2Name };
  const dates: Record<SignerKey, string> = { c1: client1Date, c2: client2Date };
  const setName = (key: SignerKey, value: string) => {
    if (key === 'c1') setClient1Name(value);
    else setClient2Name(value);
    // Changing the name takes back the signature until it is adopted again.
    setAdopted((current) => ({ ...current, [key]: false }));
  };
  const setDate = (key: SignerKey, value: string) => (key === 'c1' ? setClient1Date(value) : setClient2Date(value));

  const missingFor = (field: CoupleDetailField) => showMissing && !field.optional && !eventDetails[field.key].trim();

  const renderSlot = (name: string): ReactNode => {
    if (name.startsWith('detail:')) {
      const key = name.slice('detail:'.length) as CoupleDetailKey;
      const field = fillable.find((item) => item.key === key);
      if (!field) return null;
      const label = `${field.label}${field.optional ? ' (optional)' : ' (required)'}`;
      return (
        <input
          className="contract-inline-input"
          type={field.kind === 'time' ? 'time' : 'text'}
          aria-label={label}
          title={label}
          placeholder={field.kind === 'time' ? undefined : field.optional ? 'Optional' : 'Required'}
          required={!field.optional}
          aria-invalid={missingFor(field) || undefined}
          maxLength={field.kind === 'time' ? undefined : field.max}
          style={field.key === 'venueAddress' || field.key === 'otherDetails' ? { width: '100%' } : undefined}
          value={eventDetails[key]}
          onChange={(event) => setEventDetails((current) => ({ ...current, [key]: event.target.value }))}
          autoComplete={key === 'venueName' ? 'organization' : key === 'venueAddress' ? 'street-address' : 'off'}
        />
      );
    }
    if (name === 'photo') {
      return (
        <input
          type="checkbox"
          className="mr-1 h-5 w-5 align-middle"
          aria-label="The Client opts out of promotional use of photographs and video clips from the event."
          checked={photoOptOut}
          onChange={(event) => setPhotoOptOut(event.target.checked)}
        />
      );
    }
    const signer = (Object.keys(SIGNER_SLOTS) as SignerKey[]).find((key) =>
      (Object.values(SIGNER_SLOTS[key]) as string[]).includes(name),
    );
    if (!signer) return null;
    const slots = SIGNER_SLOTS[signer];
    const label = signer === 'c1' ? 'Client 1' : 'Client 2';
    const required = signer === 'c1' || Boolean(client2Name.trim());
    if (name === slots.name) {
      return (
        <input
          id={signer === 'c1' ? 'sign-here' : undefined}
          className="contract-inline-input scroll-mt-24"
          style={{ width: '100%', maxWidth: '22rem' }}
          aria-label={`${label} printed full legal name`}
          placeholder={signer === 'c1' ? 'Full legal name' : 'Full legal name (if applicable)'}
          aria-invalid={(showMissing && signer === 'c1' && !client1Name.trim()) || undefined}
          value={names[signer]}
          onChange={(event) => setName(signer, event.target.value)}
          autoComplete="name"
        />
      );
    }
    if (name === slots.date) {
      return (
        <input
          className="contract-inline-input"
          type="date"
          aria-label={`${label} signing date`}
          required={required}
          aria-invalid={(showMissing && required && !dates[signer]) || undefined}
          value={dates[signer]}
          onChange={(event) => setDate(signer, event.target.value)}
        />
      );
    }
    const typed = names[signer].trim();
    if (adopted[signer] && typed) {
      return (
        <span className="contract-signature-block">
          <span className="contract-signature-name">{typed}</span>
          <button
            type="button"
            className="contract-signature-caption text-left text-blue-800 underline"
            style={{ color: '#1e40af', background: 'none' }}
            onClick={() => setAdopted((current) => ({ ...current, [signer]: false }))}
          >
            Undo signature
          </button>
        </span>
      );
    }
    return (
      <button
        type="button"
        disabled={!typed}
        aria-invalid={(showMissing && required && !adopted[signer]) || undefined}
        className="ml-1 rounded-lg bg-blue-700 px-3 py-1 font-sans text-sm text-white disabled:bg-gray-400"
        onClick={() => setAdopted((current) => ({ ...current, [signer]: true }))}
      >
        {typed ? 'Click to sign' : 'Type your name above to sign'}
      </button>
    );
  };

  const sign = async () => {
    if (!token) return;
    setShowMissing(true);
    const detailPayload = fields ? coupleDetailPayload(fields, eventDetails) : {};
    if (fields) {
      const details = applyCoupleEventDetails(fields, detailPayload);
      if (!details.ok) {
        setSignError(details.error);
        return;
      }
    }
    const nameProblem = validateSignature({ client1Name, client2Name, agreed: true });
    if (nameProblem) {
      setSignError(nameProblem);
      return;
    }
    if (!adopted.c1) {
      setSignError('Client 1: click "Click to sign" in the signature section to sign.');
      return;
    }
    if (client2Name.trim() && !adopted.c2) {
      setSignError('Client 2: click "Click to sign" in the signature section to sign.');
      return;
    }
    const dateProblem = validateSigningDates(
      { client1Name, client2Name, client1SignedOn: client1Date, client2SignedOn: client2Date },
      todayInTimeZone(BUSINESS_TIME_ZONE),
    );
    if (dateProblem) {
      setSignError(dateProblem);
      return;
    }
    const problem = validateSignature({ client1Name, client2Name, agreed });
    if (problem) {
      setSignError(problem);
      return;
    }
    setSigning(true);
    setSignError('');
    try {
      const response = await fetch('/api/contracts/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          client1Name,
          client2Name,
          client1SignedOn: client1Date,
          client2SignedOn: client2Name.trim() ? client2Date : '',
          photoOptOut,
          agreed,
          eventDetails: detailPayload,
        }),
      });
      const payload = (await response.json()) as ViewResponse & { text?: string };
      if (!response.ok) {
        setSignError(payload.error || 'This agreement could not be signed.');
        setSigning(false);
        return;
      }
      setSignedText(payload.text || '');
      setSignedFacts({
        status: 'signed',
        canSign: false,
        text: payload.text || '',
        renderFields: null,
        photoOptOut,
        musicianSigned: Boolean(payload.musicianSigned),
        clientSignedAt: payload.clientSignedAt ?? null,
        musicianSignedAt: payload.musicianSignedAt ?? null,
        bookingCode: payload.bookingCode ?? null,
        retainerCents: payload.retainerCents ?? null,
        balanceCents: payload.balanceCents ?? null,
        retainer: payload.retainer ?? null,
        balance: payload.balance ?? null,
        finalPaymentDueLabel: payload.finalPaymentDueLabel || '',
      });
    } catch {
      setSignError('This agreement could not be signed.');
    }
    setSigning(false);
  };

  const privateEvent = fields?.templateId === 'private-event' || /^Private Event/.test(documentText);

  return (
    <section className="py-6 sm:py-10">
      <div className="container mx-auto px-2 sm:px-4">
        <article className="contract-sheet mx-auto max-w-3xl rounded-xl bg-white p-4 shadow sm:p-6 md:p-10">
          <h1 className="text-2xl font-bold sm:text-3xl">{privateEvent ? 'Private event music agreement' : 'Wedding music agreement'}</h1>
          {token == null && <p className="mt-6">Loading agreement...</p>}
          {token === '' && <p className="mt-6">This signing link is missing.</p>}
          {loadError && <p className="mt-6">{loadError}</p>}
          {token && !loadError && !view && !signedFacts && <p className="mt-6">Loading agreement...</p>}

          {(view || signedFacts) && !loadError && (
            <>
              {finished?.status === 'void' && (
                <p className="mt-4 rounded-lg bg-gray-100 px-4 py-3">This agreement was voided and can no longer be signed.</p>
              )}
              {finished?.status === 'signed' && (
                <p className="mt-4 rounded-lg bg-green-50 px-4 py-3">
                  This agreement is signed{finished.musicianSigned ? ' by both parties' : ''}.
                </p>
              )}
              {interactive && (
                <p className="mt-6 rounded-lg bg-blue-50 px-4 py-3 text-sm">
                  Read the agreement below. Fill in any highlighted blanks, then sign in section{' '}
                  {fields?.templateId === 'full-wedding' ? 'Signatures' : '13'}: type your full legal name, click to sign,
                  and enter today&apos;s date. <a href="#sign-here" className="font-semibold underline">Go to signing</a>
                </p>
              )}
              {interactive ? (
                <form
                  className="mt-6 space-y-4"
                  noValidate
                  onSubmit={(event) => {
                    event.preventDefault();
                    void sign();
                  }}
                >
                  <ContractText className="md:max-h-none md:overflow-visible" text={documentText} renderSlot={renderSlot} />
                  {timeMessage ? (
                    <p className="text-sm text-red-700" role="alert">
                      {timeMessage}
                    </p>
                  ) : null}
                  <label className="flex items-start gap-3 text-base">
                    <input
                      type="checkbox"
                      className="mt-1 h-5 w-5"
                      checked={agreed}
                      onChange={(event) => setAgreed(event.target.checked)}
                    />
                    <span>I have read this agreement and I agree to its terms.</span>
                  </label>
                  {signError && (
                    <p className="text-sm text-red-700" role="alert">
                      {signError}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={signing || Boolean(timeMessage)}
                    className="w-full rounded-lg bg-blue-700 px-4 py-3 text-base font-semibold text-white disabled:bg-blue-400 sm:w-auto"
                  >
                    {signing ? 'Signing...' : 'Sign agreement'}
                  </button>
                </form>
              ) : (
                <ContractText
                  className="mt-6"
                  text={documentText}
                  clientSignedAt={clientSignedAt}
                  musicianSignedAt={musicianSignedAt}
                />
              )}

              {finished?.status === 'signed' && (
                <section className="mt-8 rounded-lg border border-gray-200 p-4">
                  <h2 className="text-xl font-bold">Amounts on this agreement</h2>
                  <p className="mt-3">Retainer due: {finished.retainer || (finished.retainerCents == null ? '' : `$${formatMoney(finished.retainerCents)}`)}</p>
                  <p>Booking code: {finished.bookingCode || 'The booking code is not on this agreement yet.'}</p>
                  {finished.balance && finished.finalPaymentDueLabel && (
                    <p>Remaining balance of {finished.balance} is due {finished.finalPaymentDueLabel}.</p>
                  )}
                </section>
              )}
              {finished?.status === 'signed' && token ? <PaymentOptions token={token} /> : null}
            </>
          )}
        </article>
      </div>
    </section>
  );
}
