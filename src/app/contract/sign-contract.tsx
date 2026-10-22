'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { formatMoney } from '@/lib/contracts/money';
import {
  normalizeStoredFields,
  renderContract,
  signatureDateLabel,
  UNSIGNED,
  type StoredRenderFields,
} from '@/lib/contracts/render';
import { validateSignature } from '@/lib/contracts/signers';

type ViewResponse = {
  status: string;
  canSign: boolean;
  text: string;
  renderFields: StoredRenderFields | null;
  photoOptOut: boolean;
  musicianSigned?: boolean;
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

export function SignContract() {
  const token = useSigningToken();
  const [view, setView] = useState<ViewResponse | null>(null);
  const [loadError, setLoadError] = useState('');
  const [client1Name, setClient1Name] = useState('');
  const [client2Name, setClient2Name] = useState('');
  const [photoOptOut, setPhotoOptOut] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState('');
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
      setClient1Name(payload.canSign ? '' : payload.client1Name || '');
      setClient2Name(payload.canSign ? '' : payload.client2Name || '');
    }
    load().catch(() => {
      if (!cancelled) setLoadError('This signing link could not be opened.');
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const fields = view?.renderFields ? normalizeStoredFields(view.renderFields) : null;
  const liveText = useMemo(() => {
    if (!fields || !view?.canSign) return view?.text ?? '';
    try {
      return renderContract(fields, {
        ...UNSIGNED,
        client1SignedName: client1Name.trim(),
        client2SignedName: client2Name.trim(),
        signedOn: client1Name.trim() ? signatureDateLabel() : '',
        photoOptOut,
      });
    } catch {
      return view.text;
    }
  }, [client1Name, client2Name, fields, photoOptOut, view]);

  const finished = signedFacts ?? (view && !view.canSign ? view : null);
  const documentText = signedText || (finished ? finished.text || view?.text || '' : liveText);

  const sign = async () => {
    if (!token) return;
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
          photoOptOut,
          agreed,
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

  return (
    <section className="py-10">
      <div className="container mx-auto px-4">
        <article className="contract-sheet mx-auto max-w-3xl rounded-xl bg-white p-6 shadow md:p-10">
          <h1 className="text-3xl font-bold">Wedding music agreement</h1>
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
              <pre className="mt-6 max-h-[36rem] overflow-auto whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 p-4 font-serif text-sm leading-6">
                {documentText}
              </pre>

              {view?.canSign && !signedFacts && (
                <form
                  className="mt-6 space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void sign();
                  }}
                >
                  <label className="flex items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={photoOptOut}
                      onChange={(event) => setPhotoOptOut(event.target.checked)}
                    />
                    <span>The Client opts out of promotional use of photographs and video clips from the event.</span>
                  </label>
                  <label className="block text-sm">
                    Client 1 full legal name
                    <input
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                      value={client1Name}
                      onChange={(event) => setClient1Name(event.target.value)}
                      autoComplete="name"
                    />
                  </label>
                  <label className="block text-sm">
                    Client 2 full legal name, if there is a second client
                    <input
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                      value={client2Name}
                      onChange={(event) => setClient2Name(event.target.value)}
                      autoComplete="name"
                    />
                  </label>
                  <label className="flex items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={agreed}
                      onChange={(event) => setAgreed(event.target.checked)}
                    />
                    <span>I have read this agreement and I agree to its terms.</span>
                  </label>
                  {signError && <p className="text-sm text-red-700">{signError}</p>}
                  <button
                    type="submit"
                    disabled={signing}
                    className="rounded-lg bg-blue-700 px-4 py-2 text-white disabled:bg-blue-400"
                  >
                    {signing ? 'Signing...' : 'Sign'}
                  </button>
                </form>
              )}

              {finished?.status === 'signed' && (
                <section className="mt-8 rounded-lg border border-gray-200 p-4">
                  <h2 className="text-xl font-bold">Next: pay your retainer</h2>
                  <p className="mt-3">Retainer due: {finished.retainer || (finished.retainerCents == null ? '' : `$${formatMoney(finished.retainerCents)}`)}</p>
                  <p>Booking code: {finished.bookingCode || 'The booking code is not on this agreement yet.'}</p>
                  {finished.balance && finished.finalPaymentDueLabel && (
                    <p>Remaining balance of {finished.balance} is due {finished.finalPaymentDueLabel}.</p>
                  )}
                  <p className="mt-3">
                    Put this booking code in the Zelle memo when you pay the retainer. Card payment will be a backup. Payment is not collected on this page.
                  </p>
                </section>
              )}
            </>
          )}
        </article>
      </div>
    </section>
  );
}
