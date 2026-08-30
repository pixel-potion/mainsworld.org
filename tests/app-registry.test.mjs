import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { execFile as execFileCallback } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import yaml from 'js-yaml';

import {
  loadRegistry,
  loadCatalog,
  loadPlatform,
  renderAppsJson,
  renderAppsMarkdown,
  renderLlmsFull,
  checkBaseDiff,
  validatePlatform,
  validateCatalog,
  validateRegistry,
} from '../scripts/app-registry.mjs';

const repositoryRoot = path.resolve(import.meta.dirname, '..');
const execFile = promisify(execFileCallback);
const policyWorkflowPath = path.join(repositoryRoot, '.github', 'workflows', 'catalog-policy.yml');
const expectedApps = [
  ['runpal', 'connected', 'none', ['moments']],
  ['alerts', 'first_party', 'not_applicable', ['mains']],
  ['photos', 'coming_soon', 'none', ['moments']],
  ['discord', 'coming_soon', 'none', ['crews']],
  ['instagram', 'coming_soon', 'none', ['moments', 'mains']],
  ['luma', 'coming_soon', 'none', ['vibes']],
  ['spotify', 'coming_soon', 'none', ['moments', 'vibes']],
  ['strava', 'coming_soon', 'none', ['moments']],
  ['eventmagic', 'wishlist', 'none', ['vibes', 'crews']],
  ['garmin', 'wishlist', 'none', ['moments']],
  ['gphotos', 'wishlist', 'none', ['moments']],
  ['meetup', 'wishlist', 'none', ['vibes', 'crews']],
  ['partiful', 'wishlist', 'none', ['vibes']],
  ['soundcloud', 'wishlist', 'none', ['moments', 'vibes']],
  ['telegram', 'wishlist', 'none', ['crews', 'mains']],
  ['tiktok', 'wishlist', 'none', ['moments']],
  ['whatsapp', 'wishlist', 'none', ['crews', 'mains']],
  ['x', 'wishlist', 'none', ['moments', 'mains']],
];
const expectedOperations = [
  ['POST', '/oauth/token'],
  ['POST', '/connectives/v1/link-sessions'],
  ['GET', '/connectives/v1/link-sessions/{session_id}'],
  ['POST', '/connectives/v1/grants/{grant_id}/vibe-candidates'],
  ['GET', '/connectives/v1/grants/{grant_id}/candidates/{candidate_id}'],
];

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

