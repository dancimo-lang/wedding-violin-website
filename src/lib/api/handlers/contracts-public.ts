import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { applyCoupleEventDetails, coupleCocktailRecordLine, coupleSuppliedSummary } from '@/lib/contracts/event-details';
import { contractOwnerEmail } from '@/lib/contracts/mail';
import { formatLongDate, formatMoney } from '@/lib/contracts/money';
import {
  normalizeStoredFields,
  renderContract,
  signatureDateLabel,
  type CoupleDetailKey,
  type SignatureOverlay,
  type StoredRenderFields,
} from '@/lib/contracts/render';
import { runGoogleSync } from '@/lib/google/run';
import { signOnce } from '@/lib/contracts/sign';
import { validateSignature } from '@/lib/contracts/signers';
import { isContractToken } from '@/lib/contracts/token';
import { escapeHtml, publicOrigin, requestClientIp, sendContractMail, storeContractPdf } from '@/lib/contracts/delivery';
import { paymentInstructionsHtml } from '@/lib/payments/messages';
import { paymentPageUrl } from '@/lib/payments/urls';
import { zelleInstructionLine, zelleRecipientContact, zelleRecipientName } from '@/lib/payments/zelle-config';
import { zelleQrSources } from '@/lib/payments/zelle-qr';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const OPEN_STATUSES = new Set(['sent', 'viewed']);

function noStore(body: unknown, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

function invalidLink() {
  return noStore({ error: 'This signing link is not valid.' }, 404);
}

type ContractRecord = {
  id: string;
  lead_id: string | null;
  booking_id: string | null;
  status: string;
  access_token: string | null;
  render_fields: unknown;
  signed_text: string | null;
  executed_text: string | null;
  content_sha256: string | null;
  photo_opt_out: boolean;
  client1_name: string | null;
  client2_name: string | null;
  signed_at: string | null;
  musician_signed_name: string | null;
  musician_signed_at: string | null;
  booking_code: string | null;
  retainer_cents: number | null;
  balance_cents: number | null;
  final_payment_due_on: string | null;
};

async function contractByToken(token: string): Promise<ContractRecord | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('contracts')
    .select(
      'id, lead_id, booking_id, status, access_token, render_fields, signed_text, executed_text, content_sha256, photo_opt_out, client1_name, client2_name, signed_at, musician_signed_name, musician_signed_at, booking_code, retainer_cents, balance_cents, final_payment_due_on',
    )
    .eq('access_token', token)
    .maybeSingle();
  if (error || !data) return null;
  return data as ContractRecord;
}

function paymentPayload(row: ContractRecord) {
  return {
    bookingCode: row.booking_code,
    retainerCents: row.retainer_cents,
    balanceCents: row.balance_cents,
    retainer: row.retainer_cents == null ? null : `$${formatMoney(row.retainer_cents)}`,
    balance: row.balance_cents == null ? null : `$${formatMoney(row.balance_cents)}`,
    finalPaymentDueDate: row.final_payment_due_on,
    finalPaymentDueLabel: row.final_payment_due_on ? formatLongDate(row.final_payment_due_on) : '',
  };
}

