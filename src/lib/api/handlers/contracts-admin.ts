import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/require-admin-api';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateBookingCode, isBookingCode } from '@/lib/contracts/booking-code';
import { contractOwnerEmail } from '@/lib/contracts/mail';
import { centsToDollarString, computeFees, formatLongDate, formatMoney, parseDollarInput } from '@/lib/contracts/money';
import { isPackageId, packageDefinition } from '@/lib/contracts/packages';
import { feeSnapshot, normalizeStoredFields, performanceTimeOrderMessage, renderContract, signatureDateLabel } from '@/lib/contracts/render';
import { renderContractPdf } from '@/lib/contracts/pdf';
import { validateTypedName } from '@/lib/contracts/signers';
import { generateContractToken, isContractToken } from '@/lib/contracts/token';
import { runGoogleSync } from '@/lib/google/run';
import { BUSINESS_TIME_ZONE, todayInTimeZone } from '@/lib/schedule/time';
import {
  escapeHtml,
  publicOrigin,
  readContractPdf,
  sendContractMail,
  signingUrl,
  storeContractPdf,
} from '@/lib/contracts/delivery';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FEE_CAP_CENTS = 10_000_000;

type AdminClient = ReturnType<typeof createAdminClient>;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

async function requireAdmin() {
  const auth = await requireAdminApi();
  if (auth.response || !auth.session) return { session: null, response: auth.response, admin: null };
  try {
    return { session: auth.session, response: null, admin: createAdminClient() };
  } catch {
    return { session: null, response: json({ error: 'Could not save this agreement.' }, 500), admin: null };
  }
}

function uuidOrNull(value: unknown): string | null | undefined {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || !UUID.test(value)) return undefined;
  return value;
}

function plain(value: unknown, max: number): string | null {
  if (value == null) return '';
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length > max || /[\r\n]/.test(trimmed) || trimmed.includes('{{') || trimmed.includes('}}')) return null;
  return trimmed;
}

