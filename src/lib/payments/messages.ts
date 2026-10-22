import { formatLongDate, formatMoney } from '@/lib/contracts/money';
import {
  ZELLE_QR_ALT,
  ZELLE_QR_CAPTION,
  zelleInstructionLine,
} from './zelle-config';

export function moneyLabel(cents: number): string {
  return `$${formatMoney(cents)}`;
}

export function dueLabel(isoDate: string | null): string {
  if (!isoDate) return '';
  return formatLongDate(isoDate);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function zelleQrEmailHtml(emailUrl: string | null): string {
  if (!emailUrl) return '';
  return `<figure style="margin: 16px 0;">
    <img src="${escapeHtml(emailUrl)}" alt="${ZELLE_QR_ALT}" width="220" style="max-width: 220px; height: auto;" />
    <figcaption style="color: #4b5563;">${ZELLE_QR_CAPTION}</figcaption>
  </figure>`;
}

export function paymentInstructionsHtml(input: {
  heading: string;
  instruction: string;
  payUrl: string | null;
  qrEmailUrl: string | null;
  note?: string;
}): string {
  const link = input.payUrl
    ? `<p>Or pay by bank account or card from this page: <a href="${escapeHtml(input.payUrl)}">${escapeHtml(input.payUrl)}</a></p>`
    : '';
  const note = input.note ? `<p>${escapeHtml(input.note)}</p>` : '';
  return `<h2>${escapeHtml(input.heading)}</h2>
    <p>${escapeHtml(input.instruction)}</p>
    ${zelleQrEmailHtml(input.qrEmailUrl)}
    ${link}
    ${note}`;
}

export function confirmationEmail(input: {
  name: string;
  bookingCode: string;
  amountPaidCents: number;
  balanceCents: number;
  balanceDueOn: string | null;
  bookingConfirmed: boolean;
  recipientName: string;
  recipientContact: string;
  payUrl: string | null;
  qrEmailUrl: string | null;
}): { subject: string; html: string } {
  const balanceLabel = moneyLabel(input.balanceCents);
  const due = dueLabel(input.balanceDueOn);
  const balanceSentence =
    input.balanceCents > 0
      ? `The remaining balance of ${balanceLabel} is due ${due || '30 days before the wedding'}.`
      : 'There is no remaining balance on this agreement.';
  const confirmed = input.bookingConfirmed ? ' Your booking is confirmed.' : '';
  const instruction =
    input.balanceCents > 0
      ? zelleInstructionLine({
          recipientName: input.recipientName,
          recipientContact: input.recipientContact,
          amountLabel: balanceLabel,
          bookingCode: input.bookingCode,
        })
      : '';
  const balanceBlock =
    input.balanceCents > 0
      ? paymentInstructionsHtml({
          heading: 'How to pay the balance',
          instruction,
          payUrl: input.payUrl,
          qrEmailUrl: input.qrEmailUrl,
        })
      : '';
  return {
    subject: `Your wedding music retainer is paid (${input.bookingCode})`,
    html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <p>Hello ${escapeHtml(input.name || 'there')},</p>
      <p>We received your retainer of ${escapeHtml(moneyLabel(input.amountPaidCents))}. Booking code ${escapeHtml(input.bookingCode)}.${escapeHtml(confirmed)}</p>
      <p>${escapeHtml(balanceSentence)}</p>
      ${balanceBlock}
      <p>Daniel Cimo</p>
    </div>`,
  };
}

export function receiptEmail(input: {
  name: string;
  bookingCode: string;
  amountPaidCents: number;
}): { subject: string; html: string } {
  return {
    subject: `Payment receipt for your wedding music balance (${input.bookingCode})`,
    html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <p>Hello ${escapeHtml(input.name || 'there')},</p>
      <p>We received your balance of ${escapeHtml(moneyLabel(input.amountPaidCents))}. Booking code ${escapeHtml(input.bookingCode)}.</p>
      <p>This was the remaining balance. Nothing further is due on this agreement.</p>
      <p>Daniel Cimo</p>
    </div>`,
  };
}

export function processingEmail(input: {
  name: string;
  bookingCode: string;
  amountCents: number;
  kind: 'retainer' | 'balance';
}): { subject: string; html: string } {
  const which = input.kind === 'retainer' ? 'retainer' : 'balance';
  const later =
    input.kind === 'retainer'
      ? 'Your booking is confirmed once this bank payment succeeds. We will email you then.'
      : 'We will email your receipt once this bank payment succeeds.';
  return {
    subject: `We received your bank payment (${input.bookingCode})`,
    html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <p>Hello ${escapeHtml(input.name || 'there')},</p>
      <p>We received a bank payment of ${escapeHtml(moneyLabel(input.amountCents))} for your ${which}. Booking code ${escapeHtml(input.bookingCode)}.</p>
      <p>Banks often take a few business days to clear this kind of payment. This note is not the receipt.</p>
      <p>${later}</p>
      <p>Daniel Cimo</p>
    </div>`,
  };
}

export function failedPaymentEmail(input: {
  name: string;
  bookingCode: string;
  amountCents: number;
  payUrl: string | null;
  recipientName: string;
  recipientContact: string;
}): { subject: string; html: string } {
  const instruction = zelleInstructionLine({
    recipientName: input.recipientName,
    recipientContact: input.recipientContact,
    amountLabel: moneyLabel(input.amountCents),
    bookingCode: input.bookingCode,
  });
  const link = input.payUrl ? ` You can also pay from ${input.payUrl}.` : '';
  return {
    subject: `Bank payment did not go through (${input.bookingCode})`,
    html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <p>Hello ${escapeHtml(input.name || 'there')},</p>
      <p>The bank payment of ${escapeHtml(moneyLabel(input.amountCents))} did not go through. That amount is still open.</p>
      <p>${escapeHtml(instruction + link)}</p>
      <p>Daniel Cimo</p>
    </div>`,
  };
}

export function ownerUnmatchedEmail(input: {
  senderName: string;
  amountCents: number;
  sentOn: string | null;
  memo: string;
  code: string | null;
  transactionNumber: string;
  reason: string;
}): { subject: string; html: string } {
  return {
    subject: 'Zelle payment needs a booking match',
    html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <p>A Chase Zelle payment has a booking code and did not match an open retainer or balance.</p>
      <p>From: ${escapeHtml(input.senderName || 'Unknown')}</p>
      <p>Amount: ${escapeHtml(moneyLabel(input.amountCents))}</p>
      <p>Sent on: ${escapeHtml(input.sentOn || 'Unknown')}</p>
      <p>Memo: ${escapeHtml(input.memo || 'None')}</p>
      <p>Code read from the memo: ${escapeHtml(input.code || 'None')}</p>
      <p>Transaction number: ${escapeHtml(input.transactionNumber)}</p>
      <p>Reason: ${escapeHtml(input.reason)}</p>
      <p>It is in Admin → Payments until you assign it.</p>
    </div>`,
  };
}

export function ownerConflictEmail(input: {
  bookingCode: string;
  amountCents: number;
  detail: string;
}): { subject: string; html: string } {
  return {
    subject: `Retainer paid, booking not confirmed (${input.bookingCode})`,
    html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <p>A retainer of ${escapeHtml(moneyLabel(input.amountCents))} was recorded for ${escapeHtml(input.bookingCode)}, and the couple was emailed.</p>
      <p>The booking was not moved to Confirmed. ${escapeHtml(input.detail)}</p>
    </div>`,
  };
}

/**
 * A thank-you note after the wedding is not sent.
 * The Hobby plan already uses its daily cron for Google Calendar sync.
 * Do not add a second cron. A later change can send these from that existing
 * daily job if the owner wants them.
 */
export const THANK_YOU_EMAIL_TODO =
  'Thank-you email after the wedding is not sent. It needs the existing daily job; no new cron was added.';
