import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cleanPracticeTips,
  downloadExtension,
  fileExtension,
  practiceTipsError,
  validateScoreFile,
  validateSheetMusicFile,
  TUNE_FILE_MAX_BYTES,
} from './tune-files';

test('sheet music accepts a PDF inside the size limit', () => {
  assert.equal(validateSheetMusicFile({ name: 'Cook in the Kitchen.pdf', size: 1200 }), null);
  assert.equal(validateSheetMusicFile({ name: 'notes.mscz', size: 1200 }), 'Sheet music must be a PDF.');
  assert.match(validateSheetMusicFile({ name: 'big.pdf', size: TUNE_FILE_MAX_BYTES + 1 }) ?? '', /20 MB/);
  assert.equal(fileExtension('folder/Song.PDF'), '.pdf');
});

test('MuseScore uploads accept mscz, mxl, and musicxml only', () => {
  assert.equal(validateScoreFile({ name: 'tune.mscz', size: 500 }), null);
  assert.equal(validateScoreFile({ name: 'tune.MXL', size: 500 }), null);
  assert.equal(validateScoreFile({ name: 'tune.musicxml', size: 500 }), null);
  assert.match(validateScoreFile({ name: 'tune.pdf', size: 500 }) ?? '', /mscz/);
  assert.match(validateScoreFile({ name: 'tune.xml', size: 500 }) ?? '', /mscz/);
  assert.equal(fileExtension('../secret.mscz'), '.mscz');
  assert.equal(downloadExtension('https://example.blob.vercel-storage.com/cook.mscz?download=1'), '.mscz');
  assert.equal(downloadExtension('/docs/cook-in-the-kitchen.pdf'), '.pdf');
});

test('practice tips keep line breaks and reject a too-long note', () => {
  assert.equal(cleanPracticeTips('  Watch the\r\nsecond finger. \u0000'), 'Watch the\nsecond finger.');
  assert.equal(practiceTipsError('a'.repeat(2000)), null);
  assert.match(practiceTipsError('a'.repeat(2001)) ?? '', /2000/);
});
