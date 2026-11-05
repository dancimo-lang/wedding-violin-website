'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminButton, adminButtonClass } from '@/components/admin/AdminButton';
import { FeeReadout } from '@/components/admin/AgreementFields';
import { ContractText } from '@/components/contracts/ContractText';
import {
  AGREEMENT_FIELD_IDS,
  agreementGaps,
  agreementTimeOrder,
  buildSavedAgreement,
  contractRequestBody,
  dollarInputToCents,
  readAgreement,
  type SavedAgreement,
} from '@/lib/contracts/agreement-details';
import { loadAgreementNote } from '@/lib/contracts/agreement-store';
import { CONTRACT_LIST_COLUMNS, type ContractListRow } from '@/lib/contracts/columns';
import { coupleSuppliedSummary, optionalBlankDetailMessage, sentContractBlankDetailMessage } from '@/lib/contracts/event-details';
import { computeFees, formatMoney } from '@/lib/contracts/money';
import { PACKAGES, type PackageId } from '@/lib/contracts/packages';
import { feeSnapshot, normalizeStoredFields, renderContract, UNSIGNED } from '@/lib/contracts/render';
import { fieldClass } from '@/lib/leads';
import { createClient } from '@/lib/supabase/client';

type Loaded = {
  leadId: string | null;
  bookingId: string | null;
  saved: SavedAgreement;
};

function focusField(id: string) {
  const element = document.getElementById(id);
  if (!element) return;
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (element instanceof HTMLElement) element.focus({ preventScroll: true });
}

