import assert from 'node:assert/strict';
import test from 'node:test';
import { youtubeEmbed } from './youtube';

test('the live tune ids embed, including a start time glued on with &t=', () => {
  const scale = youtubeEmbed('trnn_Xo-SyM');
  assert.equal(scale?.videoId, 'trnn_Xo-SyM');
  assert.equal(scale?.start, 0);
  assert.equal(scale?.src, 'https://www.youtube.com/embed/trnn_Xo-SyM?rel=0&modestbranding=1&playsinline=1');

  const cook = youtubeEmbed('E6SrQadACCc&t=90s');
  assert.equal(cook?.videoId, 'E6SrQadACCc');
  assert.equal(cook?.start, 90);
  assert.equal(cook?.src.includes('/embed/E6SrQadACCc?'), true);
  assert.equal(cook?.src.includes('start=90'), true);
  assert.equal(cook?.src.includes('&t='), false);
});

test('watch, youtu.be, shorts, and playlist links keep the id and drop share params', () => {
  const watch = youtubeEmbed('https://www.youtube.com/watch?v=E6SrQadACCc&t=1m30s&si=sharetoken');
  assert.equal(watch?.videoId, 'E6SrQadACCc');
  assert.equal(watch?.start, 90);
  assert.equal(watch?.src.includes('si='), false);

  const shortLink = youtubeEmbed('https://youtu.be/trnn_Xo-SyM?t=45');
  assert.equal(shortLink?.videoId, 'trnn_Xo-SyM');
  assert.equal(shortLink?.start, 45);

  const shorts = youtubeEmbed('https://www.youtube.com/shorts/nVncuZgtkh4');
  assert.equal(shorts?.videoId, 'nVncuZgtkh4');

  const playlist = youtubeEmbed('https://www.youtube.com/playlist?list=PLabcdefghijk123456');
  assert.equal(playlist?.videoId, '');
  assert.equal(playlist?.list, 'PLabcdefghijk123456');
  assert.equal(playlist?.src.includes('/embed/videoseries?'), true);

  const withList = youtubeEmbed('https://www.youtube.com/watch?v=trnn_Xo-SyM&list=PLabcdefghijk123456');
  assert.equal(withList?.videoId, 'trnn_Xo-SyM');
  assert.equal(withList?.list, 'PLabcdefghijk123456');
});

test('a value that is not a video or playlist is not embedded', () => {
  assert.equal(youtubeEmbed(''), null);
  assert.equal(youtubeEmbed('not a video'), null);
  assert.equal(youtubeEmbed('https://example.com/watch?v=trnn_Xo-SyM'), null);
});
