import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  clientFacingActivityBody,
  contractOwnerEmail,
  guardClientFacingEmail,
  isProductionEmailEnvironment,
  type ClientMailInput,
} from './mail';

const owner = 'dancimo@gmail.com';
const client = 'couple@example.com';
const signingHtml =
  '<p><a href="https://wedding-violin-website-git-booking-system-example.vercel.app/contract?t=abc">Read and sign the agreement</a></p>';

function signingMail(): ClientMailInput {
  return {
    to: client,
    subject: 'Please sign your wedding music agreement',
    html: signingHtml,
  };
}

test('only VERCEL_ENV production counts as production', () => {
  assert.equal(isProductionEmailEnvironment({ VERCEL_ENV: 'production' }), true);
  assert.equal(isProductionEmailEnvironment({ VERCEL_ENV: ' production ' }), true);
  assert.equal(isProductionEmailEnvironment({ VERCEL_ENV: 'preview' }), false);
  assert.equal(isProductionEmailEnvironment({ VERCEL_ENV: 'development' }), false);
  assert.equal(isProductionEmailEnvironment({ VERCEL_ENV: 'Production' }), false);
  assert.equal(isProductionEmailEnvironment({ VERCEL_ENV: '' }), false);
  assert.equal(isProductionEmailEnvironment({}), false);
});

test('production leaves a contract email exactly as written', () => {
  const input = signingMail();
  const out = guardClientFacingEmail(input, { vercelEnv: 'production', ownerEmail: owner });
  assert.equal(out.redirected, false);
  assert.equal(out.to, input.to);
  assert.equal(out.subject, input.subject);
  assert.equal(out.html, input.html);
  assert.equal(out.html.includes('Test site'), false);
  assert.equal(out.html.includes('[TEST SITE]'), false);
});

test('a preview contract email goes only to the owner with the test marker', () => {
  const input = signingMail();
  const out = guardClientFacingEmail(input, { vercelEnv: 'preview', ownerEmail: owner });
  assert.equal(out.redirected, true);
  assert.equal(out.to, owner);
  assert.equal(Array.isArray(out.to), false);
  assert.equal(out.subject, '[TEST SITE] Please sign your wedding music agreement');
  assert.match(out.html, /Original recipient: couple@example\.com/);
  assert.match(out.html, /Read and sign the agreement/);
  assert.match(out.html, /wedding-violin-website-git-booking-system-example\.vercel\.app\/contract\?t=abc/);
  assert.equal(out.html.includes(client) , true);
  assert.equal(String(out.to).includes(client), false);
});