function viewPayload(row: ContractRecord, text: string) {
  const canSign = OPEN_STATUSES.has(row.status);
  return {
    status: row.status,
    canSign,
    text,
    renderFields: canSign ? normalizeStoredFields(row.render_fields) : null,
    photoOptOut: row.photo_opt_out,
    client1Name: row.client1_name,
    client2Name: row.client2_name,
    musicianSigned: Boolean(row.musician_signed_at),
    ...paymentPayload(row),
  };
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('t')?.trim() ?? '';
  if (!isContractToken(token)) return invalidLink();

  let row: ContractRecord | null;
  try {
    row = await contractByToken(token);
  } catch {
    return noStore({ error: 'This signing link could not be opened.' }, 500);
  }
  if (!row || !row.access_token || !isContractToken(row.access_token)) return invalidLink();

  const fields = normalizeStoredFields(row.render_fields);
  if (!fields && !row.signed_text) return noStore({ error: 'This signing link could not be opened.' }, 500);

  if (row.status === 'sent') {
    try {
      const admin = createAdminClient();
      await admin
        .from('contracts')
        .update({ status: 'viewed', viewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', row.id)
        .eq('status', 'sent');
      row = { ...row, status: 'viewed' };
    } catch {
      // Showing the agreement does not depend on recording the view.
    }
  }

  const text =
    row.executed_text ||
    row.signed_text ||
    (fields ? renderContract(fields) : '');
  return noStore(viewPayload(row, text));
}

function shortRecordError(message: string): string {
  const line = message.split('\n')[0]?.replace(/^ERROR:\s*/i, '').trim() ?? '';
  if (!line || line.length > 240) return 'The lead or booking could not be updated with those details.';
  return `The lead or booking could not be updated with those details. ${line}`;
}

async function appendRecordLine(
  admin: ReturnType<typeof createAdminClient>,
  table: 'leads' | 'bookings',
  id: string,
  column: 'message' | 'special_requests',
  line: string,
): Promise<string> {
  const { data, error } = await admin.from(table).select(column).eq('id', id).maybeSingle();
  if (error || !data) return 'The lead or booking could not be updated with those details.';
  const raw = (data as Record<string, unknown>)[column];
  const current = typeof raw === 'string' ? raw.trim() : '';
  if (current.includes(line)) return '';
  const next = current ? `${current}\n${line}` : line;
  const { error: updateError } = await admin
    .from(table)
    .update({ [column]: next, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (updateError) return shortRecordError(updateError.message);
  return '';
}

/** Writes couple-entered details onto the lead and booking. Cocktail times have no column, so they are appended as one sentence. */
async function copyCoupleDetailsToRecords(
  admin: ReturnType<typeof createAdminClient>,
  row: ContractRecord,
  fields: StoredRenderFields,
  supplied: CoupleDetailKey[],
): Promise<string> {
  const patch: { venue_name?: string; venue_address?: string; performance_start_time?: string; updated_at: string } = {
    updated_at: new Date().toISOString(),
  };
  if (supplied.includes('venueName')) patch.venue_name = fields.venueName;
  if (supplied.includes('venueAddress')) patch.venue_address = fields.venueAddress;
  if (supplied.includes('ceremonyStart')) patch.performance_start_time = fields.ceremonyStart;
  const cocktailLine = coupleCocktailRecordLine(fields, supplied);
  const hasColumns = Object.keys(patch).length > 1;
  if (!hasColumns && !cocktailLine) return '';

  const warnings: string[] = [];
  if (hasColumns && row.booking_id && UUID.test(row.booking_id)) {
    const { error } = await admin.from('bookings').update(patch).eq('id', row.booking_id);
    if (error) warnings.push(shortRecordError(error.message));
  }
  if (hasColumns && row.lead_id && UUID.test(row.lead_id)) {
    const { error } = await admin.from('leads').update(patch).eq('id', row.lead_id);
    if (error) warnings.push(shortRecordError(error.message));
  }
  if (cocktailLine && row.booking_id && UUID.test(row.booking_id)) {
    warnings.push(await appendRecordLine(admin, 'bookings', row.booking_id, 'special_requests', cocktailLine));
  }
  if (cocktailLine && row.lead_id && UUID.test(row.lead_id)) {
    warnings.push(await appendRecordLine(admin, 'leads', row.lead_id, 'message', cocktailLine));
  }
  return warnings.find(Boolean) ?? '';
}

async function clientEmail(leadId: string | null, bookingId: string | null): Promise<{ email: string | null; name: string | null }> {
  const admin = createAdminClient();
  let clientId: string | null = null;
  if (bookingId && UUID.test(bookingId)) {
    const { data } = await admin.from('bookings').select('client_id').eq('id', bookingId).maybeSingle();
    clientId = (data?.client_id as string | undefined) ?? null;
  }
  if (!clientId && leadId && UUID.test(leadId)) {
    const { data } = await admin.from('leads').select('client_id').eq('id', leadId).maybeSingle();
    clientId = (data?.client_id as string | undefined) ?? null;
  }
  if (!clientId) return { email: null, name: null };
  const { data } = await admin.from('clients').select('email, name').eq('id', clientId).maybeSingle();
  const email = typeof data?.email === 'string' ? data.email.trim() : '';
  const name = typeof data?.name === 'string' ? data.name.trim() : '';
  return { email: email || null, name: name || null };
}

async function noteSigned(row: ContractRecord) {
  if (!row.lead_id) return;
  const admin = createAdminClient();
  await admin.from('leads').update({ contract_status: 'Signed', updated_at: new Date().toISOString() }).eq('id', row.lead_id);
  const { data: lead } = await admin.from('leads').select('status').eq('id', row.lead_id).maybeSingle();
  const status = typeof lead?.status === 'string' ? lead.status : '';
  if (!['New Inquiry', 'Needs Information', 'Quote Sent', 'Awaiting Response', 'Contract Sent'].includes(status)) return;
  const { data: owner } = await admin.from('admins').select('user_id').limit(1).maybeSingle();
  const actor = typeof owner?.user_id === 'string' ? owner.user_id : null;
  if (!actor) return;
  await admin.rpc('sync_booking_and_lead', {
    p_action: 'set_lead_status',
    p_booking_id: null,
    p_lead_id: row.lead_id,
    p_status: 'Awaiting Retainer',
    p_reason: null,
    p_actor: actor,
    p_fields: {},
  });
}

function signedEmailHtml(name: string, facts: ReturnType<typeof paymentPayload>, instructions: string) {
  const who = escapeHtml(name || 'there');
  const retainer = escapeHtml(facts.retainer || '');
  const code = escapeHtml(facts.bookingCode || '');
  const balance = facts.balance && facts.finalPaymentDueLabel
    ? `<p>The remaining balance of ${escapeHtml(facts.balance)} is due ${escapeHtml(facts.finalPaymentDueLabel)}.</p>`
    : '';
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <p>Hello ${who},</p>
      <p>Your signed wedding music agreement is attached.</p>
      <p>Retainer due: ${retainer}</p>
      <p>Booking code: ${code}</p>
      ${instructions}
      ${balance}
      <p>Daniel Cimo</p>
    </div>
  `;
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return noStore({ error: 'Could not read that request.' }, 400);
  }

  const token = typeof body.token === 'string' ? body.token.trim() : '';
  if (!isContractToken(token)) return invalidLink();

  const signatureError = validateSignature({
    client1Name: typeof body.client1Name === 'string' ? body.client1Name : '',
    client2Name: typeof body.client2Name === 'string' ? body.client2Name : '',
    agreed: body.agreed === true,
  });
  if (signatureError) return noStore({ error: signatureError }, 400);

  let row: ContractRecord | null;
  try {
    row = await contractByToken(token);
  } catch {
    return noStore({ error: 'This agreement could not be signed.' }, 500);
  }
  if (!row) return invalidLink();

  const fields = normalizeStoredFields(row.render_fields);
  if (!fields) return noStore({ error: 'This agreement could not be signed.' }, 500);

  const applied = applyCoupleEventDetails(fields, body.eventDetails === undefined ? {} : body.eventDetails);
  if (!applied.ok) return noStore({ error: applied.error }, 400);
  const signedFields = applied.fields;

  const client1Name = (typeof body.client1Name === 'string' ? body.client1Name : '').trim();
  const client2Name = (typeof body.client2Name === 'string' ? body.client2Name : '').trim();
  const photoOptOut = body.photoOptOut === true;
  const signedOn = signatureDateLabel();
  const overlay: SignatureOverlay = {
    client1SignedName: client1Name,
    client2SignedName: client2Name,
    signedOn,
    photoOptOut,
    musicianSignedName: '',
    musicianSignedOn: '',
  };
  let rendered = '';
  try {
    rendered = renderContract(signedFields, overlay);
  } catch {
    return noStore({ error: 'This agreement could not be signed.' }, 500);
  }

  const decision = signOnce(
    { status: row.status as 'draft' | 'sent' | 'viewed' | 'signed' | 'void', signedText: row.signed_text, contentSha256: row.content_sha256 },
    rendered,
  );
  if (!decision.ok) return noStore({ error: decision.error }, decision.httpStatus);

  let auto = false;
  try {
    const admin = createAdminClient();
    const { data: settings } = await admin
      .from('business_settings')
      .select('auto_countersign_contracts')
      .eq('id', 1)
      .maybeSingle();
    auto = settings?.auto_countersign_contracts === true;
  } catch {
    auto = false;
  }

  const now = new Date();
  const nowIso = now.toISOString();
  let executed: string | null = null;
  let musicianName: string | null = null;
  let musicianAt: string | null = null;
  if (auto) {
    musicianName = 'Daniel Cimo';
    musicianAt = nowIso;
    executed = renderContract(signedFields, {
      ...overlay,
      musicianSignedName: musicianName,
      musicianSignedOn: signedOn,
    });
  }

  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from('contracts')
    .update({
      status: 'signed',
      render_fields: signedFields,
      signed_text: decision.signedText,
      content_sha256: decision.contentSha256,
      executed_text: executed,
      photo_opt_out: photoOptOut,
      client1_name: client1Name,
      client2_name: client2Name || null,
      signed_at: nowIso,
      client_signed_ip: requestClientIp(request),
      client_signed_user_agent: request.headers.get('user-agent')?.slice(0, 500) ?? null,
      musician_signed_name: musicianName,
      musician_signed_at: musicianAt,
      updated_at: nowIso,
    })
    .eq('id', row.id)
    .in('status', ['sent', 'viewed'])
    .select('id, lead_id, booking_id, booking_code, retainer_cents, balance_cents, final_payment_due_on, status, photo_opt_out, client1_name, client2_name, musician_signed_at')
    .maybeSingle();

  if (error || !updated) {
    return noStore({ error: 'This agreement is already signed.' }, 409);
  }

  const signedRow = { ...row, ...(updated as Partial<ContractRecord>), status: 'signed' } as ContractRecord;
  const pdfText = executed ?? decision.signedText;
  const pdfBytes = await storeContractPdf(row.id, pdfText);

  const facts = paymentPayload(signedRow);
  const qr = zelleQrSources();
  const instructions = paymentInstructionsHtml({
    heading: 'Next: pay your retainer',
    instruction: facts.bookingCode
      ? zelleInstructionLine({
          recipientName: zelleRecipientName(),
          recipientContact: zelleRecipientContact(),
          amountLabel: facts.retainer || '',
          bookingCode: facts.bookingCode,
        })
      : 'The booking code will be on your payment page.',
    payUrl: row.access_token ? paymentPageUrl(publicOrigin(request), row.access_token) : null,
    qrEmailUrl: qr.emailUrl,
  });
  const client = await clientEmail(row.lead_id, row.booking_id);
  const owner = contractOwnerEmail();
  const attachment = pdfBytes
    ? [{ filename: 'wedding-agreement.pdf', content: Buffer.from(pdfBytes).toString('base64') }]
    : undefined;
  const html = signedEmailHtml(client.name || client1Name, facts, instructions);
  if (client.email) {
    await sendContractMail({
      to: client.email,
      subject: 'Your signed wedding music agreement',
      html,
      attachments: attachment,
    });
  }
  if (owner && owner.toLowerCase() !== (client.email || '').toLowerCase()) {
    await sendContractMail({
      to: owner,
      subject: `Signed wedding music agreement${facts.bookingCode ? ` (${facts.bookingCode})` : ''}`,
      html,
      attachments: attachment,
    });
  }

  let recordWarning = '';
  try {
    recordWarning = await copyCoupleDetailsToRecords(admin, signedRow, signedFields, applied.supplied);
  } catch {
    recordWarning = 'The lead or booking could not be updated with those details.';
  }

  try {
    const suppliedNote = coupleSuppliedSummary(signedFields);
    const signedLine = photoOptOut
      ? 'The client signed and opted out of promotional photographs and video.'
      : 'The client signed the agreement.';
    await admin.from('activity_events').insert({
      lead_id: row.lead_id,
      booking_id: row.booking_id,
      event_type: 'contract',
      title: 'Agreement signed',
      body: [signedLine, suppliedNote, recordWarning].filter(Boolean).join(' '),
      metadata: {
        contract_id: row.id,
        photo_opt_out: photoOptOut,
        couple_supplied: Object.fromEntries(applied.supplied.map((key) => [key, signedFields[key]])),
      },
    });
    await noteSigned(signedRow);
    if (applied.supplied.some((key) => key === 'venueName' || key === 'venueAddress' || key === 'ceremonyStart')) {
      await runGoogleSync();
    }
  } catch {
    // The signature is already stored.
  }

  return noStore({
    ok: true,
    status: 'signed',
    text: pdfText,
    signedOn,
    musicianSigned: Boolean(musicianAt),
    ...facts,
  });
}
