import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { isPdfBytes, sheetBytesLocation } from './sheet-pdf';

const gMajor = 'https://ugfju9x0pntxe4et.public.blob.vercel-storage.com/g-major-scale.pdf';
const cook = 'https://ugfju9x0pntxe4et.public.blob.vercel-storage.com/cook-in-the-kitchen.pdf';

test('live sheet music URLs are fetched directly, not through this site', () => {
  assert.deepEqual(sheetBytesLocation(gMajor), { kind: 'remote', url: gMajor });
  assert.deepEqual(sheetBytesLocation(cook), { kind: 'remote', url: cook });
  assert.deepEqual(sheetBytesLocation('/docs/cook-in-the-kitchen.pdf'), {
    kind: 'file',
    relative: 'docs/cook-in-the-kitchen.pdf',
  });
  assert.equal(sheetBytesLocation('../secret.pdf'), null);
  assert.equal(sheetBytesLocation('javascript:alert(1)'), null);
});

test('the PDF route does not ask its own /api/tunes URL for the file location', () => {
  const source = fs.readFileSync(new URL('./api/handlers/pdf.ts', import.meta.url), 'utf8');
  assert.equal(source.includes('/api/tunes'), false);
  assert.equal(source.includes('sheetBytesLocation'), true);
});

test('a PDF starts with the %PDF marker', () => {
  assert.equal(isPdfBytes(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])), true);
  assert.equal(isPdfBytes(new TextEncoder().encode('<!DOCTYPE html>')), false);
});