test('local dev and a missing VERCEL_ENV fail safe, even when NODE_ENV is production', () => {
  const env = process.env as { VERCEL_ENV?: string; NODE_ENV?: string };
  const previousVercel = env.VERCEL_ENV;
  const previousNode = env.NODE_ENV;
  delete env.VERCEL_ENV;
  env.NODE_ENV = 'production';
  try {
    for (const vercelEnv of [undefined, '', 'development', 'preview'] as const) {
      const out = guardClientFacingEmail(signingMail(), { vercelEnv, ownerEmail: owner });
      assert.equal(out.redirected, true, `expected redirect for ${String(vercelEnv)}`);
      assert.equal(out.to, owner);
      assert.match(out.subject, /^\[TEST SITE\] /);
    }
    const fromProcess = guardClientFacingEmail(signingMail(), { ownerEmail: owner });
    assert.equal(fromProcess.redirected, true);
    assert.equal(fromProcess.to, owner);
    assert.equal(env.NODE_ENV, 'production');
  } finally {
    if (previousVercel === undefined) delete env.VERCEL_ENV;
    else env.VERCEL_ENV = previousVercel;
    if (previousNode === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = previousNode;
  }
});

test('mail that is already only to the owner is unchanged on a test site', () => {
  const input: ClientMailInput = {
    to: 'Daniel Cimo <dancimo@gmail.com>',
    subject: 'Zelle payment needs a booking match',
    html: '<p>Check Admin → Payments.</p>',
  };
  const out = guardClientFacingEmail(input, { vercelEnv: 'preview', ownerEmail: owner });
  assert.equal(out.redirected, false);
  assert.equal(out.to, input.to);
  assert.equal(out.subject, input.subject);
  assert.equal(out.html, input.html);

  const copies: ClientMailInput = {
    to: ['dancimo@gmail.com', 'Daniel <dancimo@gmail.com>'],
    subject: 'Signed wedding music agreement (DC-1234)',
    html: '<p>Owner copy</p>',
  };
  const ownerCopies = guardClientFacingEmail(copies, { vercelEnv: 'development', ownerEmail: ' Dancimo@gmail.com ' });
  assert.equal(ownerCopies.redirected, false);
  assert.equal(ownerCopies.to, copies.to);
  assert.equal(ownerCopies.subject, copies.subject);
});

test('a client address mixed with the owner is not delivered to the client', () => {
  const out = guardClientFacingEmail(
    {
      to: ['dancimo@gmail.com', client, 'Daniel <dancimo@gmail.com>'],
      subject: 'Your signed wedding music agreement',
      html: '<p>Attached.</p>',
    },
    { vercelEnv: 'preview', ownerEmail: owner },
  );
  assert.equal(out.to, owner);
  assert.match(out.subject, /^\[TEST SITE\] /);
  assert.match(out.html, /dancimo@gmail\.com, couple@example\.com, Daniel &lt;dancimo@gmail\.com&gt;/);
  assert.equal(out.html.includes('<dancimo@gmail.com>'), false);
});

test('the original recipient is escaped and the test marker is not doubled', () => {
  const out = guardClientFacingEmail(
    {
      to: 'a<b>@example.com',
      subject: '[TEST SITE] Already marked',
      html: '<p>Body</p>',
    },
    { vercelEnv: 'preview', ownerEmail: owner },
  );
  assert.equal(out.subject, '[TEST SITE] Already marked');
  assert.match(out.html, /a&lt;b&gt;@example\.com/);
  assert.equal(out.html.includes('a<b>'), false);
  assert.match(out.html, /<p>Body<\/p>$/);
});

test('an empty recipient still stays with the owner', () => {
  const out = guardClientFacingEmail(
    { to: '   ', subject: 'Please sign your agreement', html: '<p>Link</p>' },
    { vercelEnv: 'preview', ownerEmail: owner },
  );
  assert.equal(out.to, owner);
  assert.match(out.html, /Original recipient: \(no address\)/);
});

test('the redirect target follows the owner address', () => {
  const env = process.env as { VERCEL_ENV?: string };
  const previous = env.VERCEL_ENV;
  env.VERCEL_ENV = 'preview';
  try {
    const out = guardClientFacingEmail({ to: client, subject: 'Hi', html: '<p></p>' });
    assert.equal(out.to, contractOwnerEmail());
  } finally {
    if (previous === undefined) delete env.VERCEL_ENV;
    else env.VERCEL_ENV = previous;
  }
});

test('activity text names the test redirect and stays the same in production', () => {
  const env = process.env as { VERCEL_ENV?: string };
  const previous = env.VERCEL_ENV;
  env.VERCEL_ENV = 'production';
  try {
    assert.equal(clientFacingActivityBody(client, `Sent to ${client}.`), `Sent to ${client}.`);
    assert.equal(clientFacingActivityBody(client, client), client);
    env.VERCEL_ENV = 'preview';
    assert.equal(clientFacingActivityBody(client, `Sent to ${client}.`), `Test site: sent to you instead of ${client}.`);
  } finally {
    if (previous === undefined) delete env.VERCEL_ENV;
    else env.VERCEL_ENV = previous;
  }
});

test('every Resend send goes through the client-mail guard', () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.next') continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.(ts|tsx|mts|js|mjs)$/.test(entry.name) && !entry.name.includes('.test.')) files.push(path);
    }
  };
  walk(join(root, 'src'));
  walk(join(root, 'scripts'));
  const senders = files.filter((path) => readFileSync(path, 'utf8').includes('resend.emails.send('));
  assert.deepEqual(
    senders.map((path) => path.slice(root.length + 1)).sort(),
    ['src/lib/api/handlers/contact.ts', 'src/lib/contracts/delivery.ts'],
  );
  const sendBlocks = (source: string) => {
    const blocks: string[] = [];
    const marker = 'resend.emails.send(';
    let from = 0;
    while (from < source.length) {
      const start = source.indexOf(marker, from);
      if (start < 0) break;
      const end = source.indexOf('});', start);
      blocks.push(source.slice(start, end < 0 ? source.length : end));
      from = start + marker.length;
    }
    return blocks;
  };
  for (const path of senders) {
    const source = readFileSync(path, 'utf8');
    assert.match(source, /guardClientFacingEmail\(/);
    const blocks = sendBlocks(source);
    assert.ok(blocks.length > 0, path);
    for (const block of blocks) {
      assert.match(block, /to: (guarded|clientMail|ownerMail)\.to/, path);
      assert.match(block, /subject: (guarded|clientMail|ownerMail)\.subject/, path);
      assert.match(block, /html: (guarded|clientMail|ownerMail)\.html/, path);
      assert.doesNotMatch(block, /to: (input\.to|normalizedEmail|process\.env\.CONTACT_EMAIL)/);
    }
  }
});