function clockOrBlank(value: unknown): string | null {
  const text = plain(value, 40);
  if (text == null) return null;
  if (!text) return '';
  if (/^\d{2}:\d{2}(?::\d{2})?$/.test(text)) return text.slice(0, 5);
  return text;
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

type ClientRow = { id: string; name: string; email: string | null; partner_name: string | null };
type LeadRow = {
  id: string;
  client_id: string | null;
  status: string;
  event_date: string | null;
  venue_name: string | null;
  venue_address: string | null;
  service_type: string | null;
  requested_services: string | null;
  package_interest: string | null;
  performance_start_time: string | null;
  performance_end_time: string | null;
  performers_needed: number | null;
  quoted_price: number | null;
  clients: ClientRow | ClientRow[] | null;
};
type BookingRow = {
  id: string;
  lead_id: string | null;
  client_id: string;
  status: string;
  event_date: string;
  venue_name: string | null;
  venue_address: string | null;
  service_type: string;
  performance_start_time: string | null;
  performance_end_time: string | null;
  performers_needed: number | null;
  booking_code: string | null;
};

function oneClient(value: LeadRow['clients']): ClientRow | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

async function loadClient(admin: AdminClient, clientId: string | null): Promise<ClientRow | null> {
  if (!clientId) return null;
  const { data } = await admin.from('clients').select('id, name, email, partner_name').eq('id', clientId).maybeSingle();
  return (data as ClientRow | null) ?? null;
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.session || !auth.admin) return auth.response;
  const admin = auth.admin;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: 'Could not read that request.' }, 400);
  }

  const leadId = uuidOrNull(body.leadId);
  const bookingIdInput = uuidOrNull(body.bookingId);
  if (leadId === undefined || bookingIdInput === undefined || (!leadId && !bookingIdInput)) {
    return json({ error: 'Open a lead or a booking before creating an agreement.' }, 400);
  }
  const packageId = typeof body.packageId === 'string' && isPackageId(body.packageId) ? body.packageId : null;
  if (!packageId) return json({ error: 'Choose a package.' }, 400);

  const travelFeeCents = parseDollarInput(body.travelFee);
  const additionalFeesCents = parseDollarInput(body.additionalFees);
  const discountCents = parseDollarInput(body.discount);
  if (travelFeeCents == null || additionalFeesCents == null || discountCents == null) {
    return json({ error: 'Enter fees as dollar amounts with at most two decimal places.' }, 400);
  }
  if ([travelFeeCents, additionalFeesCents, discountCents].some((cents) => cents > FEE_CAP_CENTS)) {
    return json({ error: 'Enter a fee of $100,000 or less.' }, 400);
  }

  const client1Name = plain(body.client1Name, 200);
  const client2Name = plain(body.client2Name, 200);
  const venueName = plain(body.venueName, 255);
  const venueAddress = plain(body.venueAddress, 500);
  const otherDetails = plain(body.otherDetails, 400);
  const ceremonyStart = clockOrBlank(body.ceremonyStart);
  const ceremonyEnd = clockOrBlank(body.ceremonyEnd);
  const cocktailStart = clockOrBlank(body.cocktailStart);
  const cocktailEnd = clockOrBlank(body.cocktailEnd);
  const preludeStart = clockOrBlank(body.preludeStart);
  const weddingDate = plain(body.weddingDate, 10);
  if (
    [client1Name, client2Name, venueName, venueAddress, otherDetails, ceremonyStart, ceremonyEnd, cocktailStart, cocktailEnd, preludeStart, weddingDate].includes(
      null,
    )
  ) {
    return json({ error: 'Check the names, date, and venue. Keep each one on a single line.' }, 400);
  }
  if (!client1Name) return json({ error: 'Enter the client name.' }, 400);
  if (!weddingDate) return json({ error: 'Add the wedding date. The balance is due 30 days before that date.' }, 400);
  const timeOrder = performanceTimeOrderMessage({
    ceremonyStart: ceremonyStart || '',
    ceremonyEnd: ceremonyEnd || '',
    cocktailStart: packageId === 'FULL' ? '' : cocktailStart || '',
    cocktailEnd: packageId === 'FULL' ? '' : cocktailEnd || '',
  });
  if (timeOrder) return json({ error: timeOrder }, 400);

  const loaded = await loadRecords(admin, leadId, bookingIdInput);
  if ('error' in loaded) return json({ error: loaded.error }, loaded.status);

  if (loaded.booking && loaded.booking.event_date !== weddingDate) {
    return json({ error: 'The wedding date on this agreement does not match the booking. Save the booking date first.' }, 400);
  }

  const summary = computeFees({
    packageId,
    travelFeeCents,
    additionalFeesCents,
    discountCents,
    weddingDateIso: weddingDate,
  });
  if ('error' in summary) return json({ error: summary.error }, 400);

  const fields = feeSnapshot(summary, {
    client1Name,
    client2Name: client2Name || '',
    weddingDateIso: weddingDate,
    venueName: venueName || '',
    venueAddress: venueAddress || '',
    ceremonyStart: ceremonyStart || '',
    ceremonyEnd: ceremonyEnd || '',
    cocktailStart: cocktailStart || '',
    cocktailEnd: cocktailEnd || '',
    preludeStart: preludeStart || '',
    otherDetails: otherDetails || '',
  });

  let preview = '';
  try {
    preview = renderContract(fields);
  } catch {
    return json({ error: 'This agreement could not be prepared.' }, 500);
  }
  if (preview.includes('{{')) return json({ error: 'This agreement could not be prepared.' }, 500);

  const email = (loaded.client.email || '').trim().toLowerCase();
  if (!validEmail(email)) return json({ error: 'Add an email address on the client before sending this agreement.' }, 400);

  let booking = loaded.booking;
  let createdBooking = false;
  if (!booking) {
    const created = await createTentativeBooking(admin, auth.session.id, {
      leadId: loaded.lead?.id ?? null,
      clientId: loaded.client.id,
      weddingDate,
      venueName: venueName || null,
      venueAddress: venueAddress || null,
      serviceType: loaded.lead?.requested_services || loaded.lead?.service_type || 'Wedding',
      ceremonyStart: ceremonyStart || null,
      ceremonyEnd: ceremonyEnd || null,
      performers: loaded.lead?.performers_needed || 1,
      totalCents: summary.totalCents,
    });
    if ('error' in created) return json({ error: created.error }, 409);
    booking = created.booking;
    createdBooking = true;
  } else if (booking.status === 'Cancelled') {
    return json({ error: 'This booking is cancelled. Restore it before sending an agreement.' }, 409);
  }

  const { data: active } = await admin
    .from('contracts')
    .select('id, status')
    .eq('booking_id', booking.id)
    .in('status', ['sent', 'viewed', 'signed'])
    .limit(1);
  if (active && active.length > 0) {
    const signed = active.some((row) => row.status === 'signed');
    return json(
      {
        error: signed
          ? 'This booking already has a signed agreement.'
          : 'Void the current agreement before sending another one.',
      },
      409,
    );
  }

  let bookingCode: string;
  try {
    bookingCode = await ensureBookingCode(admin, booking.id, booking.booking_code);
  } catch {
    return json({ error: 'Could not assign a booking code.' }, 500);
  }

  const today = todayInTimeZone(BUSINESS_TIME_ZONE);
  const { error: bookingMoneyError } = await admin
    .from('bookings')
    .update({
      total_price: centsToDollarString(summary.totalCents),
      retainer_amount: centsToDollarString(summary.retainerCents),
      retainer_due_date: today,
      balance_due_date: summary.finalPaymentDueDate,
      updated_at: new Date().toISOString(),
    })
    .eq('id', booking.id);
  if (bookingMoneyError) return json({ error: 'Could not save the amounts on the booking.' }, 500);

  const token = generateContractToken();
  const now = new Date().toISOString();
  const { data: inserted, error: insertError } = await admin
    .from('contracts')
    .insert({
      booking_id: booking.id,
      lead_id: booking.lead_id ?? loaded.lead?.id ?? null,
      status: 'sent',
      template_id: fields.templateId,
      package_id: fields.packageId,
      access_token: token,
      render_fields: fields,
      booking_code: bookingCode,
      package_fee_cents: summary.packageFeeCents,
      travel_fee_cents: summary.travelFeeCents,
      additional_fees_cents: summary.additionalFeesCents,
      discount_cents: summary.discountCents,
      total_cents: summary.totalCents,
      retainer_cents: summary.retainerCents,
      balance_cents: summary.balanceCents,
      final_payment_due_on: summary.finalPaymentDueDate,
      sent_at: now,
      updated_at: now,
    })
    .select('id')
    .single();

  if (insertError || !inserted) {
    return json({ error: 'Could not save this agreement.' }, 500);
  }
  const contractId = inserted.id as string;

  const { error: voidOpenError } = await admin
    .from('payment_obligations')
    .update({ status: 'void', updated_at: now })
    .eq('booking_id', booking.id)
    .eq('status', 'open');
  const { error: obligationError } = await admin.from('payment_obligations').insert([
    {
      booking_id: booking.id,
      contract_id: contractId,
      booking_code: bookingCode,
      kind: 'retainer',
      amount_cents: summary.retainerCents,
      status: 'open',
      due_on: today,
    },
    {
      booking_id: booking.id,
      contract_id: contractId,
      booking_code: bookingCode,
      kind: 'balance',
      amount_cents: summary.balanceCents,
      status: 'open',
      due_on: summary.finalPaymentDueDate,
    },
  ]);
  if (voidOpenError || obligationError) {
    await admin.from('contracts').delete().eq('id', contractId);
    return json({ error: 'Could not save the retainer and balance for this booking.' }, 500);
  }

  const leadIdForStatus = booking.lead_id ?? loaded.lead?.id ?? null;
  try {
    if (leadIdForStatus) {
      await admin.from('leads').update({ contract_status: 'Sent', updated_at: now }).eq('id', leadIdForStatus);
      const leadStatus = loaded.lead?.status;
      if (leadStatus && ['New Inquiry', 'Needs Information', 'Quote Sent', 'Awaiting Response'].includes(leadStatus)) {
        await admin.rpc('sync_booking_and_lead', {
          p_action: 'set_lead_status',
          p_booking_id: null,
          p_lead_id: leadIdForStatus,
          p_status: 'Contract Sent',
          p_reason: null,
          p_actor: auth.session.id,
          p_fields: {},
        });
      }
    }
    await admin.from('activity_events').insert({
      lead_id: leadIdForStatus,
      booking_id: booking.id,
      event_type: 'contract',
      title: 'Agreement sent for signature',
      body: `${packageDefinition(packageId).title}. Booking code ${bookingCode}. Retainer $${formatMoney(summary.retainerCents)}.`,
      metadata: { contract_id: contractId, booking_code: bookingCode },
      created_by: auth.session.id,
    });
  } catch {
    // The agreement row is already saved.
  }

  const url = signingUrl(publicOrigin(request), token);
  const emailed = await sendContractMail({
    to: email,
    subject: 'Please sign your wedding music agreement',
    html: signingEmailHtml(loaded.client.name || client1Name, url, bookingCode, summary.retainerCents),
  });
  if (emailed) {
    await admin.from('activity_events').insert({
      lead_id: leadIdForStatus,
      booking_id: booking.id,
      event_type: 'email',
      title: 'Signing link emailed',
      body: `Sent to ${email}.`,
      metadata: { contract_id: contractId },
      created_by: auth.session.id,
    }).then(undefined, () => undefined);
  }

  if (createdBooking) {
    try {
      await runGoogleSync();
    } catch {
      // The booking is saved. Google can catch up on the next sync.
    }
  }

  return json({
    ok: true,
    contractId,
    bookingId: booking.id,
    bookingCode,
    emailed,
    signingUrl: url,
  });
}

