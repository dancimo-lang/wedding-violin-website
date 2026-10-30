import assert from 'node:assert/strict';
import test from 'node:test';
import { matchApiRoute } from './match';
import { apiRouteCatalog } from './route-table';

function pathFor(segments: readonly (string | { readonly param: string })[]): string[] {
  return segments.map((segment) => (typeof segment === 'string' ? segment : 'record-1'));
}

test('every catalog route matches its public path and method', () => {
  for (const route of apiRouteCatalog) {
    for (const method of route.methods) {
      const match = matchApiRoute(method, pathFor(route.segments), apiRouteCatalog);
      assert.equal(match.kind, 'ok');
      if (match.kind !== 'ok') continue;
      assert.equal(match.route.id, route.id);
    }
  }
});

test('dynamic segments keep the path parameter', () => {
  const tune = matchApiRoute('DELETE', ['admin', 'tunes', 'ashokan-farewell'], apiRouteCatalog);
  assert.equal(tune.kind, 'ok');
  if (tune.kind === 'ok') assert.equal(tune.params.id, 'ashokan-farewell');

  const pdf = matchApiRoute('GET', ['pdf', 'cook-in-the-kitchen'], apiRouteCatalog);
  assert.equal(pdf.kind, 'ok');
  if (pdf.kind === 'ok') assert.equal(pdf.params.id, 'cook-in-the-kitchen');
});

test('HEAD follows GET, and a wrong method is 405 with Allow', () => {
  assert.equal(matchApiRoute('HEAD', ['tunes'], apiRouteCatalog).kind, 'ok');
  const denied = matchApiRoute('GET', ['contact'], apiRouteCatalog);
  assert.equal(denied.kind, 'method');
  if (denied.kind === 'method') assert.equal(denied.allow, 'POST');
});

test('cron accepts the daily job on GET or POST and unknown paths miss', () => {
  assert.equal(matchApiRoute('GET', ['cron', 'google-sync'], apiRouteCatalog).kind, 'ok');
  assert.equal(matchApiRoute('POST', ['cron', 'google-sync'], apiRouteCatalog).kind, 'ok');
  assert.equal(matchApiRoute('POST', ['stripe', 'webhook'], apiRouteCatalog).kind, 'miss');
});

test('admin tune list does not swallow a tune id', () => {
  assert.equal(matchApiRoute('POST', ['admin', 'tunes'], apiRouteCatalog).kind, 'ok');
  assert.equal(matchApiRoute('POST', ['admin', 'tunes', 'ashokan-farewell'], apiRouteCatalog).kind, 'method');
  assert.equal(matchApiRoute('DELETE', ['admin', 'tunes'], apiRouteCatalog).kind, 'method');
});
