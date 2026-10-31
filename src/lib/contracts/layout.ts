/**
 * Reading layout for agreement text. The stored text stays plain (it is hashed);
 * this only decides how each line is drawn on the page, in the PDF, and in email.
 */
export type ContractBlock =
  | { kind: 'title'; text: string }
  | { kind: 'heading'; text: string }
  | { kind: 'subheading'; text: string }
  | { kind: 'field'; label: string; value: string; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'paragraph'; text: string }
  | { kind: 'gap' };

const HEADING = /^\d{1,2}\.\s+\S/;
const FIELD = /^([A-Z][^:]{0,60}):[ \t](.*)$/;
const FIELD_EMPTY = /^([A-Z][^:]{0,60}):$/;
const PACKAGE_TITLE = /^Package [A-Z]:\s.+/;
const SMALL_WORDS = new Set(['and', 'by', 'of', 'or', 'the', 'if', 'applicable)', '(if', '&', '/', 'to', 'for', 'a']);
const NOT_SUBHEADINGS = new Set(['Daniel Cimo']);

function isHeading(line: string): boolean {
  return HEADING.test(line) && line.length <= 90 && !/[.:;,]$/.test(line);
}

function looksLikeSubheading(line: string): boolean {
  if (!line || line.length > 60 || /[.:;,]$/.test(line) || line.includes(': ') || NOT_SUBHEADINGS.has(line)) return false;
  if (!/^[A-Z]/.test(line)) return false;
  return line.split(/\s+/).every((word) => SMALL_WORDS.has(word.toLowerCase()) || /^[A-Z0-9(]/.test(word));
}

function endsSentence(line: string): boolean {
  return /[.!?]["')]?$/.test(line);
}

export function contractBlocks(text: string): ContractBlock[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  const blocks: ContractBlock[] = [];
  let seenHeading = false;
  let titleDone = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();
    if (!trimmed) {
      if (blocks.length > 0 && blocks[blocks.length - 1]?.kind !== 'gap') blocks.push({ kind: 'gap' });
      continue;
    }
    if (!titleDone) {
      titleDone = true;
      blocks.push({ kind: 'title', text: trimmed });
      continue;
    }
    if (isHeading(trimmed)) {
      seenHeading = true;
      blocks.push({ kind: 'heading', text: trimmed });
      continue;
    }
    if (!seenHeading) {
      // Parties block: labels on their own line, then "Label: value" lines.
      if ((FIELD_EMPTY.test(trimmed) && trimmed.length <= 32) || trimmed === 'Musician / Service Provider') {
        blocks.push({ kind: 'subheading', text: trimmed });
        continue;
      }
      const field = FIELD.exec(trimmed);
      if (field) {
        blocks.push({ kind: 'field', label: field[1] ?? '', value: field[2] ?? '', text: trimmed });
        continue;
      }
      blocks.push({ kind: 'paragraph', text: trimmed });
      continue;
    }
    if (PACKAGE_TITLE.test(trimmed)) {
      blocks.push({ kind: 'subheading', text: trimmed });
      continue;
    }
    if (trimmed.endsWith(':') && !FIELD.test(trimmed)) {
      // A lead-in line such as "Includes:" starts a list of the lines that follow.
      blocks.push(FIELD_EMPTY.test(trimmed) && trimmed.length <= 20 ? { kind: 'subheading', text: trimmed } : { kind: 'paragraph', text: trimmed });
      const items: string[] = [];
      let sentenceStyle: boolean | null = null;
      while (i + 1 < lines.length) {
        const next = (lines[i + 1] ?? '').trim();
        if (!next || isHeading(next) || PACKAGE_TITLE.test(next) || next.endsWith(':') || FIELD.test(next)) break;
        if (items.length > 0 && looksLikeSubheading(next) && sentenceStyle) break;
        const style = endsSentence(next);
        if (sentenceStyle === null) sentenceStyle = style;
        else if (style !== sentenceStyle) break;
        items.push(next);
        i += 1;
      }
      const following = (lines[i + 1] ?? '').trim();
      if (items.length === 1 && looksLikeSubheading(items[0] ?? '') && following.endsWith(':')) {
        blocks.push({ kind: 'subheading', text: items[0] ?? '' });
      } else if (items.length > 0) {
        blocks.push({ kind: 'list', items });
      }
      continue;
    }
    const field = FIELD.exec(trimmed);
    if (field) {
      blocks.push({ kind: 'field', label: field[1] ?? '', value: field[2] ?? '', text: trimmed });
      continue;
    }
    if (looksLikeSubheading(trimmed)) {
      blocks.push({ kind: 'subheading', text: trimmed });
      // Short unpunctuated lines under a topic heading (e.g. "Audio & Sound Support") read as a list.
      if (!signerRoleFor(trimmed)) {
        const items: string[] = [];
        while (i + 1 < lines.length) {
          const next = (lines[i + 1] ?? '').trim();
          if (!next || isHeading(next) || endsSentence(next) || next.endsWith(':') || FIELD.test(next) || looksLikeSubheading(next)) break;
          items.push(next);
          i += 1;
        }
        if (items.length > 0) blocks.push({ kind: 'list', items });
      }
      continue;
    }
    blocks.push({ kind: 'paragraph', text: trimmed });
  }
  return blocks;
}

/** Signer heading in the signature section, or null. */
export function signerRoleFor(text: string): 'client' | 'musician' | null {
  if (text === 'Musician' || text === 'Musician / Service Provider') return 'musician';
  if (text === 'Client' || text === 'Client 1' || text.startsWith('Client 2')) return 'client';
  return null;
}
