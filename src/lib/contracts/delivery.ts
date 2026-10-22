import 'server-only';
import { Resend } from 'resend';
import { createAdminClient } from '@/lib/supabase/admin';
import { contractFromAddress, contractReplyTo } from './mail';
import { renderContractPdf } from './pdf';

export function publicOrigin(request: Request): string {
  const configured = process.env.CONTRACT_PUBLIC_ORIGIN?.trim();
  if (configured) return configured.replace(/\/$/, '');
  const host = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() ?? '';
  const proto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'https';
  if (/^[a-z0-9.-]+(?::\d+)?$/i.test(host)) return `${proto}://${host}`;
  return new URL(request.url).origin;
}

export function signingUrl(origin: string, token: string): string {
  return `${origin}/contract?t=${encodeURIComponent(token)}`;
}

export function requestClientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
  const ip = forwarded || request.headers.get('x-real-ip')?.trim() || '';
  if (!ip) return null;
  return ip.slice(0, 64);
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export async function sendContractMail(input: {
  to: string | string[];
  subject: string;
  html: string;
  attachments?: { filename: string; content: string }[];
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = contractFromAddress();
  if (!key || !from) return false;
  try {
    const resend = new Resend(key);
    const { error } = await resend.emails.send({
      from,
      to: input.to,
      replyTo: contractReplyTo(),
      subject: input.subject,
      html: input.html,
      attachments: input.attachments,
    });
    if (error) {
      console.error('Contract email failed');
      return false;
    }
    return true;
  } catch (error) {
    console.error('Contract email failed', error instanceof Error ? error.name : 'unknown');
    return false;
  }
}

export async function storeContractPdf(contractId: string, text: string): Promise<Uint8Array | null> {
  try {
    const bytes = await renderContractPdf(text);
    const path = `${contractId}.pdf`;
    const admin = createAdminClient();
    const { error } = await admin.storage.from('contracts').upload(path, Buffer.from(bytes), {
      contentType: 'application/pdf',
      upsert: true,
    });
    if (error) {
      console.error('Contract PDF upload failed');
      return null;
    }
    const { error: updateError } = await admin
      .from('contracts')
      .update({
        pdf_storage_path: path,
        contract_url: path,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contractId);
    if (updateError) {
      console.error('Contract PDF path was not saved');
      return null;
    }
    return bytes;
  } catch (error) {
    console.error('Contract PDF failed', error instanceof Error ? error.name : 'unknown');
    return null;
  }
}

export async function readContractPdf(path: string): Promise<Uint8Array | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.storage.from('contracts').download(path);
    if (error || !data) return null;
    return new Uint8Array(await data.arrayBuffer());
  } catch {
    return null;
  }
}