const validCatalog = {
  schema_version: 'v1',
  catalog_version: '2026-08-29',
  space_source: {
    repository: 'https://github.com/pixel-potion/Mains.World',
    revision: '4babf633b209855c49e1bf698d04b2a03488de8c',
    paths: ['src/app/components/backstage/constellation/constellationApps.tsx'],
  },
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

async function withCatalog(catalog, run) {
  const root = await mkdtemp(path.join(tmpdir(), 'mainsworld-catalog-'));
  try {
    await mkdir(path.join(root, 'registry'), { recursive: true });
    await writeFile(path.join(root, 'registry', 'catalog.json'), `${JSON.stringify(catalog)}\n`);
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function withMutatedOpenApi(mutate, run) {
  const root = await mkdtemp(path.join(tmpdir(), 'mainsworld-platform-'));
  try {
    await cp(path.join(repositoryRoot, 'registry'), path.join(root, 'registry'), { recursive: true });
    await cp(path.join(repositoryRoot, 'static', 'api'), path.join(root, 'static', 'api'), { recursive: true });
    const platform = await loadPlatform(root);
    const openapiPath = path.join(root, 'static', 'api', 'connectives', 'v1', 'openapi.json');
    const contract = JSON.parse(await readFile(openapiPath, 'utf8'));
    mutate(contract);
    await writeFile(openapiPath, `${JSON.stringify(contract, null, 2)}\n`);
    platform.artifacts.openapi.sha256 = createHash('sha256')
      .update(await readFile(openapiPath))
      .digest('hex');
    await run(platform, root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function runGit(root, args) {
  await execFile('git', args, { cwd: root });
}

async function withGitRepository(mutate, run, { prepareBase } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'mainsworld-registry-diff-'));
  try {
    await cp(path.join(repositoryRoot, 'registry'), path.join(root, 'registry'), { recursive: true });
    await cp(path.join(repositoryRoot, 'static', 'api'), path.join(root, 'static', 'api'), { recursive: true });
    await prepareBase?.(root);
    await runGit(root, ['init', '--quiet']);
    await runGit(root, ['config', 'user.name', 'Registry Test']);
    await runGit(root, ['config', 'user.email', 'registry-test@example.invalid']);
    await runGit(root, ['add', 'registry', 'static']);
    await runGit(root, ['commit', '--quiet', '-m', 'base registry']);
    const { stdout } = await execFile('git', ['rev-parse', 'HEAD'], { cwd: root });
    const base = stdout.trim();

    await mutate(root);
    await runGit(root, ['add', '-A']);
    await runGit(root, ['commit', '--quiet', '-m', 'registry change']);
    await run(root, base);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function addManifest(root, overrides = {}) {
  const app = { ...clone(validApp), id: 'city-notes', name: 'City Notes', ...overrides };
  await writeFile(
    path.join(root, 'registry', 'apps', `${app.id}.json`),
    `${JSON.stringify(app, null, 2)}\n`,
  );
}

async function writeGeneratedCatalogOutputs(root) {
  const [catalog, apps, platform] = await Promise.all([
    readFile(path.join(root, 'registry', 'catalog.json'), 'utf8').then(JSON.parse),
    loadRegistry(root),
    loadPlatform(root),
  ]);
  await Promise.all([
    writeFile(path.join(root, 'docs', 'developers', 'apps.md'), renderAppsMarkdown(apps)),
    writeFile(path.join(root, 'static', 'apps.json'), renderAppsJson(catalog, apps)),
    writeFile(path.join(root, 'static', 'llms-full.txt'), renderLlmsFull(catalog, apps, platform)),
  ]);
}

async function withProposedCheckout(mutate, run) {
  const root = await mkdtemp(path.join(tmpdir(), 'mainsworld-proposed-checkout-'));
  try {
    await Promise.all([
      cp(path.join(repositoryRoot, 'registry'), path.join(root, 'registry'), { recursive: true }),
      cp(path.join(repositoryRoot, 'static', 'api'), path.join(root, 'static', 'api'), { recursive: true }),
      mkdir(path.join(root, 'docs', 'developers'), { recursive: true }),
      mkdir(path.join(root, 'scripts'), { recursive: true }),
    ]);
    await Promise.all([
      cp(path.join(repositoryRoot, 'docs', 'developers', 'apps.md'), path.join(root, 'docs', 'developers', 'apps.md')),
      cp(path.join(repositoryRoot, 'static', 'apps.json'), path.join(root, 'static', 'apps.json')),
      cp(path.join(repositoryRoot, 'static', 'llms-full.txt'), path.join(root, 'static', 'llms-full.txt')),
      writeFile(path.join(root, 'scripts', 'app-registry.mjs'), 'process.exit(0);\n'),
      writeFile(path.join(root, 'package.json'), JSON.stringify({ scripts: { 'apps:check': 'exit 0' } }, null, 2)),
    ]);
    await runGit(root, ['init', '--quiet']);
    await runGit(root, ['config', 'user.name', 'Registry Test']);
    await runGit(root, ['config', 'user.email', 'registry-test@example.invalid']);
    await runGit(root, ['add', '-A']);
    await runGit(root, ['commit', '--quiet', '-m', 'base checkout']);
    const { stdout } = await execFile('git', ['rev-parse', 'HEAD'], { cwd: root });
    const base = stdout.trim();

    await mutate(root);
    await runGit(root, ['add', '-A']);
    await runGit(root, ['commit', '--quiet', '-m', 'proposed change']);
    await run(root, base);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function runTrustedPolicy(args, options = {}) {
  return execFile(process.execPath, [path.join(repositoryRoot, 'scripts', 'app-registry.mjs'), ...args], options);
}

test('permits a newly added proposed manifest with no API access', async () => {
  await withGitRepository(
    async (root) => addManifest(root),
    async (root, base) => assert.doesNotReject(checkBaseDiff(base, { root })),
  );
});

test('rejects newly added listings that self-declare a non-proposed or public API status', async () => {
  for (const [listingStatus, apiAvailability] of [
    ['connected', 'none'],
    ['coming_soon', 'none'],
    ['wishlist', 'none'],
    ['first_party', 'none'],
    ['proposed', 'preview'],
    ['proposed', 'sandbox'],
    ['proposed', 'production'],
  ]) {
    await withGitRepository(
      async (root) => {
        const app = {
          listing_status: listingStatus,
          api_availability: apiAvailability,
        };
        if (listingStatus !== 'proposed') {
          app.reviewed_at = '2026-08-29';
          delete app.submitted_at;
          delete app.support_url;
          delete app.privacy_url;
        }
        if (listingStatus === 'connected') app.status_evidence_url = 'https://www.iana.org/evidence';
        if (apiAvailability !== 'none') app.api_contract_url = 'https://www.iana.org/openapi.json';
        await addManifest(root, app);
      },
      async (root, base) => assert.rejects(checkBaseDiff(base, { root }), /new app manifest|proposed|API/i),
    );
  }
});

test('rejects modified, renamed, copied, and deleted existing manifests in ordinary mode', async () => {
  const changes = {
    modified: async (root) => {
      const filename = path.join(root, 'registry', 'apps', 'runpal.json');
      const app = JSON.parse(await readFile(filename, 'utf8'));
      app.summary = 'A changed public listing summary.';
      await writeFile(filename, `${JSON.stringify(app, null, 2)}\n`);
    },
    renamed: async (root) => {
      await runGit(root, ['mv', 'registry/apps/runpal.json', 'registry/apps/runpal-renamed.json']);
      const filename = path.join(root, 'registry', 'apps', 'runpal-renamed.json');
      const app = JSON.parse(await readFile(filename, 'utf8'));
      app.id = 'runpal-renamed';
      await writeFile(filename, `${JSON.stringify(app, null, 2)}\n`);
    },
    copied: async (root) => {
      const source = await readFile(path.join(root, 'registry', 'apps', 'runpal.json'), 'utf8');
      const app = JSON.parse(source);
      app.id = 'runpal-copy';
      app.name = 'RunPal Copy';
      await writeFile(path.join(root, 'registry', 'apps', 'runpal-copy.json'), `${JSON.stringify(app, null, 2)}\n`);
    },
    deleted: async (root) => {
      await runGit(root, ['rm', '--quiet', 'registry/apps/runpal.json']);
    },
  };

  for (const [kind, mutate] of Object.entries(changes)) {
    await withGitRepository(
      mutate,
      async (root, base) => assert.rejects(checkBaseDiff(base, { root }), /existing manifest|catalog maintenance|rename|copy|delete|modify/i, kind),
    );
  }
});

test('detects a scored copy from an untouched committed manifest and rejects it in ordinary mode', async () => {
  await withGitRepository(
    async (root) => {
      const source = JSON.parse(await readFile(path.join(root, 'registry', 'apps', 'prior-proposal.json'), 'utf8'));
      source.id = 'copied-proposal';
      source.name = 'Copied Proposal';
      await writeFile(
        path.join(root, 'registry', 'apps', 'copied-proposal.json'),
        `${JSON.stringify(source, null, 2)}\n`,
      );
    },
    async (root, base) => {
      const changes = await checkBaseDiff(base, { root, allowMaintenance: true });
      assert.ok(
        changes.some((change) =>
          change.status === 'C' &&
          /^\d+$/.test(change.score) &&
          change.from === 'registry/apps/prior-proposal.json' &&
          change.to === 'registry/apps/copied-proposal.json'),
      );
      await assert.rejects(checkBaseDiff(base, { root }), /existing app manifest|catalog maintenance/i);
    },
    {
      prepareBase: async (root) => addManifest(root, {
        id: 'prior-proposal',
        name: 'Prior Proposal',
      }),
    },
  );
});

test('keeps the untrusted pull-request workflow read-only', async () => {
  const workflow = yaml.load(await readFile(path.join(repositoryRoot, '.github', 'workflows', 'build.yml'), 'utf8'));
  const checkout = workflow.jobs.build.steps.find((step) => step.uses === 'actions/checkout@v4');

  assert.deepEqual(workflow.permissions, { contents: 'read' });
  assert.equal(checkout.with['fetch-depth'], 0);
  assert.equal(checkout.with['persist-credentials'], false);
});

test('runs catalog policy only from a trusted base checkout against pull-request data', async () => {
  const workflow = yaml.load(await readFile(policyWorkflowPath, 'utf8'));
  const steps = workflow.jobs.policy.steps;
  const policyCheckout = steps.find((step) => step.name === 'Checkout trusted policy');
  const proposedCheckout = steps.find((step) => step.name === 'Checkout proposed data');
  const setupNode = steps.find((step) => step.uses === 'actions/setup-node@v4');
  const install = steps.find((step) => step.run === 'npm ci --ignore-scripts');
  const validate = steps.find((step) => typeof step.run === 'string' && step.run.includes('app-registry.mjs check'));
  const maintenanceValidate = steps.find((step) => typeof step.run === 'string' && step.run.includes('--allow-maintenance'));

  assert.equal(workflow.on.pull_request_target.branches[0], 'main');
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  assert.equal(workflow.concurrency['cancel-in-progress'], true);
  assert.equal(policyCheckout.with.ref, '${{ github.event.pull_request.base.sha }}');
  assert.equal(policyCheckout.with.path, 'policy');
  assert.equal(proposedCheckout.with.ref, 'refs/pull/${{ github.event.pull_request.number }}/merge');
  assert.equal(proposedCheckout.with.path, 'proposed');
  for (const checkout of [policyCheckout, proposedCheckout]) {
    assert.equal(checkout.with['fetch-depth'], 0);
    assert.equal(checkout.with['persist-credentials'], false);
    assert.equal(checkout.with.submodules, false);
    assert.equal(checkout.with.lfs, false);
  }
  assert.equal(setupNode.with['node-version-file'], 'policy/.node-version');
  assert.equal(install['working-directory'], 'policy');
  assert.equal(validate['working-directory'], 'policy');
  assert.match(validate.run, /^node scripts\/app-registry\.mjs check --root "\.\.\/proposed" --base /);
  assert.match(maintenanceValidate.if, /catalog-maintenance/);
  assert.equal(maintenanceValidate['working-directory'], 'policy');
  assert.ok(steps.every((step) => step['working-directory'] !== 'proposed'));
  assert.ok(steps.filter((step) => typeof step.run === 'string').every((step) => {
    return !/proposed\/(?:package\.json|scripts\/app-registry\.mjs)/.test(step.run) && !/^npm\b.*proposed/i.test(step.run);
  }));
});

test('trusted policy rejects a non-proposed manifest even when the proposed checkout disables its own scripts', async () => {
  await withProposedCheckout(
    async (root) => {
      await addManifest(root, {
        listing_status: 'coming_soon',
        reviewed_at: '2026-08-29',
      });
      const manifest = path.join(root, 'registry', 'apps', 'city-notes.json');
      const app = JSON.parse(await readFile(manifest, 'utf8'));
      delete app.submitted_at;
      delete app.support_url;
      delete app.privacy_url;
      await writeFile(manifest, `${JSON.stringify(app, null, 2)}\n`);
      await writeGeneratedCatalogOutputs(root);
    },
    async (root, base) => {
      await assert.rejects(
        runTrustedPolicy(['check', '--root', root, '--base', base], { cwd: repositoryRoot }),
        /must be proposed with API availability none/i,
      );
    },
  );
});

test('accepts a proposed registry root for check but rejects root misuse', async () => {
  await assert.doesNotReject(runTrustedPolicy(['check', '--root', repositoryRoot], { cwd: repositoryRoot }));

  for (const [args, message] of [
    [['check', '--root'], /--root requires a path/i],
    [['check', '--root', repositoryRoot, '--root', repositoryRoot], /root may be supplied only once/i],
    [['generate', '--root', repositoryRoot], /Generate does not accept --root/i],
  ]) {
    await assert.rejects(runTrustedPolicy(args, { cwd: repositoryRoot }), message);
  }
});

test('resolves a relative proposed root from the separate trusted policy working directory', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'mainsworld-policy-cwd-'));
  try {
    const policy = path.join(root, 'policy');
    const proposed = path.join(root, 'proposed');
    await Promise.all([
      mkdir(policy),
      cp(path.join(repositoryRoot, 'registry'), path.join(proposed, 'registry'), { recursive: true }),
      cp(path.join(repositoryRoot, 'static'), path.join(proposed, 'static'), { recursive: true }),
      cp(path.join(repositoryRoot, 'docs', 'developers'), path.join(proposed, 'docs', 'developers'), { recursive: true }),
    ]);
    await assert.doesNotReject(runTrustedPolicy(['check', '--root', '../proposed'], { cwd: policy }));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects missing and duplicate base or maintenance CLI options', async () => {
  for (const [args, message] of [
    [['check', '--base'], /--base requires a commit/i],
    [['check', '--base', 'HEAD', '--base', 'HEAD'], /base may be supplied only once/i],
    [['check', '--allow-maintenance'], /--allow-maintenance requires --base/i],
    [['check', '--base', 'HEAD', '--allow-maintenance', '--allow-maintenance'], /allow-maintenance option may be supplied only once/i],
  ]) {
    await assert.rejects(runTrustedPolicy(args, { cwd: repositoryRoot }), message);
  }
});

test('strictly validates catalog metadata before it becomes public output', async () => {
  await assert.doesNotReject(validateCatalog(validCatalog));

  for (const [name, mutate, message] of [
    ['unknown field', (catalog) => { catalog.secret = 'nope'; }, /unknown|secret/i],
    ['bad schema', (catalog) => { catalog.schema_version = 'v2'; }, /schema/i],
    ['unsafe repository', (catalog) => { catalog.space_source.repository = 'https://github.com/other/project'; }, /repository/i],
    ['invalid revision', (catalog) => { catalog.space_source.revision = 'ABC'; }, /revision/i],
    ['traversal source path', (catalog) => { catalog.space_source.paths = ['../private.ts']; }, /path/i],
    ['backslash source path', (catalog) => { catalog.space_source.paths = ['src\\private.ts']; }, /path/i],
    ['URL source path', (catalog) => { catalog.space_source.paths = ['https://private.example/file.ts']; }, /path/i],
    ['unsupported source extension', (catalog) => { catalog.space_source.paths = ['src/source.json']; }, /path/i],
    ['duplicate source path', (catalog) => { catalog.space_source.paths = ['src/source.ts', 'src/source.ts']; }, /path/i],
  ]) {
    const catalog = structuredClone(validCatalog);
    mutate(catalog);
    await assert.rejects(validateCatalog(catalog), message, name);
  }

  await withCatalog(validCatalog, async (root) => {
    const first = await loadCatalog(root);
    const second = await loadCatalog(root);
    assert.notEqual(first, second);
    assert.notEqual(first.space_source, second.space_source);
  });
});

test('treats catalog metadata as maintenance-only while still validating it', async () => {
  await withGitRepository(
    async (root) => {
      const filename = path.join(root, 'registry', 'catalog.json');
      const catalog = JSON.parse(await readFile(filename, 'utf8'));
      catalog.catalog_version = '2026-08-30';
      await writeFile(filename, `${JSON.stringify(catalog, null, 2)}\n`);
    },
    async (root, base) => {
      await assert.rejects(checkBaseDiff(base, { root }), /catalog.*maintenance/i);
      await assert.doesNotReject(checkBaseDiff(base, { root, allowMaintenance: true }));
    },
  );
});

test('trusted policy rejects malicious catalog metadata despite proposed no-op scripts', async () => {
  await withProposedCheckout(
    async (root) => {
      const filename = path.join(root, 'registry', 'catalog.json');
      const catalog = JSON.parse(await readFile(filename, 'utf8'));
      catalog.space_source.paths = ['https://private.example/hidden.ts'];
      await writeFile(filename, `${JSON.stringify(catalog, null, 2)}\n`);
    },
    async (root) => {
      await assert.rejects(
        runTrustedPolicy(['check', '--root', root], { cwd: repositoryRoot }),
        /catalog|path/i,
      );
    },
  );
});

test('requires maintenance permission for platform and snapshot changes while preserving release validation', async () => {
  for (const mutate of [
    async (root) => {
      const filename = path.join(root, 'registry', 'platform.json');
      await writeFile(filename, `${await readFile(filename, 'utf8')}\n`);
    },
    async (root) => {
      const filename = path.join(root, 'static', 'api', 'connectives', 'v1', 'openapi.json');
      const bytes = await readFile(filename);
      await writeFile(filename, Buffer.concat([bytes, Buffer.from(' ')]));
      const platformPath = path.join(root, 'registry', 'platform.json');
      const platform = JSON.parse(await readFile(platformPath, 'utf8'));
      platform.artifacts.openapi.sha256 = createHash('sha256').update(await readFile(filename)).digest('hex');
      await writeFile(platformPath, `${JSON.stringify(platform, null, 2)}\n`);
    },
  ]) {
    await withGitRepository(mutate, async (root, base) => {
      await assert.rejects(checkBaseDiff(base, { root }), /platform|snapshot|catalog maintenance/i);
      await assert.doesNotReject(checkBaseDiff(base, { root, allowMaintenance: true }));
    });
  }
});

test('does not allow maintenance mode to bypass release validation', async () => {
  await withGitRepository(async (root) => {
    const filename = path.join(root, 'static', 'api', 'connectives', 'v1', 'openapi.json');
    await writeFile(filename, `${await readFile(filename, 'utf8')} `);
  }, async (root, base) => {
    await assert.rejects(
      checkBaseDiff(base, { root, allowMaintenance: true }),
      /hash/i,
    );
  });
});

test('rejects an invalid base commit explicitly', async () => {
  await assert.rejects(checkBaseDiff('not-a-commit', { root: repositoryRoot }), /base/i);
});

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

test('rejects malformed public DNS labels', async () => {
  const tooLongLabel = `${'a'.repeat(64)}.org`;
  const tooLongHostname = `${'a.'.repeat(126)}aa`;

  for (const [name, hostname] of [
    ['empty label', 'foo..bar'],
    ['double root dot', 'foo.bar..'],
    ['triple root dot', 'foo.bar...'],
    ['leading hyphen', '-foo.bar'],
    ['trailing hyphen', 'foo-.bar'],
    ['64-character label', tooLongLabel],
    ['254-character hostname', tooLongHostname],
  ]) {
    const app = { ...clone(validApp), website: `https://${hostname}/` };
    await assert.rejects(validateRegistry([app]), /public HTTPS URL/i, name);
  }
});

test('accepts a syntactically valid punycode DNS hostname', async () => {
  const app = { ...clone(validApp), website: 'https://xn--bcher-kva.com/' };
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
    'clientIdentifier',
    'client_identifier',
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

test('loads every approved SPACE app with its honest status and capability mapping', async () => {
  const apps = await loadRegistry(repositoryRoot);
  assert.equal(apps.length, 18);
  assert.deepEqual(
    apps.map((app) => [app.id, app.listing_status, app.api_availability, app.capabilities]),
    expectedApps,
  );
  assert.deepEqual(
    Object.fromEntries(
      ['connected', 'first_party', 'coming_soon', 'proposed', 'wishlist'].map((status) => [
        status,
        apps.filter((app) => app.listing_status === status).length,
      ]),
    ),
    { connected: 1, first_party: 1, coming_soon: 6, proposed: 0, wishlist: 10 },
  );
});

test('validates the pinned non-callable preview platform and its exact snapshot hashes', async () => {
  const platform = await loadPlatform(repositoryRoot);
  assert.equal(platform.callable, false);
  assert.equal(platform.source_repository_access, 'restricted');
  assert.equal(platform.source_revision, '3da5ce3fb92dc63910a6b59dabd817f15097d35f');
  assert.deepEqual(platform.scopes, [
    'candidate-status:read',
    'link-sessions:create',
    'vibe-candidates:write',
  ]);
  assert.deepEqual(platform.operations.map(({ method, path: operationPath }) => [method, operationPath]), expectedOperations);
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(platform.artifacts).map(([name, artifact]) => [
        name,
        [artifact.source_path, artifact.public_snapshot_path, artifact.sha256],
      ]),
    ),
    {
      openapi: ['openapi/connectives-v1.json', '/api/connectives/v1/openapi.json', 'ca58c4f5166f09ff59fa5009a172d29536bc6c3b2552ad239b7193fce061380e'],
      discord_example: ['openapi/examples/discord-connected-group-membership.json', '/api/connectives/v1/discord-connected-group-membership.json', '4043b1ef41de71271352145f6a8fbb3e400e3d34e9d09d070d6b5791e78ca1db'],
      luma_example: ['openapi/examples/luma-vibe-candidate.json', '/api/connectives/v1/luma-vibe-candidate.json', '499d12a33183ce6fed9335fa3021d79ba2da30205d1d80d2e8c4017d3f6358a9'],
    },
  );
  const contract = JSON.parse(
    await readFile(path.join(repositoryRoot, 'static', 'api', 'connectives', 'v1', 'openapi.json'), 'utf8'),
  );
  assert.equal('servers' in contract, false);
  assert.equal(contract.components.securitySchemes.PartnerOAuth.flows.clientCredentials.tokenUrl, '/oauth/token');
  await assert.doesNotReject(validatePlatform(platform, repositoryRoot));
});

test('allows only the exact non-routable OpenAPI transition while preserving the legacy preview', async () => {
  const exactServer = {
    url: 'https://example.invalid',
    description: 'Non-callable documentation preview. No network endpoint exists.',
  };
  const setTransition = (contract) => {
    contract.servers = [structuredClone(exactServer)];
    contract.components.securitySchemes.PartnerOAuth.flows.clientCredentials.tokenUrl =
      'https://example.invalid/oauth/token';
  };

  await withMutatedOpenApi(setTransition, async (platform, root) => {
    await assert.doesNotReject(validatePlatform(platform, root));
  });

  const invalidTransitions = [
    ['server without the matching token URL', (contract) => {
      contract.servers = [structuredClone(exactServer)];
    }],
    ['token URL without the matching server', (contract) => {
      contract.components.securitySchemes.PartnerOAuth.flows.clientCredentials.tokenUrl =
        'https://example.invalid/oauth/token';
    }],
    ['an empty server list', (contract) => {
      setTransition(contract);
      contract.servers = [];
    }],
    ['an extra server', (contract) => {
      setTransition(contract);
      contract.servers.push(structuredClone(exactServer));
    }],
    ['a different invalid server URL', (contract) => {
      setTransition(contract);
      contract.servers[0].url = 'https://preview.example.invalid';
    }],
    ['a routable server URL', (contract) => {
      setTransition(contract);
      contract.servers[0].url = 'https://api.mains.world';
    }],
    ['a private server URL', (contract) => {
      setTransition(contract);
      contract.servers[0].url = 'https://127.0.0.1';
    }],
    ['a wrong server description', (contract) => {
      setTransition(contract);
      contract.servers[0].description = 'Preview endpoint.';
    }],
    ['a wrong transition token URL', (contract) => {
      setTransition(contract);
      contract.components.securitySchemes.PartnerOAuth.flows.clientCredentials.tokenUrl =
        'https://example.invalid/token';
    }],
    ['a path-level server override', (contract) => {
      setTransition(contract);
      contract.paths['/oauth/token'].servers = [];
    }],
    ['an operation-level server override', (contract) => {
      setTransition(contract);
      contract.paths['/oauth/token'].post.servers = [];
    }],
    ['an otherwise allowed URL outside the approved locations', (contract) => {
      setTransition(contract);
      contract.documentation_url = 'https://example.invalid';
    }],
  ];

  for (const [label, mutate] of invalidTransitions) {
    await withMutatedOpenApi(mutate, async (platform, root) => {
      await assert.rejects(validatePlatform(platform, root), /server|token|unsafe|url|operation|path/i, label);
    });
  }
});

test('rejects reserved URL location collisions and nested server overrides', async () => {
  const exactServer = {
    url: 'https://example.invalid',
    description: 'Non-callable documentation preview. No network endpoint exists.',
  };
  const setTransition = (contract) => {
    contract.servers = [structuredClone(exactServer)];
    contract.components.securitySchemes.PartnerOAuth.flows.clientCredentials.tokenUrl =
      'https://example.invalid/oauth/token';
  };

  for (const [label, mutate] of [
    ['a dotted token path key', (contract) => {
      setTransition(contract);
      contract['components.securitySchemes.PartnerOAuth.flows.clientCredentials.tokenUrl'] =
        'https://example.invalid/oauth/token';
    }],
    ['a bracketed server path key', (contract) => {
      setTransition(contract);
      contract['servers[0].url'] = 'https://example.invalid';
    }],
    ['a legacy component Path Item server', (contract) => {
      contract.components.pathItems = {
        callbackTarget: { servers: [{ url: 'https://api.mains.world' }] },
      };
    }],
    ['a transition callback Path Item server', (contract) => {
      setTransition(contract);
      contract.paths['/oauth/token'].post.callbacks = {
        candidateReady: {
          '{$request.body#/callback}': {
            post: { servers: [{ url: 'https://api.mains.world' }] },
          },
        },
      };
    }],
  ]) {
    await withMutatedOpenApi(mutate, async (platform, root) => {
      await assert.rejects(validatePlatform(platform, root), /server|unsafe|url/i, label);
    });
  }
});

test('rejects direct path and operation servers in legacy and transition modes', async () => {
  const exactServer = {
    url: 'https://example.invalid',
    description: 'Non-callable documentation preview. No network endpoint exists.',
  };
  const setTransition = (contract) => {
    contract.servers = [structuredClone(exactServer)];
    contract.components.securitySchemes.PartnerOAuth.flows.clientCredentials.tokenUrl =
      'https://example.invalid/oauth/token';
  };

  for (const [label, mutate] of [
    ['a legacy path server', (contract) => {
      contract.paths['/oauth/token'].servers = [];
    }],
    ['a legacy operation server', (contract) => {
      contract.paths['/oauth/token'].post.servers = [];
    }],
    ['a transition path server', (contract) => {
      setTransition(contract);
      contract.paths['/oauth/token'].servers = [];
    }],
    ['a transition operation server', (contract) => {
      setTransition(contract);
      contract.paths['/oauth/token'].post.servers = [];
    }],
  ]) {
    await withMutatedOpenApi(mutate, async (platform, root) => {
      await assert.rejects(validatePlatform(platform, root), /server|override/i, label);
    });
  }
});

test('rejects altered snapshot bytes and contract deployment claims', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'mainsworld-platform-'));
  try {
    await cp(path.join(repositoryRoot, 'registry'), path.join(root, 'registry'), { recursive: true });
    await cp(path.join(repositoryRoot, 'static', 'api'), path.join(root, 'static', 'api'), { recursive: true });
    const platform = await loadPlatform(root);
    const openapiPath = path.join(root, 'static', 'api', 'connectives', 'v1', 'openapi.json');
    await writeFile(openapiPath, `${await readFile(openapiPath, 'utf8')} `);
    await assert.rejects(validatePlatform(platform, root), /hash/i);

    await cp(path.join(repositoryRoot, 'static', 'api'), path.join(root, 'static', 'api'), { recursive: true, force: true });
    const contract = JSON.parse(await readFile(openapiPath, 'utf8'));
    contract.x_provider_client_id = 'discord_123456789';
    await writeFile(openapiPath, `${JSON.stringify(contract, null, 2)}\n`);
    platform.artifacts.openapi.sha256 = createHash('sha256')
      .update(await readFile(openapiPath))
      .digest('hex');
    await assert.rejects(validatePlatform(platform, root), /unsafe|callable/i);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects unsafe preview metadata while allowing normative OpenAPI field vocabulary', async () => {
  const platform = await loadPlatform(repositoryRoot);
  const unsafe = structuredClone(platform);
  unsafe.callback_url = 'https://private.mains.world/callback';
  await assert.rejects(validatePlatform(unsafe, repositoryRoot), /unknown|unsafe|callback/i);

  const copiedContract = JSON.parse(
    await readFile(path.join(repositoryRoot, 'static', 'api', 'connectives', 'v1', 'openapi.json'), 'utf8'),
  );
  assert.ok(JSON.stringify(copiedContract).includes('client_id'));
  assert.ok(JSON.stringify(copiedContract).includes('access_token'));
});

test('rejects a concrete callback URL even when the snapshot hash is recomputed', async () => {
  await withMutatedOpenApi((contract) => {
    contract.redirect_uri = 'https://internal.mains.world/callback';
  }, async (platform, root) => {
    await assert.rejects(validatePlatform(platform, root), /unsafe|callback|url/i);
  });
});

test('rejects realistic token material even when the snapshot hash is recomputed', async () => {
  await withMutatedOpenApi((contract) => {
    contract.examples = { access_token: 'ghp_abcdefghijklmnopqrstuvwxyz0123456789' };
  }, async (platform, root) => {
    await assert.rejects(validatePlatform(platform, root), /unsafe|secret|token/i);
  });
});

test('rejects a concrete private service URL even when the snapshot hash is recomputed', async () => {
  await withMutatedOpenApi((contract) => {
    contract.service_url = 'https://10.0.0.1/api';
  }, async (platform, root) => {
    await assert.rejects(validatePlatform(platform, root), /unsafe|service|url/i);
  });
});

test('rejects a deployment base URL even when the snapshot hash is recomputed', async () => {
  await withMutatedOpenApi((contract) => {
    contract['x-mains-world-base-url'] = 'https://api.mains.world';
  }, async (platform, root) => {
    await assert.rejects(validatePlatform(platform, root), /unsafe|base|url/i);
  });
});

test('rejects an undeclared standard HTTP operation even when it is marked non-callable', async () => {
  await withMutatedOpenApi((contract) => {
    contract.paths['/connectives/v1/hidden'] = {
      delete: { 'x-mains-world-callable': false },
    };
  }, async (platform, root) => {
    await assert.rejects(validatePlatform(platform, root), /operation|path/i);
  });
});

test('renders deterministic public catalog outputs from validated inputs', async () => {
  const apps = await loadRegistry(repositoryRoot);
  const catalog = JSON.parse(await readFile(path.join(repositoryRoot, 'registry', 'catalog.json'), 'utf8'));
  const platform = await loadPlatform(repositoryRoot);
  const json = renderAppsJson(catalog, apps);
  const markdown = renderAppsMarkdown(apps);
  const llms = renderLlmsFull(catalog, apps, platform);

  assert.deepEqual(JSON.parse(json), {
    schema_version: 'v1',
    catalog_version: '2026-08-29',
    space_source: catalog.space_source,
    apps,
  });
  for (const [id, status, api, capabilities] of expectedApps) {
    assert.match(markdown, new RegExp(`\\[${apps.find((app) => app.id === id).name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\]`));
    assert.match(markdown, new RegExp(status.replace('_', ' '), 'i'));
    assert.match(markdown, new RegExp(api.replace('_', ' '), 'i'));
    assert.match(markdown, new RegExp(capabilities.join(', ')));
  }
  assert.match(llms, /There are no public, self-service Main's World API endpoints to call today\./);
  assert.match(llms, /No base URL, credential, sandbox, public endpoint, or MCP endpoint exists\./);
  for (const [method, operationPath] of expectedOperations) assert.match(llms, new RegExp(`${method} ${operationPath.replace(/[{}]/g, '\\$&')}`));
  assert.equal(renderAppsJson(catalog, apps), json);
  assert.equal(renderAppsMarkdown(apps), markdown);
  assert.equal(renderLlmsFull(catalog, apps, platform), llms);
});
