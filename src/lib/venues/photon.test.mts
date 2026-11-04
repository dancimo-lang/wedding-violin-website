import assert from 'node:assert/strict';
import test from 'node:test';
import { formatPhotonFeature, parsePhotonResponse, searchPhoton } from './photon';

test('a Photon place becomes a venue name and a street address', () => {
  assert.deepEqual(
    formatPhotonFeature({
      name: 'Madonna Inn',
      housenumber: '100',
      street: 'Madonna Road',
      city: 'San Luis Obispo',
      state: 'California',
      postcode: '93405',
    }),
    { name: 'Madonna Inn', address: '100 Madonna Road, San Luis Obispo, California 93405' },
  );
  assert.equal(formatPhotonFeature({}), null);
  const parsed = parsePhotonResponse({
    features: [
      { properties: { name: 'Mission San Luis Obispo', street: 'Chorro Street', housenumber: '751', city: 'San Luis Obispo', state: 'California', postcode: '93401' } },
      { properties: { name: 'Mission San Luis Obispo', street: 'Chorro Street', housenumber: '751', city: 'San Luis Obispo', state: 'California', postcode: '93401' } },
      { properties: {} },
    ],
  });
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0]?.name, 'Mission San Luis Obispo');
});

test('a failed venue search returns nothing', async () => {
  const results = await searchPhoton('Madonna', async () => new Response('no', { status: 500 }));
  assert.deepEqual(results, []);
  assert.deepEqual(await searchPhoton('ab'), []);
});
