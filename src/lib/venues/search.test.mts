import assert from 'node:assert/strict';
import test from 'node:test';
import { searchVenues } from './search';

test('a blocked Photon reply falls back to Nominatim', async () => {
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes('photon.komoot.io')) return new Response('blocked', { status: 403 });
    if (url.includes('nominatim.openstreetmap.org')) {
      return new Response(
        JSON.stringify([
          {
            name: 'Sunstone Winery',
            address: {
              house_number: '125',
              road: 'Refugio Road',
              city: 'Santa Ynez',
              state: 'California',
              postcode: '93460',
            },
          },
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    return new Response('missing', { status: 404 });
  };
  const results = await searchVenues('Sunstone Winery fallback test', fetchImpl);
  assert.equal(results[0]?.name, 'Sunstone Winery');
  assert.equal(results[0]?.address, '125 Refugio Road, Santa Ynez, California 93460');
});

test('photon results are used when photon answers', async () => {
  let nominatimCalls = 0;
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes('nominatim.openstreetmap.org')) {
      nominatimCalls += 1;
      return new Response('[]', { status: 200 });
    }
    return new Response(
      JSON.stringify({
        features: [
          {
            properties: {
              name: 'Madonna Inn',
              housenumber: '100',
              street: 'Madonna Road',
              city: 'San Luis Obispo',
              state: 'California',
              postcode: '93405',
            },
          },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  };
  const results = await searchVenues('Madonna Inn photon test', fetchImpl);
  assert.equal(results[0]?.name, 'Madonna Inn');
  assert.equal(results[0]?.address, '100 Madonna Road, San Luis Obispo, California 93405');
  assert.equal(nominatimCalls, 0);
});