export function ContractPanel({
  leadId,
  bookingId,
  savedRevision = 0,
}: {
  leadId?: string | null;
  bookingId?: string | null;
  savedRevision?: number;
}) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [contracts, setContracts] = useState<ContractListRow[]>([]);
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [signingUrl, setSigningUrl] = useState('');
  const [musicianName, setMusicianName] = useState('Daniel Cimo');
  const [autoCountersign, setAutoCountersign] = useState(false);

  const reloadContracts = useCallback(async (next: Loaded) => {
    let query = createClient().from('contracts').select(CONTRACT_LIST_COLUMNS).order('created_at', { ascending: false });
    if (bookingId) query = query.eq('booking_id', bookingId);
    else if (next.leadId) query = query.eq('lead_id', next.leadId);
    else if (next.bookingId) query = query.eq('booking_id', next.bookingId);
    const { data, error: loadError } = await query;
    if (loadError) {
      setError('Could not load agreements. Run the contracts migration if this database does not have it yet.');
      setContracts([]);
      return;
    }
    setContracts((data || []) as unknown as ContractListRow[]);
  }, [bookingId]);

  useEffect(() => {
    if (!leadId && !bookingId) return;
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      let lead: Record<string, unknown> | null = null;
      let booking: Record<string, unknown> | null = null;
      let client: Record<string, unknown> | null = null;
      if (bookingId) {
        const { data } = await supabase.from('bookings').select('*').eq('id', bookingId).maybeSingle();
        booking = data;
        if (booking?.client_id) {
          const { data: clientRow } = await supabase.from('clients').select('*').eq('id', booking.client_id).maybeSingle();
          client = clientRow;
        }
        const relatedLead = (booking?.lead_id as string | undefined) || leadId;
        if (relatedLead) {
          const { data: leadRow } = await supabase.from('leads').select('*').eq('id', relatedLead).maybeSingle();
          lead = leadRow;
        }
      } else if (leadId) {
        const { data } = await supabase.from('leads').select('*, clients(*)').eq('id', leadId).maybeSingle();
        lead = data;
        const embedded = data?.clients as Record<string, unknown> | Record<string, unknown>[] | null;
        client = Array.isArray(embedded) ? embedded[0] ?? null : embedded;
        const { data: bookings } = await supabase
          .from('bookings')
          .select('*')
          .eq('lead_id', leadId)
          .order('created_at', { ascending: false });
        booking = ((bookings || []) as Record<string, unknown>[]).find((row) => row.status !== 'Cancelled') ?? null;
      }
      const agreement = lead
        ? readAgreement(lead.inquiry_details)
        : await loadAgreementNote(supabase, (booking?.id as string | undefined) || bookingId);
      if (cancelled) return;
      const next: Loaded = {
        leadId: (lead?.id as string | undefined) || leadId || (booking?.lead_id as string | undefined) || null,
        bookingId: (booking?.id as string | undefined) || bookingId || null,
        saved: buildSavedAgreement({ lead, booking, client, agreement }),
      };
      setLoaded(next);
      const { data: settings } = await supabase.from('business_settings').select('auto_countersign_contracts').eq('id', 1).maybeSingle();
      if (!cancelled) setAutoCountersign(settings?.auto_countersign_contracts === true);
      await reloadContracts(next);
    }
    load().catch(() => {
      if (!cancelled) setError('Could not load the agreement.');
    });
    return () => {
      cancelled = true;
    };
  }, [leadId, bookingId, savedRevision, reloadContracts]);

  const saved = loaded?.saved;
  const gaps = saved ? agreementGaps(saved) : [];
  const timeOrder = saved ? agreementTimeOrder(saved) : '';
  const optionalBlank = saved ? optionalBlankDetailMessage(saved) : '';
  const summary = useMemo(() => {
    if (!saved) return null;
    return computeFees({
      packageId: saved.packageId,
      travelFeeCents: dollarInputToCents(saved.travelFee) ?? -1,
      additionalFeesCents: dollarInputToCents(saved.additionalFees) ?? -1,
      discountCents: dollarInputToCents(saved.discount) ?? -1,
      weddingDateIso: saved.weddingDate,
      performanceFeeCents: saved.packageId === 'EVENT' ? dollarInputToCents(saved.performanceFee) ?? -1 : undefined,
    });
  }, [saved]);

  const preview = useMemo(() => {
    if (!saved || !summary || 'error' in summary || !saved.client1Name.trim() || !saved.weddingDate) return '';
    try {
      return renderContract(
        feeSnapshot(summary, {
          client1Name: saved.client1Name,
          client2Name: saved.client2Name,
          weddingDateIso: saved.weddingDate,
          venueName: saved.venueName,
          venueAddress: saved.venueAddress,
          ceremonyStart: saved.ceremonyStart,
          ceremonyEnd: saved.ceremonyEnd,
          cocktailStart: saved.cocktailStart,
          cocktailEnd: saved.cocktailEnd,
          preludeStart: saved.preludeStart,
          ...(saved.preludeEnd.trim() ? { preludeEnd: saved.preludeEnd } : {}),
          otherDetails: saved.otherDetails,
          ...(saved.packageId === 'FULL' ? { receptionStart: saved.receptionStart, receptionEnd: saved.receptionEnd } : {}),
          additionalFeesDescription: saved.additionalFeesDescription,
          ...(saved.packageId === 'EVENT' ? { eventType: saved.eventType, performanceDescription: saved.performanceDescription } : {}),
        }),
        UNSIGNED,
      );
    } catch {
      return '';
    }
  }, [saved, summary]);

  const blocking = contracts.find((row) => row.status === 'sent' || row.status === 'viewed' || row.status === 'signed');

  const send = async () => {
    if (!loaded || gaps.length > 0 || timeOrder || !preview) return;
    setBusy(true);
    setError('');
    setNotice('');
    const response = await fetch('/api/admin/contracts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(contractRequestBody({ leadId: loaded.leadId, bookingId: loaded.bookingId }, loaded.saved)),
    });
    const payload = (await response.json()) as { error?: string; emailed?: boolean; signingUrl?: string; bookingCode?: string; testSiteEmail?: boolean };
    if (!response.ok) {
      setError(payload.error || 'Could not send this agreement.');
      setBusy(false);
      return;
    }
    setSigningUrl(payload.signingUrl || '');
    setNotice(
      payload.emailed
        ? payload.testSiteEmail
          ? `Signing link emailed to you only (test site). Booking code ${payload.bookingCode}.`
          : `Signing link emailed. Booking code ${payload.bookingCode}.`
        : `Agreement saved, but the email was not sent. Booking code ${payload.bookingCode}. Copy the signing link below.`,
    );
    setReviewing(false);
    await reloadContracts(loaded);
    setBusy(false);
  };

  const postAction = async (path: string, body?: unknown) => {
    if (!loaded) return;
    setBusy(true);
    setError('');
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = (await response.json()) as { error?: string; emailed?: boolean; signingUrl?: string; testSiteEmail?: boolean };
    if (!response.ok) setError(payload.error || 'Could not update this agreement.');
    else {
      if (payload.signingUrl) setSigningUrl(payload.signingUrl);
      setNotice(
        payload.emailed === false
          ? 'The email was not sent. Copy the signing link below.'
          : payload.testSiteEmail
            ? 'Saved. The signing email went only to you (test site).'
            : 'Saved.',
      );
      await reloadContracts(loaded);
    }
    setBusy(false);
  };

  return (
    <section className="mt-6 rounded-xl bg-white p-6 shadow">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xl font-bold text-gray-900">Agreement</h3>
        {!blocking && !reviewing && (
          <AdminButton type="button" onClick={() => setReviewing(true)}>
            Create contract
          </AdminButton>
        )}
      </div>
      {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-red-700">{error}</p>}
      {notice && <p className="mt-4 rounded-lg bg-green-50 px-4 py-3 text-green-800">{notice}</p>}
      {signingUrl && (
        <label className="mt-4 block text-sm text-gray-700">
          Signing link
          <input className={`${fieldClass} mt-1`} readOnly value={signingUrl} />
        </label>
      )}

      {blocking && (
        <>
          <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-950">
            This agreement keeps the details it had when it was sent. Saving changes in the form above does not change a sent or signed agreement. Void the open agreement and send a new one if it should match the current details. Custom songs are not part of the agreement and can still be changed.
          </p>
          <ContractStatus row={blocking} busy={busy} musicianName={musicianName} onMusicianName={setMusicianName} onAction={postAction} />
        </>
      )}

      {!blocking && contracts[0]?.status === 'void' && (
        <p className="mt-4 text-sm text-gray-600">The last agreement was voided. The booking code stays on the booking.</p>
      )}

      {reviewing && !blocking && saved && (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-gray-700">
            This preview uses the saved details. Save the form above if you just changed something.
          </p>
          {gaps.length > 0 ? (
            <div className="rounded-lg bg-amber-50 px-4 py-3 text-amber-950">
              <p className="font-semibold">Still needed before this can be sent</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {gaps.map((gap) => (
                  <li key={`${gap.id}-${gap.label}`}>
                    <a
                      href={`#${gap.id}`}
                      className="font-semibold underline"
                      onClick={(event) => {
                        event.preventDefault();
                        focusField(gap.id);
                      }}
                    >
                      {gap.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {optionalBlank ? <p className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700">{optionalBlank}</p> : null}
          {timeOrder ? <p className="rounded-lg bg-red-50 px-4 py-3 text-red-700">{timeOrder}</p> : null}
          {summary && 'error' in summary ? null : summary ? (
            <FeeReadout
              summary={summary}
              error=""
              packageFee={summary.packageFeeCents}
              quotedPrice={saved.quotedPrice}
            />
          ) : null}
          {preview ? (
            <ContractText className="max-h-96 overflow-auto md:max-h-96" text={preview} musicianAwaitingNote={autoCountersign} />
          ) : (
            <p className="text-sm text-gray-700">The agreement preview appears once the client name and date are saved.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <AdminButton type="button" disabled={busy || !preview || gaps.length > 0 || Boolean(timeOrder)} onClick={() => void send()}>
              {busy ? 'Sending...' : 'Send for signature'}
            </AdminButton>
            <AdminButton type="button" variant="secondary" onClick={() => focusField(AGREEMENT_FIELD_IDS.record)}>
              Edit details
            </AdminButton>
            <AdminButton type="button" variant="secondary" onClick={() => setReviewing(false)}>
              Close
            </AdminButton>
          </div>
          {!loaded?.bookingId && (
            <p className="text-sm text-gray-600">Sending creates a tentative booking when this lead does not have one, so the booking code has a place to live.</p>
          )}
        </div>
      )}
    </section>
  );
}

function ContractStatus({
  row,
  busy,
  musicianName,
  onMusicianName,
  onAction,
}: {
  row: ContractListRow;
  busy: boolean;
  musicianName: string;
  onMusicianName: (value: string) => void;
  onAction: (path: string, body?: unknown) => Promise<void>;
}) {
  const open = row.status === 'sent' || row.status === 'viewed';
  const stored = normalizeStoredFields(row.render_fields);
  const waitingMessage = open && stored ? sentContractBlankDetailMessage(stored) : '';
  const suppliedMessage = row.status === 'signed' ? coupleSuppliedSummary(stored) : '';
  return (
    <div className="mt-4 space-y-3 text-sm text-gray-800">
      <p>
        Status: {row.status}. {row.package_id ? PACKAGES[row.package_id as PackageId]?.title : ''} Booking code {row.booking_code || 'not assigned'}.
      </p>
      {waitingMessage ? <p className="rounded-lg bg-amber-50 px-4 py-3 text-amber-900">{waitingMessage}</p> : null}
      {suppliedMessage ? <p className="rounded-lg bg-amber-50 px-4 py-3 text-amber-900">{suppliedMessage}</p> : null}
      {row.total_cents != null && row.retainer_cents != null && row.balance_cents != null && (
        <p>
          Total ${formatMoney(row.total_cents)}. Retainer ${formatMoney(row.retainer_cents)}. Balance ${formatMoney(row.balance_cents)}
          {row.final_payment_due_on ? `, due ${row.final_payment_due_on}` : ''}.
        </p>
      )}
      {row.status === 'signed' && (
        <p>
          Client signed {row.client1_name}
          {row.client2_name ? ` and ${row.client2_name}` : ''}.
          {row.photo_opt_out ? ' Promotional photo opt-out is checked.' : ''}
          {row.musician_signed_at ? ` Musician signature: ${row.musician_signed_name}.` : ' Musician signature is not recorded yet.'}
        </p>
      )}
      {row.status === 'signed' && (row.executed_text || row.signed_text) && (
        <ContractText
          text={row.executed_text || row.signed_text || ''}
          clientSignedAt={row.signed_at}
          musicianSignedAt={row.musician_signed_at}
        />
      )}
      <div className="flex flex-wrap gap-2">
        {open && (
          <>
            <AdminButton type="button" variant="secondary" disabled={busy} onClick={() => void onAction(`/api/admin/contracts/${row.id}/resend`)}>
              Resend
            </AdminButton>
            <AdminButton
              type="button"
              variant="danger"
              disabled={busy}
              onClick={() => {
                if (window.confirm('Void this agreement? The signing link will stop working.')) void onAction(`/api/admin/contracts/${row.id}/void`);
              }}
            >
              Void
            </AdminButton>
          </>
        )}
        {row.status === 'signed' && !row.musician_signed_at && (
          <>
            <input className={`${fieldClass} max-w-xs`} value={musicianName} onChange={(event) => onMusicianName(event.target.value)} />
            <AdminButton
              type="button"
              disabled={busy}
              onClick={() => void onAction(`/api/admin/contracts/${row.id}/countersign`, { name: musicianName })}
            >
              Countersign
            </AdminButton>
          </>
        )}
        {row.status === 'signed' && (
          <a href={`/api/admin/contracts/${row.id}/pdf`} className={adminButtonClass('secondary')}>
            Download PDF
          </a>
        )}
      </div>
    </div>
  );
}