function signingEmailHtml(name: string, url: string, bookingCode: string, retainerCents: number) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <p>Hello ${escapeHtml(name)},</p>
      <p>Daniel Cimo sent a wedding music agreement for you to read and sign.</p>
      <p><a href="${escapeHtml(url)}">Read and sign the agreement</a></p>
      <p>Your booking code is ${escapeHtml(bookingCode)}. The retainer is $${escapeHtml(formatMoney(retainerCents))}.</p>
      <p>Reply to this email if you have a question.</p>
    </div>
  `;
}

async function loadRecords(admin: AdminClient, leadId: string | null, bookingId: string | null) {
  let booking: BookingRow | null = null;
  let lead: LeadRow | null = null;
  if (bookingId) {
    const { data, error } = await admin.from('bookings').select('*').eq('id', bookingId).maybeSingle();
    if (error || !data) return { error: 'Could not find that booking.', status: 404 as const };
    booking = data as BookingRow;
    if (leadId && booking.lead_id && booking.lead_id !== leadId) {
      return { error: 'That booking belongs to a different lead.', status: 400 as const };
    }
  }
  const resolvedLeadId = leadId || booking?.lead_id || null;
  if (resolvedLeadId) {
    const { data, error } = await admin.from('leads').select('*, clients(*)').eq('id', resolvedLeadId).maybeSingle();
    if (error || !data) return { error: 'Could not find that lead.', status: 404 as const };
    lead = data as LeadRow;
  }
  if (!booking && resolvedLeadId) {
    const { data } = await admin
      .from('bookings')
      .select('*')
      .eq('lead_id', resolvedLeadId)
      .neq('status', 'Cancelled')
      .order('created_at', { ascending: false })
      .limit(1);
    booking = ((data as BookingRow[] | null) ?? [])[0] ?? null;
  }
  const client = oneClient(lead?.clients ?? null) || (await loadClient(admin, booking?.client_id ?? lead?.client_id ?? null));
  if (!client) return { error: 'Add a client before sending this agreement.', status: 400 as const };
  return { booking, lead, client };
}

async function createTentativeBooking(
  admin: AdminClient,
  actorId: string,
  input: {
    leadId: string | null;
    clientId: string;
    weddingDate: string;
    venueName: string | null;
    venueAddress: string | null;
    serviceType: string;
    ceremonyStart: string | null;
    ceremonyEnd: string | null;
    performers: number;
    totalCents: number;
  },
) {
  const performers = input.performers >= 1 && input.performers <= 12 ? input.performers : 1;
  const { data, error } = await admin.rpc('sync_booking_and_lead', {
    p_action: 'apply_booking',
    p_booking_id: null,
    p_lead_id: input.leadId,
    p_status: 'Tentative',
    p_reason: null,
    p_actor: actorId,
    p_fields: {
      client_id: input.clientId,
      lead_id: input.leadId,
      event_date: input.weddingDate,
      venue_name: input.venueName,
      venue_address: input.venueAddress,
      service_type: input.serviceType || 'Wedding',
      performance_start_time: input.ceremonyStart,
      performance_end_time: input.ceremonyEnd,
      performers_needed: performers,
      total_price: centsToDollarString(input.totalCents),
    },
  });
  if (error) {
    const line = error.message?.split('\n')[0]?.replace(/^ERROR:\s*/i, '').trim();
    return { error: line || 'Could not create a booking for this agreement.' };
  }
  const bookingId = (data as { booking_id?: string } | null)?.booking_id;
  if (!bookingId) return { error: 'Could not create a booking for this agreement.' };
  const { data: booking, error: loadError } = await admin.from('bookings').select('*').eq('id', bookingId).maybeSingle();
  if (loadError || !booking) return { error: 'Could not create a booking for this agreement.' };
  return { booking: booking as BookingRow };
}

async function ensureBookingCode(admin: AdminClient, bookingId: string, current: string | null) {
  if (current && isBookingCode(current)) return current;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateBookingCode();
    const { data, error } = await admin
      .from('bookings')
      .update({ booking_code: code, updated_at: new Date().toISOString() })
      .eq('id', bookingId)
      .is('booking_code', null)
      .select('booking_code')
      .maybeSingle();
    if (!error && data?.booking_code) return data.booking_code as string;
    if (error && error.code !== '23505') throw error;
    const { data: again } = await admin.from('bookings').select('booking_code').eq('id', bookingId).maybeSingle();
    if (again?.booking_code) return again.booking_code as string;
  }
  throw new Error('Could not assign a booking code.');
}

type ActionRow = {
  id: string;
  lead_id: string | null;
  booking_id: string | null;
  status: string;
  access_token: string | null;
  render_fields: unknown;
  signed_text: string | null;
  executed_text: string | null;
  photo_opt_out: boolean;
  client1_name: string | null;
  client2_name: string | null;
  signed_at: string | null;
  musician_signed_at: string | null;
  pdf_storage_path: string | null;
  booking_code: string | null;
  retainer_cents: number | null;
  balance_cents: number | null;
  final_payment_due_on: string | null;
};

async function loadContract(admin: AdminClient, id: string): Promise<ActionRow | null> {
  if (!UUID.test(id)) return null;
  const { data } = await admin
    .from('contracts')
    .select(
      'id, lead_id, booking_id, status, access_token, render_fields, signed_text, executed_text, photo_opt_out, client1_name, client2_name, signed_at, musician_signed_at, pdf_storage_path, booking_code, retainer_cents, balance_cents, final_payment_due_on',
    )
    .eq('id', id)
    .maybeSingle();
  return (data as ActionRow | null) ?? null;
}

export async function postVoid(_request: Request, id: string) {
  const auth = await requireAdmin();
  if (!auth.session || !auth.admin) return auth.response;
  const row = await loadContract(auth.admin, id);
  if (!row) return json({ error: 'Could not find that agreement.' }, 404);
  if (row.status === 'signed') return json({ error: 'A signed agreement cannot be voided.' }, 409);
  if (row.status === 'void') return json({ ok: true, status: 'void' });
  if (row.status !== 'sent' && row.status !== 'viewed') return json({ error: 'This agreement cannot be voided.' }, 409);

  const now = new Date().toISOString();
  const { data: updated } = await auth.admin
    .from('contracts')
    .update({ status: 'void', voided_at: now, updated_at: now })
    .eq('id', row.id)
    .in('status', ['sent', 'viewed'])
    .select('id')
    .maybeSingle();
  if (!updated) return json({ error: 'This agreement cannot be voided.' }, 409);

  await auth.admin
    .from('payment_obligations')
    .update({ status: 'void', updated_at: now })
    .eq('contract_id', row.id)
    .eq('status', 'open');
  if (row.lead_id) {
    await auth.admin.from('leads').update({ contract_status: 'Not Sent', updated_at: now }).eq('id', row.lead_id);
  }
  await auth.admin.from('activity_events').insert({
    lead_id: row.lead_id,
    booking_id: row.booking_id,
    event_type: 'contract',
    title: 'Agreement voided',
    body: row.booking_code ? `Booking code ${row.booking_code} stays on the booking.` : null,
    metadata: { contract_id: row.id },
    created_by: auth.session.id,
  });
  return json({ ok: true, status: 'void' });
}

export async function postResend(request: Request, id: string) {
  const auth = await requireAdmin();
  if (!auth.session || !auth.admin) return auth.response;
  const row = await loadContract(auth.admin, id);
  if (!row) return json({ error: 'Could not find that agreement.' }, 404);
  if (row.status !== 'sent' && row.status !== 'viewed') {
    return json({ error: 'Only an agreement that is waiting for a signature can be resent.' }, 409);
  }
  if (!row.access_token || !isContractToken(row.access_token)) {
    return json({ error: 'This agreement has no signing link.' }, 409);
  }
  const client = await clientForContract(auth.admin, row);
  if (!client?.email || !validEmail(client.email)) {
    return json({ error: 'Add an email address on the client before resending this agreement.' }, 400);
  }
  const url = signingUrl(publicOrigin(request), row.access_token);
  const emailed = await sendContractMail({
    to: client.email.trim().toLowerCase(),
    subject: 'Please sign your wedding music agreement',
    html: signingEmailHtml(
      client.name || 'there',
      url,
      row.booking_code || '',
      row.retainer_cents ?? 0,
    ),
  });
  const now = new Date().toISOString();
  await auth.admin.from('contracts').update({ sent_at: now, updated_at: now }).eq('id', row.id);
  await auth.admin.from('activity_events').insert({
    lead_id: row.lead_id,
    booking_id: row.booking_id,
    event_type: 'email',
    title: emailed ? 'Signing link resent' : 'Signing link could not be emailed',
    body: client.email,
    metadata: { contract_id: row.id },
    created_by: auth.session.id,
  });
  return json({ ok: true, emailed, signingUrl: url });
}

export async function postCountersign(request: Request, id: string) {
  const auth = await requireAdmin();
  if (!auth.session || !auth.admin) return auth.response;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: 'Could not read that request.' }, 400);
  }
  const name = typeof body.name === 'string' ? body.name : '';
  if (validateTypedName(name)) return json({ error: 'Enter your full legal name to countersign.' }, 400);

  const row = await loadContract(auth.admin, id);
  if (!row) return json({ error: 'Could not find that agreement.' }, 404);
  if (row.status !== 'signed' || !row.signed_at) return json({ error: 'The client has not signed this agreement yet.' }, 409);
  if (row.musician_signed_at) return json({ error: 'This agreement is already countersigned.' }, 409);
  const fields = normalizeStoredFields(row.render_fields);
  if (!fields || !row.client1_name) return json({ error: 'This agreement could not be countersigned.' }, 500);

  const clientSignedOn = formatLongDate(todayInTimeZone(BUSINESS_TIME_ZONE, new Date(row.signed_at)));
  const musicianOn = signatureDateLabel();
  const executed = renderContract(fields, {
    client1SignedName: row.client1_name,
    client2SignedName: row.client2_name || '',
    signedOn: clientSignedOn,
    photoOptOut: row.photo_opt_out,
    musicianSignedName: name.trim(),
    musicianSignedOn: musicianOn,
  });
  const now = new Date().toISOString();
  const { data: updated } = await auth.admin
    .from('contracts')
    .update({
      executed_text: executed,
      musician_signed_name: name.trim(),
      musician_signed_at: now,
      updated_at: now,
    })
    .eq('id', row.id)
    .eq('status', 'signed')
    .is('musician_signed_at', null)
    .select('id')
    .maybeSingle();
  if (!updated) return json({ error: 'This agreement is already countersigned.' }, 409);

  const pdfBytes = await storeContractPdf(row.id, executed, {
    clientSignedAt: row.signed_at,
    musicianSignedAt: now,
  });
  const client = await clientForContract(auth.admin, row);
  const attachment = pdfBytes
    ? [{ filename: 'wedding-agreement.pdf', content: Buffer.from(pdfBytes).toString('base64') }]
    : undefined;
  const html = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><p>The wedding music agreement is now signed by both parties. The PDF is attached.</p><p>Daniel Cimo</p></div>`;
  if (client?.email) {
    await sendContractMail({ to: client.email, subject: 'Executed wedding music agreement', html, attachments: attachment });
  }
  const owner = contractOwnerEmail();
  if (!client?.email || owner.toLowerCase() !== client.email.toLowerCase()) {
    await sendContractMail({ to: owner, subject: 'Executed wedding music agreement', html, attachments: attachment });
  }
  await auth.admin.from('activity_events').insert({
    lead_id: row.lead_id,
    booking_id: row.booking_id,
    event_type: 'contract',
    title: 'Musician signature added',
    body: name.trim(),
    metadata: { contract_id: row.id },
    created_by: auth.session.id,
  });
  return json({ ok: true, musicianSigned: true });
}

