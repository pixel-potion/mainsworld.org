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
  website: 'https://example.com/',
  listing_status: 'proposed',
  api_availability: 'none',
  capabilities: ['moments'],
  submitted_at: '2026-08-29',
  support_url: 'https://example.com/support',
  privacy_url: 'https://example.com/privacy',
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
    status_evidence_url: 'https://example.com/evidence',
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
    ['website', 'http://example.com/'],
    ['support_url', 'not-a-url'],
    ['privacy_url', 'https://'],
  ]) {
    const app = { ...clone(validApp), [field]: value };
    await assert.rejects(validateRegistry([app]), /schema validation/i, field);
  }
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

  connected.status_evidence_url = 'https://example.com/evidence';
  await assert.doesNotReject(validateRegistry([connected]));

  const nonConnected = {
    ...clone(validApp),
    status_evidence_url: 'https://example.com/evidence',
  };
  await assert.rejects(validateRegistry([nonConnected]), /schema validation/i);
});

test('requires API contract URLs only for public API tiers', async () => {
  for (const availability of ['preview', 'sandbox', 'production']) {
    const app = { ...clone(validApp), api_availability: availability };
    await assert.rejects(validateRegistry([app]), /schema validation/i, availability);

    app.api_contract_url = 'https://example.com/openapi.json';
    await assert.doesNotReject(validateRegistry([app]), availability);
  }

  for (const availability of ['none', 'not_applicable']) {
    const app = {
      ...clone(validApp),
      api_availability: availability,
      api_contract_url: 'https://example.com/openapi.json',
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

test('exports placeholder renderers for the later generated-artifact task', () => {
  assert.equal(typeof renderAppsJson, 'function');
  assert.equal(typeof renderAppsMarkdown, 'function');
  assert.equal(typeof renderLlmsFull, 'function');
});
