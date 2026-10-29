import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const gas = fs.readFileSync(new URL('./Code.gs', import.meta.url), 'utf8');
const readme = fs.readFileSync(new URL('./README.md', import.meta.url), 'utf8');

const SAMPLE = `CHASE
[badge] Zelle® payment
DOUGLAS SLOCUM sent you money
Here are the details:
Amount: $80.00
Sent on: Oct 21, 2026
Transaction number: 31308170088
Memo: Kai violin lesson - October 21
DOUGLAS SLOCUM is registered with a Zelle® member bank that supports payments in real time.
`;

type LabelEvent = { name: string };
type FetchEvent = { url: string; options: { headers: Record<string, string> } };

function runForwarder(input: {
  props?: Record<string, string | null>;
  plain?: string;
  status?: number;
  body?: string;
  fetchError?: boolean;
}) {
  const labels: LabelEvent[] = [];
  const fetches: FetchEvent[] = [];
  const sandbox = {
    props: {
      ZELLE_INGEST_SECRET: 'test-secret',
      ZELLE_INGEST_URL: 'https://preview.example/api/payments/zelle',
      ...(input.props ?? {}),
    } as Record<string, string | null>,
    labels,
    fetches,
    searched: false,
    PropertiesService: {
      getScriptProperties() {
        return {
          getProperty(name: string) {
            const value = sandbox.props[name];
            return value == null ? null : value;
          },
        };
      },
    },
    GmailApp: {
      search() {
        sandbox.searched = true;
        return [
          {
            getMessages() {
              return [
                {
                  getPlainBody: () => input.plain ?? SAMPLE,
                  getBody: () => '',
                  getSubject: () => 'You received money with Zelle',
                },
              ];
            },
          },
        ];
      },
      getUserLabelByName(name: string) {
        return {
          addToThread() {
            labels.push({ name });
          },
        };
      },
      createLabel(name: string) {
        return this.getUserLabelByName(name);
      },
    },
    UrlFetchApp: {
      fetch(url: string, options: FetchEvent['options']) {
        fetches.push({ url, options });
        if (input.fetchError) throw new Error('network down');
        return {
          getResponseCode: () => input.status ?? 200,
          getContentText: () => input.body ?? '{"ok":true,"outcome":"matched"}',
        };
      },
    },
    Utilities: {
      computeHmacSha256Signature() {
        return [0, 255];
      },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(gas, sandbox);
  const run = sandbox as typeof sandbox & { processZelleAlerts: () => void };
  return {
    process: () => run.processZelleAlerts(),
    labels,
    fetches,
    searched: () => sandbox.searched,
  };
}

test('a preview bypass secret is sent, and a blank secret adds no header', () => {
  const preview = runForwarder({ props: { VERCEL_BYPASS_SECRET: ' bypass-secret ' } });
  preview.process();
  assert.equal(preview.fetches.length, 1);
  assert.equal(preview.fetches[0].url, 'https://preview.example/api/payments/zelle');
  const headers = preview.fetches[0].options.headers;
  assert.equal(headers['x-vercel-protection-bypass'], 'bypass-secret');
  assert.ok(headers['X-Zelle-Timestamp']);
  assert.ok(headers['X-Zelle-Signature']);
  assert.deepEqual(preview.labels.map((label) => label.name), ['Zelle/processed']);

  for (const secret of ['', '   ', null]) {
    const production = runForwarder({ props: { VERCEL_BYPASS_SECRET: secret } });
    production.process();
    assert.equal(production.fetches.length, 1);
    assert.equal(
      Object.prototype.hasOwnProperty.call(production.fetches[0].options.headers, 'x-vercel-protection-bypass'),
      false,
    );
  }
});

test('network errors and non-2xx responses stay unlabeled, and a clean no-match does not', () => {
  const codes = [0, 302, 400, 401, 403, 404, 408, 429, 500, 503];
  for (const status of codes) {
    const failed = runForwarder({
      status,
      body: '{"ok":false,"outcome":"unmatched"}',
    });
    failed.process();
    assert.equal(failed.fetches.length, 1);
    assert.deepEqual(failed.labels, [], `status ${status} should stay unlabeled`);
  }

  const down = runForwarder({ fetchError: true });
  down.process();
  assert.equal(down.fetches.length, 1);
  assert.deepEqual(down.labels, []);

  const unmatched = runForwarder({ status: 200, body: '{"ok":true,"outcome":"unmatched"}' });
  unmatched.process();
  assert.deepEqual(unmatched.labels.map((label) => label.name), ['Zelle/unmatched']);

  const ambiguous = runForwarder({ status: 200, body: '{"ok":true,"outcome":"ambiguous"}' });
  ambiguous.process();
  assert.deepEqual(ambiguous.labels.map((label) => label.name), ['Zelle/unmatched']);

  const ignored = runForwarder({ status: 200, body: '{"ok":true,"outcome":"ignored"}' });
  ignored.process();
  assert.deepEqual(ignored.labels.map((label) => label.name), ['Zelle/processed']);
});

test('ZELLE_ONLY_AFTER skips Sent on dates before the cutoff and rejects a bad date', () => {
  const older = runForwarder({ props: { ZELLE_ONLY_AFTER: '2026-10-22' } });
  older.process();
  assert.equal(older.searched(), true);
  assert.equal(older.fetches.length, 0);
  assert.deepEqual(older.labels, []);

  const sameDay = runForwarder({ props: { ZELLE_ONLY_AFTER: ' 2026-10-21 ' } });
  sameDay.process();
  assert.equal(sameDay.fetches.length, 1);

  const later = runForwarder({ props: { ZELLE_ONLY_AFTER: '2026-10-20' } });
  later.process();
  assert.equal(later.fetches.length, 1);

  const open = runForwarder({ props: { ZELLE_ONLY_AFTER: '' } });
  open.process();
  assert.equal(open.fetches.length, 1);

  const bad = runForwarder({ props: { ZELLE_ONLY_AFTER: '2026-02-31' } });
  assert.throws(() => bad.process(), /ZELLE_ONLY_AFTER must be an ISO date/);
  assert.equal(bad.searched(), false);
  assert.equal(bad.fetches.length, 0);

  const dated = runForwarder({ props: { ZELLE_ONLY_AFTER: '2026-10-29T00:00:00Z' } });
  assert.throws(() => dated.process(), /YYYY-MM-DD/);
});

test('the forwarder README covers preview bypass and the first-run cutoff', () => {
  assert.match(readme, /VERCEL_BYPASS_SECRET/);
  assert.match(readme, /x-vercel-protection-bypass/);
  assert.match(readme, /ZELLE_ONLY_AFTER/);
  assert.match(readme, /YYYY-MM-DD/);
  assert.match(readme, /https:\/\/danielcimo\.com\/api\/payments\/zelle/);
  assert.match(readme, /Protection Bypass for Automation/);
  assert.match(readme, /## Production/);
  assert.match(readme, /## Preview testing/);
});