export async function getPdf(_request: Request, id: string) {
  const auth = await requireAdmin();
  if (!auth.session || !auth.admin) return auth.response;
  const row = await loadContract(auth.admin, id);
  if (!row) return json({ error: 'Could not find that agreement.' }, 404);
  const text = row.executed_text || row.signed_text;
  if (!text) return json({ error: 'The signed PDF is not ready yet.' }, 404);

  let bytes: Uint8Array | null = null;
  try {
    bytes = await renderContractPdf(text, {
      clientSignedAt: row.signed_at,
      musicianSignedAt: row.musician_signed_at,
    });
  } catch (error) {
    console.error('Contract PDF failed', error instanceof Error ? error.name : 'unknown');
    bytes = null;
  }
  if (!bytes && row.pdf_storage_path) bytes = await readContractPdf(row.pdf_storage_path);
  if (!bytes) return json({ error: 'The PDF could not be prepared.' }, 500);

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="wedding-agreement.pdf"',
      'Cache-Control': 'no-store',
    },
  });
}

async function clientForContract(admin: AdminClient, row: ActionRow): Promise<ClientRow | null> {
  if (row.booking_id) {
    const { data } = await admin.from('bookings').select('client_id').eq('id', row.booking_id).maybeSingle();
    const client = await loadClient(admin, (data?.client_id as string | undefined) ?? null);
    if (client) return client;
  }
  if (row.lead_id) {
    const { data } = await admin.from('leads').select('client_id').eq('id', row.lead_id).maybeSingle();
    return loadClient(admin, (data?.client_id as string | undefined) ?? null);
  }
  return null;
}
