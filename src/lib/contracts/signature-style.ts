import { BUSINESS_TIME_ZONE } from '@/lib/schedule/time';

/**
 * How a locked agreement's signature lines are drawn.
 * signed_text, executed_text, and their hash stay the plain source text.
 * Nothing in this module is written back to the contract.
 */
export type SignatureTimes = {
  clientSignedAt?: string | null;
  musicianSignedAt?: string | null;
};

export type SignatureRole = 'client' | 'musician';

export type ContractSegment =
  | { type: 'text'; text: string }
  | {
      type: 'signature';
      /** The plain line from the locked agreement, such as "Signature: Alex Rivera". */
      sourceLine: string;
      name: string;
      role: SignatureRole;
      /** Empty when that signer has no stored timestamp. */
      caption: string;
      /** The line break that followed the source line, if there was one. */
      newline: string;
    };

const SIGNATURE_LINE = /^Signature:[ \t]*(.*)$/;

/** A blank signature line is underscores. A typed legal name is not. */
export function isRecordedSignatureName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length > 0 && !/^_+$/.test(trimmed);
}

/**
 * "Signed electronically Oct 29, 2026, 9:22 AM PT".
 * The clock is Pacific time. The label is always PT.
 */
export function formatElectronicSignature(iso: string | null | undefined, timeZone = BUSINESS_TIME_ZONE): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  const month = value('month');
  const day = value('day');
  const year = value('year');
  const hour = value('hour');
  const minute = value('minute');
  const period = value('dayPeriod').replace(/\./g, '').toUpperCase();
  if (!month || !day || !year || !hour || !minute || (period !== 'AM' && period !== 'PM')) return '';
  return `Signed electronically ${month} ${day}, ${year}, ${hour}:${minute} ${period} PT`;
}

function signerRole(line: string): SignatureRole | null {
  if (line === 'Musician' || line === 'Musician / Service Provider') return 'musician';
  if (line === 'Client' || line === 'Client 1' || line.startsWith('Client 2')) return 'client';
  return null;
}

function captionFor(role: SignatureRole, times: SignatureTimes): string {
  return formatElectronicSignature(role === 'musician' ? times.musicianSignedAt : times.clientSignedAt);
}

/** Split locked agreement text into body text and signature lines. The source text round-trips. */
export function presentSignedContract(text: string, times: SignatureTimes = {}): ContractSegment[] {
  const lines = text.split('\n');
  const segments: ContractSegment[] = [];
  let role: SignatureRole | null = null;
  let buffer = '';

  const flush = () => {
    if (!buffer) return;
    segments.push({ type: 'text', text: buffer });
    buffer = '';
  };

  lines.forEach((line, index) => {
    const newline = index < lines.length - 1 ? '\n' : '';
    const heading = signerRole(line);
    if (heading) role = heading;
    const match = SIGNATURE_LINE.exec(line);
    const name = match?.[1]?.trim() ?? '';
    if (!match || !role || !isRecordedSignatureName(name)) {
      buffer += line + newline;
      return;
    }
    flush();
    segments.push({
      type: 'signature',
      sourceLine: line,
      name,
      role,
      caption: captionFor(role, times),
      newline,
    });
  });
  flush();
  return segments;
}

/** The locked agreement text, rebuilt from presentation segments. Captions are not included. */
export function contractSourceText(segments: ContractSegment[]): string {
  return segments.map((segment) => (segment.type === 'text' ? segment.text : segment.sourceLine + segment.newline)).join('');
}
