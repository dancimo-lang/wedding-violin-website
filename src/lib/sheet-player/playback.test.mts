import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { playbackBpm, scaledStepMs, stepAfter } from './playback';

test('tempo stays between 40% and 120% of the written tempo', () => {
  assert.equal(playbackBpm(120, 100), 120);
  assert.equal(playbackBpm(120, 40), 48);
  assert.equal(playbackBpm(120, 120), 144);
  assert.equal(playbackBpm(120, 10), 48);
  assert.equal(playbackBpm(0, 100), 120);
  assert.equal(scaledStepMs(500, 100), 500);
  assert.equal(scaledStepMs(500, 50), 1000);
});

test('loop wraps inside the selected measures and otherwise plays through', () => {
  const measures = [1, 1, 2, 2, 3];
  assert.equal(stepAfter(0, measures, null), 1);
  assert.equal(stepAfter(4, measures, null), -1);
  assert.equal(stepAfter(1, measures, { from: 1, to: 2 }), 2);
  assert.equal(stepAfter(3, measures, { from: 1, to: 2 }), 0);
  assert.equal(stepAfter(4, measures, { from: 2, to: 2 }), -1);
});

test('the sample MusicXML is a fixture and is not part of the tune library', () => {
  const xml = fs.readFileSync(new URL('../../../fixtures/sheet-music/sample.musicxml', import.meta.url), 'utf8');
  assert.match(xml, /<score-partwise/);
  assert.match(xml, /<per-minute>120<\/per-minute>/);
  assert.match(xml, /<measure number="2">/);
  const tunes = fs.readFileSync(new URL('../../data/tunes.json', import.meta.url), 'utf8');
  assert.equal(tunes.includes('sample.musicxml'), false);
  assert.equal(fs.existsSync(new URL('../../../public/fixtures/sheet-music/sample.musicxml', import.meta.url)), false);
});
