import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  loadRegistry,
  renderAppsJson,
  renderAppsMarkdown,
  renderLlmsFull,
  validateRegistry,
} from '../scripts/app-registry.mjs';

const validApp = {
  schema_version: 'v1',
  id: 'trail-notes',
  name: 'Trail Notes',
  summary: 'A public listing for sharing trail moments.',
  website: 'https://www.iana.org/',
  listing_status: 'proposed',
  api_availability: 'none',
  capabilities: ['moments'],
  submitted_at: '2026-08-29',
  support_url: 'https://www.iana.org/support',
  privacy_url: 'https://www.iana.org/privacy',
};

function clone(value) {
  return structuredClone(value);
}

async function withRegistry(files, run) {
  const root = await mkdtemp(path.join(tmpdir(), 'mainsworld-app-registry-'));
  const appsDirectory = path.join(root, 'registry', 'apps');
  await mkdir(appsDirectory, { recursive: true });

  await Promise.all(
    Object.entries(files).map(([filename, app]) =>
      writeFile(path.join(appsDirectory, filename), `${JSON.stringify(app)}\n`),
    ),
  );

  try {
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('accepts a valid proposed manifest', async () => {
  await assert.doesNotReject(validateRegistry([clone(validApp)]));
});

test('rejects a manifest whose ID does not match its filename', async () => {
  await withRegistry({ 'different-name.json': validApp }, async (root) => {
    await assert.rejects(loadRegistry(root), /filename/i);
  });
});

test('returns freshly loaded manifests in status and English-name order', async () => {
  const connected = {
    ...clone(validApp),
    id: 'beta',
    name: 'Beta',
    listing_status: 'connected',
    reviewed_at: '2026-08-29',
    status_evidence_url: 'https://www.iana.org/evidence',
  };
  delete connected.submitted_at;
  delete connected.support_url;
  delete connected.privacy_url;

  const proposed = { ...clone(validApp), id: 'alpha', name: 'Alpha' };
  const wishlist = {
    ...clone(validApp),
    id: 'zeta',
    name: 'Zeta',
    listing_status: 'wishlist',
    reviewed_at: '2026-08-29',
  };
  delete wishlist.submitted_at;
  delete wishlist.support_url;
  delete wishlist.privacy_url;

  await withRegistry(
    { 'zeta.json': wishlist, 'alpha.json': proposed, 'beta.json': connected },
    async (root) => {
      const firstLoad = await loadRegistry(root);
      const secondLoad = await loadRegistry(root);

      assert.deepEqual(firstLoad.map(({ id }) => id), ['beta', 'alpha', 'zeta']);
      assert.notEqual(firstLoad, secondLoad);
      assert.notEqual(firstLoad[0], secondLoad[0]);
    },
  );
});

test('rejects duplicate manifest IDs', async () => {
  const duplicate = clone(validApp);
  duplicate.name = 'A second name';

  await assert.rejects(
    validateRegistry([validApp, duplicate]),
    /duplicate app ID/i,
  );
});

test('rejects unknown fields and duplicate capabilities', async () => {
  const unknownField = { ...clone(validApp), unreviewed_field: true };
  await assert.rejects(validateRegistry([unknownField]), /schema validation/i);

  const duplicateCapability = {
    ...clone(validApp),
    capabilities: ['moments', 'moments'],
  };
  await assert.rejects(validateRegistry([duplicateCapability]), /schema validation/i);
});

test('rejects HTTP and malformed public URLs', async () => {
  for (const [field, value] of [
    ['website', 'http://www.iana.org/'],
    ['support_url', 'not-a-url'],
    ['privacy_url', 'https://'],
  ]) {
    const app = { ...clone(validApp), [field]: value };
    await assert.rejects(validateRegistry([app]), /schema validation/i, field);
  }
});

test('rejects credentialed, raw-IP, and special-use public URLs', async () => {
  for (const [name, field, value] of [
    ['credentials', 'website', 'https://user:secret@www.iana.org/'],
    ['public IPv4 literal', 'website', 'https://8.8.8.8/private'],
    ['public IPv6 literal', 'website', 'https://[2606:4700:4700::1111]/private'],
    ['single-label hostname', 'website', 'https://catalog/private'],
    ['localhost trailing dot', 'support_url', 'https://localhost./private'],
    ['local suffix trailing dot', 'privacy_url', 'https://service.local./private'],
    ['test suffix', 'website', 'https://service.test/private'],
    ['invalid suffix', 'website', 'https://service.invalid/private'],
    ['arpa suffix', 'website', 'https://service.arpa/private'],
    ['home arpa suffix', 'website', 'https://service.home.arpa/private'],
    ['alt suffix', 'website', 'https://service.alt/private'],
    ['onion suffix', 'website', 'https://service.onion/private'],
    ['internal suffix', 'website', 'https://service.internal/private'],
    ['home suffix', 'website', 'https://service.home/private'],
    ['lan suffix', 'website', 'https://service.lan/private'],
    ['corp suffix', 'website', 'https://service.corp/private'],
    ['example.com', 'website', 'https://example.com/'],
    ['example.com subdomain', 'website', 'https://docs.example.com/'],
    ['example.net', 'website', 'https://example.net/'],
    ['example.org', 'website', 'https://example.org/'],
    ['IPv4 unspecified', 'website', 'https://0.0.0.0/private'],
    ['IPv4 private', 'website', 'https://10.0.0.1/private'],
    ['IPv4 CGNAT', 'website', 'https://100.64.0.1/private'],
    ['IPv4 loopback', 'website', 'https://127.0.0.1/private'],
    ['IPv4 link-local', 'website', 'https://169.254.0.1/private'],
    ['IPv4 private 172', 'website', 'https://172.16.0.1/private'],
    ['IPv4 private 192', 'website', 'https://192.168.0.1/private'],
    ['IPv4 documentation 192', 'website', 'https://192.0.2.1/private'],
    ['IPv4 benchmark', 'website', 'https://198.18.0.1/private'],
    ['IPv4 documentation 198', 'website', 'https://198.51.100.1/private'],
    ['IPv4 documentation 203', 'website', 'https://203.0.113.1/private'],
    ['IPv4 multicast', 'website', 'https://224.0.0.1/private'],
    ['IPv4 reserved', 'website', 'https://240.0.0.1/private'],
    ['IPv6 unspecified', 'website', 'https://[::]/private'],
    ['IPv6 loopback', 'api_contract_url', 'https://[::1]/openapi.json'],
    ['IPv4-mapped IPv6 loopback', 'website', 'https://[::ffff:127.0.0.1]/private'],
    ['IPv6 unique local', 'website', 'https://[fc00::1]/private'],
    ['IPv6 link-local', 'website', 'https://[fe80::1]/private'],
    ['IPv6 documentation', 'website', 'https://[2001:db8::1]/private'],
    ['IPv6 benchmark', 'website', 'https://[2001:2::1]/private'],
    ['IPv6 multicast', 'website', 'https://[ff02::1]/private'],
    ['IPv6 reserved', 'website', 'https://[100::1]/private'],
  ]) {
    const app = { ...clone(validApp), [field]: value };
    if (field === 'api_contract_url') app.api_availability = 'preview';

    await assert.rejects(validateRegistry([app]), /public HTTPS URL/i, name);
  }
});

test('accepts an ordinary public DNS hostname with a trailing dot', async () => {
  const app = { ...clone(validApp), website: 'https://www.iana.org./' };
  await assert.doesNotReject(validateRegistry([app]));
});

test('requires proposal submission, support, and privacy fields', async () => {
  for (const field of ['submitted_at', 'support_url', 'privacy_url']) {
    const app = clone(validApp);
    delete app[field];
    await assert.rejects(validateRegistry([app]), /schema validation/i, field);
  }
});

test('requires a review date for non-proposed manifests', async () => {
  const app = {
    ...clone(validApp),
    listing_status: 'coming_soon',
  };
  delete app.submitted_at;

  await assert.rejects(validateRegistry([app]), /schema validation/i);

  app.reviewed_at = '2026-08-29';
  await assert.doesNotReject(validateRegistry([app]));
});

test('requires connected evidence and forbids it for every other status', async () => {
  const connected = {
    ...clone(validApp),
    listing_status: 'connected',
    reviewed_at: '2026-08-29',
  };
  delete connected.submitted_at;

  await assert.rejects(validateRegistry([connected]), /schema validation/i);

  connected.status_evidence_url = 'https://www.iana.org/evidence';
  await assert.doesNotReject(validateRegistry([connected]));

  const nonConnected = {
    ...clone(validApp),
    status_evidence_url: 'https://www.iana.org/evidence',
  };
  await assert.rejects(validateRegistry([nonConnected]), /schema validation/i);
});

test('requires API contract URLs only for public API tiers', async () => {
  for (const availability of ['preview', 'sandbox', 'production']) {
    const app = { ...clone(validApp), api_availability: availability };
    await assert.rejects(validateRegistry([app]), /schema validation/i, availability);

    app.api_contract_url = 'https://www.iana.org/openapi.json';
    await assert.doesNotReject(validateRegistry([app]), availability);
  }

  for (const availability of ['none', 'not_applicable']) {
    const app = {
      ...clone(validApp),
      api_availability: availability,
      api_contract_url: 'https://www.iana.org/openapi.json',
    };
    await assert.rejects(validateRegistry([app]), /schema validation/i, availability);
  }
});

test('rejects prohibited public-data key families before schema validation', async () => {
  for (const prohibitedKey of [
    'secret_token',
    'accessToken',
    'client_id',
    'callback_url',
    'main_identifier',
    'identity',
    'main_user_id',
    'mainUserId',
    'main_uuid',
    'user_id',
    'userIdentifier',
    'walletAddress',
    'grant_id',
    'internal_endpoint',
  ]) {
    const malformed = {
      ...clone(validApp),
      malformed: { [prohibitedKey]: 'private-value' },
    };
    await assert.rejects(
      validateRegistry([malformed]),
      /prohibited field/i,
      prohibitedKey,
    );
  }
});

test('does not classify unrelated UUID keys as Main identifiers', async () => {
  const malformed = {
    ...clone(validApp),
    malformed: { domain_uuid: 'public-value' },
  };

  await assert.rejects(validateRegistry([malformed]), /schema validation/i);
});

test('exports placeholder renderers for the later generated-artifact task', () => {
  assert.equal(typeof renderAppsJson, 'function');
  assert.equal(typeof renderAppsMarkdown, 'function');
  assert.equal(typeof renderLlmsFull, 'function');
});
