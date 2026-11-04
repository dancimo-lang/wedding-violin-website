import assert from 'node:assert/strict';
import test from 'node:test';
import { customSongsNote, emptyCustomSongs, normalizeCustomSongs, readCustomSongsNote } from './custom-songs';

test('custom songs stay three single lines and do not invent text', () => {
  assert.deepEqual(emptyCustomSongs(), ['', '', '']);
  assert.deepEqual(normalizeCustomSongs(['  Ave Maria\nSchubert  ', 'A', 'B', 'C']), ['Ave Maria Schubert', 'A', 'B']);
  assert.equal(normalizeCustomSongs(['x'.repeat(200)])[0].length, 160);
  const note = customSongsNote(['Canon in D, Pachelbel', '', '']);
  assert.deepEqual(readCustomSongsNote(note), ['Canon in D, Pachelbel', '', '']);
  assert.equal(readCustomSongsNote('a regular internal note'), null);
  assert.equal(readCustomSongsNote('{"kind":"other"}'), null);
});
