import { PDFDocument, StandardFonts, type PDFFont } from 'pdf-lib';

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 54;
const FONT_SIZE = 10;
const LINE_HEIGHT = 13;

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

export async function renderContractPdf(text: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const maxWidth = PAGE_WIDTH - MARGIN * 2;
  const lines = pdfSafeText(text)
    .split('\n')
    .flatMap((paragraph) => wrapParagraph(paragraph, font, FONT_SIZE, maxWidth));

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;
  for (const line of lines) {
    if (y < MARGIN) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
    if (line) page.drawText(line, { x: MARGIN, y, size: FONT_SIZE, font });
    y -= LINE_HEIGHT;
  }
  doc.setTitle('Wedding music agreement');
  doc.setAuthor('Daniel Cimo');
  return doc.save();
}
