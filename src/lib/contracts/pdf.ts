import { readFileSync } from 'node:fs';
import path from 'node:path';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib';
import { presentSignedContract, type ContractSegment, type SignatureTimes } from './signature-style';

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 54;
const FONT_SIZE = 10;
const LINE_HEIGHT = 13;
const SCRIPT_SIZE = 22;
const CAPTION_SIZE = 8.5;
const INK = rgb(0.06, 0.07, 0.09);
const CAPTION_INK = rgb(0.22, 0.25, 0.32);

const SCRIPT_FONT_PATH = path.join(process.cwd(), 'src/lib/contracts/fonts/DancingScript-Variable.ttf');

let scriptFontBytes: Uint8Array | null = null;

function loadScriptFont(): Uint8Array {
  if (!scriptFontBytes) scriptFontBytes = readFileSync(SCRIPT_FONT_PATH);
  return scriptFontBytes;
}

/** Standard PDF fonts cannot draw the agreement's checkbox and dash characters. */
export function pdfSafeText(text: string): string {
  const mapped = text
    .replaceAll('\u2014', ' - ')
    .replaceAll('\u2013', '-')
    .replaceAll('\u2212', '-')
    .replaceAll('\u2610', '[ ]')
    .replaceAll('\u2611', '[X]')
    .replaceAll('\u2019', "'")
    .replaceAll('\u2018', "'")
    .replaceAll('\u201c', '"')
    .replaceAll('\u201d', '"')
    .replaceAll('\u00a0', ' ');
  let safe = '';
  for (const char of mapped) {
    const code = char.charCodeAt(0);
    if (code === 10 || (code >= 32 && code <= 126)) safe += char;
  }
  return safe;
}

function wrapParagraph(text: string, font: PDFFont, size: number, width: number): string[] {
  if (!text) return [''];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= width) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
}

/** Drop the separator after the last line so it is not drawn as a blank line. */
function bodyLines(text: string): string[] {
  if (!text) return [];
  const parts = text.split('\n');
  if (text.endsWith('\n')) parts.pop();
  return parts;
}

function measure(font: PDFFont, text: string, size: number): number | null {
  try {
    return font.widthOfTextAtSize(text, size);
  } catch {
    return null;
  }
}

function wrapScript(text: string, font: PDFFont, size: number, width: number): string[] | null {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    const nextWidth = measure(font, next, size);
    if (nextWidth == null) return null;
    if (nextWidth <= width) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
  }
  if (current) lines.push(current);
  return lines;
}

type DrawState = { page: PDFPage; y: number };

function newPage(doc: PDFDocument): DrawState {
  return { page: doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]), y: PAGE_HEIGHT - MARGIN };
}

function ensure(doc: PDFDocument, state: DrawState, needed: number): DrawState {
  if (state.y - needed >= MARGIN) return state;
  return newPage(doc);
}

function drawBody(doc: PDFDocument, state: DrawState, text: string, font: PDFFont): DrawState {
  const maxWidth = PAGE_WIDTH - MARGIN * 2;
  let current = state;
  for (const line of bodyLines(text)) {
    for (const part of wrapParagraph(pdfSafeText(line), font, FONT_SIZE, maxWidth)) {
      current = ensure(doc, current, LINE_HEIGHT);
      if (part) current.page.drawText(part, { x: MARGIN, y: current.y, size: FONT_SIZE, font, color: INK });
      current = { page: current.page, y: current.y - LINE_HEIGHT };
    }
  }
  return current;
}

function drawSignature(
  doc: PDFDocument,
  state: DrawState,
  segment: Extract<ContractSegment, { type: 'signature' }>,
  body: PDFFont,
  script: PDFFont,
  oblique: PDFFont,
): DrawState {
  const maxWidth = PAGE_WIDTH - MARGIN * 2;
  const label = 'Signature: ';
  const labelWidth = body.widthOfTextAtSize(label, FONT_SIZE);
  const nameWidth = Math.max(48, maxWidth - labelWidth);
  let scriptSize = SCRIPT_SIZE;
  let scriptLines = measure(script, segment.name, scriptSize) == null ? null : wrapScript(segment.name, script, scriptSize, nameWidth);
  while (scriptLines && scriptLines.length > 1 && scriptSize > 16) {
    scriptSize -= 1;
    scriptLines = wrapScript(segment.name, script, scriptSize, nameWidth);
  }
  const scriptReady = scriptLines != null && scriptLines.length > 0 ? scriptLines : null;
  const nameLines = scriptReady ?? wrapParagraph(pdfSafeText(segment.name), oblique, 13, nameWidth);
  const nameSize = scriptReady ? scriptSize : 13;
  const nameFont = scriptReady ? script : oblique;
  const lineGap = nameSize * 1.05;
  const ascent = scriptReady ? 12 : 2;
  const captionDrop = segment.caption ? 22 : 0;
  const needed = ascent + nameLines.length * lineGap + captionDrop + 16;
  let current = ensure(doc, state, needed);
  current = { page: current.page, y: current.y - ascent };

  const nameX = MARGIN + labelWidth;
  current.page.drawText(label, { x: MARGIN, y: current.y + 6, size: FONT_SIZE, font: body, color: INK });
  nameLines.forEach((line, index) => {
    if (index > 0) current = { page: current.page, y: current.y - lineGap };
    const width = nameFont.widthOfTextAtSize(line, nameSize);
    current.page.drawText(line, { x: nameX, y: current.y, size: nameSize, font: nameFont, color: INK });
    current.page.drawLine({
      start: { x: nameX, y: current.y - 7 },
      end: { x: nameX + Math.max(width, 88), y: current.y - 7 },
      thickness: 0.7,
      color: INK,
    });
  });

  if (segment.caption) {
    current = { page: current.page, y: current.y - captionDrop };
    current.page.drawText(segment.caption, {
      x: nameX,
      y: current.y,
      size: CAPTION_SIZE,
      font: body,
      color: CAPTION_INK,
    });
  }

  return { page: current.page, y: current.y - 16 };
}

/**
 * PDF of the locked agreement text.
 * Signature names are drawn in Dancing Script, with the signer's Pacific-time line underneath.
 * The text argument is not modified.
 */
export async function renderContractPdf(text: string, times: SignatureTimes = {}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const body = await doc.embedFont(StandardFonts.Helvetica);
  const oblique = await doc.embedFont(StandardFonts.HelveticaOblique);
  const script = await doc.embedFont(loadScriptFont(), { subset: true });
  let state = newPage(doc);

  for (const segment of presentSignedContract(text, times)) {
    state = segment.type === 'text' ? drawBody(doc, state, segment.text, body) : drawSignature(doc, state, segment, body, script, oblique);
  }

  doc.setTitle('Wedding music agreement');
  doc.setAuthor('Daniel Cimo');
  return doc.save();
}
