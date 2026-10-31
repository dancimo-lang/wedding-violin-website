'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CONTRACT_LIST_COLUMNS, type ContractListRow } from '@/lib/contracts/columns';
import { computeFees, formatMoney, type FeeSummary } from '@/lib/contracts/money';
import { guessPackageId, PACKAGES, type PackageId } from '@/lib/contracts/packages';
import { coupleSuppliedSummary, missingCoupleDetailMessage } from '@/lib/contracts/event-details';
import { feeSnapshot, normalizeStoredFields, performanceTimeOrderMessage, renderContract, UNSIGNED } from '@/lib/contracts/render';
import { ContractText } from '@/components/contracts/ContractText';
import { fieldClass } from '@/lib/leads';
import { createClient } from '@/lib/supabase/client';

type Source = {
  leadId: string | null;
  bookingId: string | null;
  clientName: string;
  partnerName: string;
  email: string;
  eventDate: string;
  venueName: string;
  venueAddress: string;
  ceremonyStart: string;
  ceremonyEnd: string;
  packageInterest: string;
  service: string;
  quotedPrice: number | null;
};

function timeValue(value: string | null | undefined) {
  return value ? value.slice(0, 5) : '';
}

export function ContractPanel({
  leadId,
  bookingId,
}: {
  leadId?: string | null;
  bookingId?: string | null;
}) {
  const [source, setSource] = useState<Source | null>(null);
  const [contracts, setContracts] = useState<ContractListRow[]>([]);
  const [packageId, setPackageId] = useState<PackageId>('A');
  const [client1Name, setClient1Name] = useState('');
  const [client2Name, setClient2Name] = useState('');
  const [weddingDate, setWeddingDate] = useState('');
  const [venueName, setVenueName] = useState('');
  const [venueAddress, setVenueAddress] = useState('');
  const [ceremonyStart, setCeremonyStart] = useState('');
  const [ceremonyEnd, setCeremonyEnd] = useState('');
  const [cocktailStart, setCocktailStart] = useState('');
  const [cocktailEnd, setCocktailEnd] = useState('');
  const [preludeStart, setPreludeStart] = useState('');
  const [otherDetails, setOtherDetails] = useState('');
  const [travelFee, setTravelFee] = useState('0');
  const [additionalFees, setAdditionalFees] = useState('0');
  const [additionalFeesDescription, setAdditionalFeesDescription] = useState('');
  const [discount, setDiscount] = useState('0');
  const [performanceFee, setPerformanceFee] = useState('');
  const [eventType, setEventType] = useState('');
  const [performanceDescription, setPerformanceDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [signingUrl, setSigningUrl] = useState('');
  const [musicianName, setMusicianName] = useState('Daniel Cimo');
  const [loadedKey, setLoadedKey] = useState('');

  const recordKey = `${leadId ?? ''}:${bookingId ?? ''}`;

  const reloadContracts = useCallback(async (nextSource: Source) => {
    let query = createClient().from('contracts').select(CONTRACT_LIST_COLUMNS).order('created_at', { ascending: false });
    if (bookingId) query = query.eq('booking_id', bookingId);
    else if (nextSource.leadId) query = query.eq('lead_id', nextSource.leadId);
    else if (nextSource.bookingId) query = query.eq('booking_id', nextSource.bookingId);
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
      if (cancelled) return;
      const next: Source = {
        leadId: (lead?.id as string | undefined) || leadId || (booking?.lead_id as string | undefined) || null,
        bookingId: (booking?.id as string | undefined) || bookingId || null,
        clientName: (client?.name as string | undefined) || '',
        partnerName: (client?.partner_name as string | undefined) || '',
        email: (client?.email as string | undefined) || '',
        eventDate: (booking?.event_date as string | undefined) || (lead?.event_date as string | undefined) || '',
        venueName: (booking?.venue_name as string | undefined) || (lead?.venue_name as string | undefined) || '',
        venueAddress: (booking?.venue_address as string | undefined) || (lead?.venue_address as string | undefined) || '',
        ceremonyStart: timeValue((booking?.performance_start_time as string | undefined) || (lead?.performance_start_time as string | undefined)),
        ceremonyEnd: timeValue((booking?.performance_end_time as string | undefined) || (lead?.performance_end_time as string | undefined)),
        packageInterest: (lead?.package_interest as string | undefined) || '',
        service: (booking?.service_type as string | undefined) || (lead?.requested_services as string | undefined) || (lead?.service_type as string | undefined) || '',
        quotedPrice: typeof lead?.quoted_price === 'number' ? lead.quoted_price : typeof booking?.total_price === 'number' ? booking.total_price : null,
      };
      setSource(next);
      if (loadedKey !== recordKey) {
        const guessed = guessPackageId({
          packageInterest: next.packageInterest,
          service: next.service,
          quotedPrice: next.quotedPrice,
        });
        setPackageId(guessed);
        setClient1Name(next.clientName);
        setClient2Name(next.partnerName);
        setWeddingDate(next.eventDate);
        setVenueName(next.venueName);
        setVenueAddress(next.venueAddress);
        setCeremonyStart(next.ceremonyStart);
        setCeremonyEnd(next.ceremonyEnd);
        setTravelFee('0');
        setAdditionalFees('0');
        setAdditionalFeesDescription('');
        setDiscount('0');
        setLoadedKey(recordKey);
      }
      await reloadContracts(next);
    }
    load().catch(() => {
      if (!cancelled) setError('Could not load the agreement form.');
    });
    return () => {
      cancelled = true;
    };
  }, [leadId, bookingId, recordKey, loadedKey, reloadContracts]);

  const fullWedding = packageId === 'FULL';
  const privateEvent = packageId === 'EVENT';
  const summary = useMemo(() => {
    return computeFees({
      packageId,
      travelFeeCents: dollars(travelFee),
      additionalFeesCents: dollars(additionalFees),
      discountCents: dollars(fullWedding ? '0' : discount),
      weddingDateIso: weddingDate,
      performanceFeeCents: privateEvent ? dollars(performanceFee) : undefined,
    });
  }, [additionalFees, discount, fullWedding, packageId, performanceFee, privateEvent, travelFee, weddingDate]);

  const preview = useMemo(() => {
    if ('error' in summary || !client1Name.trim() || !weddingDate) return '';
    try {
      return renderContract(
        feeSnapshot(summary, {
          client1Name,
          client2Name,
          weddingDateIso: weddingDate,
          venueName,
          venueAddress,
          ceremonyStart,
          ceremonyEnd,
          cocktailStart,
          cocktailEnd,
          preludeStart,
          otherDetails,
          additionalFeesDescription,
          ...(privateEvent ? { eventType, performanceDescription } : {}),
        }),
        UNSIGNED,
      );
    } catch {
      return '';
    }
  }, [
    additionalFeesDescription,
    ceremonyEnd,
    ceremonyStart,
    client1Name,
    client2Name,
    cocktailEnd,
    cocktailStart,
    eventType,
    otherDetails,
    performanceDescription,
    preludeStart,
    privateEvent,
    summary,
    venueAddress,
    venueName,
    weddingDate,
  ]);

  const blocking = contracts.find((row) => row.status === 'sent' || row.status === 'viewed' || row.status === 'signed');
  const missingDetailMessage = missingCoupleDetailMessage({
    packageId,
    ceremonyEnd,
    venueName,
    venueAddress,
    ceremonyStart,
    cocktailStart,
    cocktailEnd,
  });
  const timeOrderMessage = performanceTimeOrderMessage({
    ceremonyStart,
    ceremonyEnd,
    cocktailStart: fullWedding || privateEvent ? '' : cocktailStart,
    cocktailEnd: fullWedding || privateEvent ? '' : cocktailEnd,
  });

  const send = async () => {
    if (!source) return;
    if (timeOrderMessage) {
      setError(timeOrderMessage);
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    const response = await fetch('/api/admin/contracts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leadId: source.leadId,
        bookingId: source.bookingId,
        packageId,
        travelFee,
        additionalFees,
        additionalFeesDescription: additionalFeesDescription.trim().slice(0, 80),
        discount: fullWedding ? '0' : discount,
        client1Name,
        client2Name,
        weddingDate,
        venueName,
        venueAddress,
        ceremonyStart,
        ceremonyEnd,
        cocktailStart,
        cocktailEnd,
        preludeStart,
        otherDetails,
        ...(privateEvent
          ? { performanceFee, eventType: eventType.trim(), performanceDescription: performanceDescription.trim(), cocktailStart: '', cocktailEnd: '', preludeStart: '' }
          : {}),
      }),
    });
    const payload = (await response.json()) as { error?: string; emailed?: boolean; signingUrl?: string; bookingCode?: string };
    if (!response.ok) {
      setError(payload.error || 'Could not send this agreement.');
      setBusy(false);
      return;
    }
    setSigningUrl(payload.signingUrl || '');
    setNotice(
      payload.emailed
        ? `Signing link emailed. Booking code ${payload.bookingCode}.`
        : `Agreement saved, but the email was not sent. Booking code ${payload.bookingCode}. Copy the signing link below.`,
    );
    setCreating(false);
    await reloadContracts(source);
    setBusy(false);
  };

  const postAction = async (path: string, body?: unknown) => {
    if (!source) return;
    setBusy(true);
    setError('');
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = (await response.json()) as { error?: string; emailed?: boolean; signingUrl?: string };
    if (!response.ok) setError(payload.error || 'Could not update this agreement.');
    else {
      if (payload.signingUrl) setSigningUrl(payload.signingUrl);
      setNotice(payload.emailed === false ? 'The email was not sent. Copy the signing link below.' : 'Saved.');
      await reloadContracts(source);
    }
    setBusy(false);
  };

  return (
    <section className="mt-6 rounded-xl bg-white p-6 shadow">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xl font-bold text-gray-900">Agreement</h3>
        {!blocking && !creating && (
          <button type="button" onClick={() => setCreating(true)} className="rounded-lg bg-blue-600 px-4 py-2 text-white">
            Create contract
          </button>
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

      {blocking && <ContractStatus row={blocking} busy={busy} musicianName={musicianName} onMusicianName={setMusicianName} onAction={postAction} />}

      {!blocking && contracts[0]?.status === 'void' && (
        <p className="mt-4 text-sm text-gray-600">The last agreement was voided. The booking code stays on the booking.</p>
      )}

      {creating && !blocking && (
        <div className="mt-4 space-y-4">
          <label className="block text-sm text-gray-700">
            Contract type / package
            <select className={`${fieldClass} mt-1`} value={packageId} onChange={(event) => setPackageId(event.target.value as PackageId)}>
              {(Object.keys(PACKAGES) as PackageId[]).map((id) => (
                <option key={id} value={id}>
                  {PACKAGES[id].customFee
                    ? `${PACKAGES[id].title} agreement (non-wedding) — fee entered below`
                    : `${PACKAGES[id].title} — $${formatMoney(PACKAGES[id].feeCents)}`}
                </option>
              ))}
            </select>
          </label>
          {privateEvent && (
            <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Private event agreement for birthdays, parties, corporate and other non-wedding events. Its wording is a draft pending approval.
            </p>
          )}
          {privateEvent && (
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Event type (e.g. Birthday party)" value={eventType} onChange={setEventType} />
              <Field label="Performance fee" value={performanceFee} onChange={setPerformanceFee} />
              <label className="block text-sm text-gray-700 md:col-span-2">
                Performance description (shown in section 1)
                <input
                  className={`${fieldClass} mt-1`}
                  value={performanceDescription}
                  maxLength={600}
                  placeholder="e.g. Solo violin, two hours of background music during dinner"
                  onChange={(event) => setPerformanceDescription(event.target.value)}
                />
              </label>
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Client 1" value={client1Name} onChange={setClient1Name} />
            <Field label="Client 2, if any" value={client2Name} onChange={setClient2Name} />
            <Field label={privateEvent ? 'Event date' : 'Wedding date'} value={weddingDate} onChange={setWeddingDate} type="date" />
            <Field label={privateEvent ? 'Event start' : 'Ceremony start'} value={ceremonyStart} onChange={setCeremonyStart} type="time" />
            <Field label="Venue name" value={venueName} onChange={setVenueName} />
            <Field label="Venue address" value={venueAddress} onChange={setVenueAddress} />
          </div>
          {privateEvent && (
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Event end" value={ceremonyEnd} onChange={setCeremonyEnd} type="time" />
              <label className="block text-sm text-gray-700">
                Other agreed performance details
                <input className={`${fieldClass} mt-1`} value={otherDetails} onChange={(event) => setOtherDetails(event.target.value)} />
              </label>
            </div>
          )}
          {!fullWedding && !privateEvent && (
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Prelude begins" value={preludeStart} onChange={setPreludeStart} type="time" />
              <Field label="Ceremony end" value={ceremonyEnd} onChange={setCeremonyEnd} type="time" />
              <Field label="Cocktail hour begins" value={cocktailStart} onChange={setCocktailStart} type="time" />
              <Field label="Cocktail hour ends" value={cocktailEnd} onChange={setCocktailEnd} type="time" />
              <label className="block text-sm text-gray-700 md:col-span-2">
                Other agreed performance details
                <input className={`${fieldClass} mt-1`} value={otherDetails} onChange={(event) => setOtherDetails(event.target.value)} />
              </label>
            </div>
          )}
          {fullWedding && (
            <p className="text-sm text-gray-600">
              The package fee is $3,000.00. A travel fee or additional fees (for example a holiday fee) are added to the total, and the retainer and balance are each 50% of that total. This agreement has no discount.
            </p>
          )}
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Travel fee" value={travelFee} onChange={setTravelFee} />
            <Field label="Additional fees" value={additionalFees} onChange={setAdditionalFees} />
            {!fullWedding && <Field label="Discount" value={discount} onChange={setDiscount} />}
          </div>
          <label className="block text-sm text-gray-700">
            Additional fees description (optional, shown in the agreement)
            <input
              className={`${fieldClass} mt-1`}
              value={additionalFeesDescription}
              maxLength={80}
              placeholder="e.g. New Year's Day holiday fee"
              onChange={(event) => setAdditionalFeesDescription(event.target.value)}
            />
          </label>
          <FeeReadout summary={'error' in summary ? null : summary} error={'error' in summary ? summary.error : ''} packageFee={'error' in summary ? PACKAGES[packageId].feeCents : summary.packageFeeCents} quotedPrice={source?.quotedPrice ?? null} />
          {preview && <ContractText className="max-h-96 overflow-auto md:max-h-96" text={preview} />}
          {missingDetailMessage ? <p className="rounded-lg bg-amber-50 px-4 py-3 text-amber-900">{missingDetailMessage}</p> : null}
          {timeOrderMessage ? <p className="rounded-lg bg-red-50 px-4 py-3 text-red-700">{timeOrderMessage}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy || !preview || Boolean(timeOrderMessage)} onClick={() => void send()} className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:bg-blue-400">
              {busy ? 'Sending...' : 'Send for signature'}
            </button>
            <button type="button" onClick={() => setCreating(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-gray-800">
              Close
            </button>
          </div>
          {!source?.bookingId && (
            <p className="text-sm text-gray-600">Sending creates a tentative booking when this lead does not have one, so the booking code has a place to live.</p>
          )}
        </div>
      )}
    </section>
  );
}

function dollars(value: string) {
  const trimmed = value.trim().replace(/[$,]/g, '');
  if (!trimmed) return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return -1;
  const [whole, frac = ''] = trimmed.split('.');
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'));
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block text-sm text-gray-700">
      {label}
      <input
        type={type}
        disabled={disabled}
        className={`${fieldClass} mt-1 disabled:bg-gray-100`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function FeeReadout({
  summary,
  error,
  packageFee,
  quotedPrice,
}: {
  summary: FeeSummary | null;
  error: string;
  packageFee: number;
  quotedPrice: number | null;
}) {
  if (!summary) return <p className="text-sm text-red-700">{error}</p>;
  return (
    <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-800">
      <p>Package fee ${formatMoney(packageFee)}</p>
      <p>Total ${formatMoney(summary.totalCents)}</p>
      <p>Retainer (50%) ${formatMoney(summary.retainerCents)}</p>
      <p>Balance (50%) ${formatMoney(summary.balanceCents)}</p>
      <p>Final payment due {summary.finalPaymentDueDate}</p>
      {quotedPrice != null && Math.round(quotedPrice * 100) !== summary.totalCents && (
        <p className="mt-2">The quote on this record is ${quotedPrice.toFixed(2)}. The agreement total is ${formatMoney(summary.totalCents)}.</p>
      )}
    </div>
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
  const waitingMessage = open && stored ? missingCoupleDetailMessage(stored) : '';
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
            <button type="button" disabled={busy} onClick={() => void onAction(`/api/admin/contracts/${row.id}/resend`)} className="rounded-lg border border-gray-300 px-4 py-2">
              Resend
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (window.confirm('Void this agreement? The signing link will stop working.')) void onAction(`/api/admin/contracts/${row.id}/void`);
              }}
              className="rounded-lg border border-red-300 px-4 py-2 text-red-700"
            >
              Void
            </button>
          </>
        )}
        {row.status === 'signed' && !row.musician_signed_at && (
          <>
            <input className={`${fieldClass} max-w-xs`} value={musicianName} onChange={(event) => onMusicianName(event.target.value)} />
            <button
              type="button"
              disabled={busy}
              onClick={() => void onAction(`/api/admin/contracts/${row.id}/countersign`, { name: musicianName })}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white"
            >
              Countersign
            </button>
          </>
        )}
        {row.status === 'signed' && (
          <a href={`/api/admin/contracts/${row.id}/pdf`} className="rounded-lg border border-gray-300 px-4 py-2">
            Download PDF
          </a>
        )}
      </div>
    </div>
  );
}
