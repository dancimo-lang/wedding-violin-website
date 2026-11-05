import assert from 'node:assert/strict';
import test from 'node:test';
import { allowVenueQuery, clientIp } from './rate-limit';

test('a public venue search allows a short burst and then waits for the next minute', () => {
  const buckets = new Map();
  for (let i = 0; i < 20; i += 1) assert.equal(allowVenueQuery(buckets, '1.2.3.4', 1_000, 20, 60_000), true);
  assert.equal(allowVenueQuery(buckets, '1.2.3.4', 1_000, 20, 60_000), false);
  assert.equal(allowVenueQuery(buckets, '5.6.7.8', 1_000, 20, 60_000), true);
  assert.equal(allowVenueQuery(buckets, '1.2.3.4', 61_000, 20, 60_000), true);
});

test('the client address is the first forwarded hop', () => {
  const request = new Request('https://example.com', {
    headers: { 'x-forwarded-for': '203.0.113.5, 10.0.0.1' },
  });
  assert.equal(clientIp(request), '203.0.113.5');
  assert.equal(clientIp(new Request('https://example.com')), 'unknown');
});
