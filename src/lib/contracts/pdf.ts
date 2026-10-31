import { readFileSync } from 'node:fs';
import path from 'node:path';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib';
import { contractBlocks, signerRoleFor } from './layout';
import { formatElectronicSignature, isRecordedSignatureName, type ContractSegment, type SignatureTimes } from './signature-style';

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

type Fonts = { body: PDFFont; bold: PDFFont; script: PDFFont; oblique: PDFFont };

function drawWrapped(
  doc: PDFDocument,
  state: DrawState,
  text: string,
  font: PDFFont,
  size: number,
  options: { indent?: number; center?: boolean; lineHeight?: number } = {},
): DrawState {
  const indent = options.indent ?? 0;
  const lineHeight = options.lineHeight ?? LINE_HEIGHT;
  const width = PAGE_WIDTH - MARGIN * 2 - indent;
  let current = state;
  for (const part of wrapParagraph(pdfSafeText(text), font, size, width)) {
    current = ensure(doc, current, lineHeight);
    if (part) {
      const x = options.center ? (PAGE_WIDTH - font.widthOfTextAtSize(part, size)) / 2 : MARGIN + indent;
      current.page.drawText(part, { x, y: current.y, size, font, color: INK });
    }
    current = { page: current.page, y: current.y - lineHeight };
  }
  return current;
}

/** "Label: value" with a bold label; the value wraps under itself. */
function drawField(doc: PDFDocument, state: DrawState, label: string, value: string, fonts: Fonts): DrawState {
  const labelText = `${pdfSafeText(label)}: `;
  const labelWidth = fonts.bold.widthOfTextAtSize(labelText, FONT_SIZE);
  const maxWidth = PAGE_WIDTH - MARGIN * 2;
  const safeValue = pdfSafeText(value);
  const firstWidth = maxWidth - labelWidth;
  let current = ensure(doc, state, LINE_HEIGHT);
  if (firstWidth < 120) {
    current.page.drawText(labelText, { x: MARGIN, y: current.y, size: FONT_SIZE, font: fonts.bold, color: INK });
    current = { page: current.page, y: current.y - LINE_HEIGHT };
    return drawWrapped(doc, current, safeValue, fonts.body, FONT_SIZE, { indent: 12 });
  }
  const words = safeValue.split(/\s+/).filter(Boolean);
  let first = '';
  while (words.length > 0) {
    const next = first ? `${first} ${words[0]}` : words[0] ?? '';
    if (fonts.body.widthOfTextAtSize(next, FONT_SIZE) > firstWidth && first) break;
    first = next;
    words.shift();
  }
  current.page.drawText(labelText, { x: MARGIN, y: current.y, size: FONT_SIZE, font: fonts.bold, color: INK });
  if (first) current.page.drawText(first, { x: MARGIN + labelWidth, y: current.y, size: FONT_SIZE, font: fonts.body, color: INK });
  current = { page: current.page, y: current.y - LINE_HEIGHT };
  if (words.length > 0) current = drawWrapped(doc, current, words.join(' '), fonts.body, FONT_SIZE, { indent: 12 });
  return current;
}

/**
 * PDF of the locked agreement text, laid out like the owner's original document:
 * centered bold title, bold numbered sections, lists, and bold labels.
 * Signature names are drawn in Dancing Script, with the signer's Pacific-time line underneath.
 * The text argument is not modified.
 */
export async function renderContractPdf(text: string, times: SignatureTimes = {}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const body = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const oblique = await doc.embedFont(StandardFonts.HelveticaOblique);
  const script = await doc.embedFont(loadScriptFont(), { subset: true });
  const fonts: Fonts = { body, bold, script, oblique };
  let state = newPage(doc);
  let role: 'client' | 'musician' | null = null;
  let title = 'Wedding music agreement';

  for (const block of contractBlocks(text)) {
    switch (block.kind) {
      case 'title':
        title = block.text;
        state = drawWrapped(doc, state, block.text, bold, 15, { center: true, lineHeight: 19 });
        state = { page: state.page, y: state.y - 6 };
        break;
      case 'heading':
        role = null;
        state = ensure(doc, state, LINE_HEIGHT * 3);
        state = { page: state.page, y: state.y - 8 };
        state = drawWrapped(doc, state, block.text, bold, 11.5, { lineHeight: 15 });
        state = { page: state.page, y: state.y - 2 };
        break;
      case 'subheading': {
        const signer = signerRoleFor(block.text);
        if (signer) {
          role = signer;
          state = ensure(doc, state, LINE_HEIGHT * 5);
          state = { page: state.page, y: state.y - 6 };
        }
        state = drawWrapped(doc, state, block.text, bold, FONT_SIZE);
        break;
      }
      case 'gap':
        state = { page: state.page, y: state.y - 4 };
        break;
      case 'list':
        for (const item of block.items) {
          state = ensure(doc, state, LINE_HEIGHT);
          state.page.drawText('-', { x: MARGIN + 6, y: state.y, size: FONT_SIZE, font: body, color: INK });
          state = drawWrapped(doc, state, item, body, FONT_SIZE, { indent: 18 });
        }
        break;
      case 'paragraph':
        state = drawWrapped(doc, state, block.text, body, FONT_SIZE);
        state = { page: state.page, y: state.y - 3 };
        break;
      case 'field': {
        const value = block.value.trim();
        if (block.label === 'Signature' && role && isRecordedSignatureName(value)) {
          const segment: Extract<ContractSegment, { type: 'signature' }> = {
            type: 'signature',
            sourceLine: block.text,
            name: value,
            role,
            caption: formatElectronicSignature(role === 'musician' ? times.musicianSignedAt : times.clientSignedAt),
            newline: '\n',
          };
          state = drawSignature(doc, state, segment, body, script, oblique);
        } else {
          state = drawField(doc, state, block.label, block.value, fonts);
        }
        break;
      }
    }
  }

  doc.setTitle(title);
  doc.setAuthor('Daniel Cimo');
  return doc.save();
}
