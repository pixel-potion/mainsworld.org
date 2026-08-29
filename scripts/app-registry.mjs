import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { isIP } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(moduleDirectory, '..');
const schemaPath = path.join(repositoryRoot, 'registry', 'schema', 'app-v1.schema.json');
const generatedOutputs = {
  appsMarkdown: path.join('docs', 'developers', 'apps.md'),
  appsJson: path.join('static', 'apps.json'),
  llmsFull: path.join('static', 'llms-full.txt'),
};
const STATUS_RANK = {
  connected: 0,
  first_party: 1,
  coming_soon: 2,
  proposed: 3,
  wishlist: 4,
};
const publicUrlFields = [
  'website',
  'support_url',
  'privacy_url',
  'api_contract_url',
  'status_evidence_url',
];
const prohibitedTokens = new Set([
  'secret',
  'token',
  'credential',
  'callback',
  'identity',
  'wallet',
  'grant',
]);
const prohibitedCompoundKeys = new Set([
  'clientid',
  'clientidentifier',
  'userid',
  'useridentifier',
  'mainid',
  'mainidentifier',
  'mainaccount',
  'mainaddress',
  'mainuuid',
  'internalendpoint',
  'internalurl',
  'internalhost',
  'internalservice',
]);
const reservedDnsSuffixes = [
  'localhost',
  'local',
  'test',
  'invalid',
  'example',
  'example.com',
  'example.net',
  'example.org',
  'arpa',
  'alt',
  'onion',
  'internal',
  'home',
  'lan',
  'corp',
];

let validateApp;

const platformKeys = new Set([
  'schema_version', 'status', 'callable', 'source_repository',
  'source_repository_access', 'source_revision', 'artifacts', 'scopes', 'operations',
]);
const artifactKeys = new Set(['source_path', 'public_snapshot_path', 'sha256']);
const operationKeys = new Set(['method', 'path']);
const requiredScopes = [
  'candidate-status:read',
  'link-sessions:create',
  'vibe-candidates:write',
];
const requiredOperations = [
  ['POST', '/oauth/token'],
  ['POST', '/connectives/v1/link-sessions'],
  ['GET', '/connectives/v1/link-sessions/{session_id}'],
  ['POST', '/connectives/v1/grants/{grant_id}/vibe-candidates'],
  ['GET', '/connectives/v1/grants/{grant_id}/candidates/{candidate_id}'],
];
const standardHttpMethods = new Set([
  'get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace',
]);
const snapshotConcreteUrlKeys = new Set([
  'redirecturi', 'callbackurl', 'webhookurl', 'serviceurl', 'baseurl',
  'serverurl', 'endpointurl', 'deploymenturl', 'xmainsworldbaseurl',
]);
const snapshotConcreteIdentifierKeys = new Set([
  'providerclientid', 'providerappid', 'providerapplicationid',
  'xproviderclientid', 'xproviderappid', 'xproviderapplicationid',
]);
const snapshotConcreteCredentialKeys = new Set([
  'secret', 'clientsecret', 'privatekey', 'apikey', 'accesstoken',
  'refreshtoken', 'idtoken', 'authorization',
]);
const snapshotCredentialPatterns = [
  /\bghp_[A-Za-z0-9]{20,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  /\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{12,}\b/i,
  /\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+\/-]{16,}\b/i,
];
const expectedArtifactPaths = {
  openapi: ['openapi/connectives-v1.json', '/api/connectives/v1/openapi.json'],
  discord_example: [
    'openapi/examples/discord-connected-group-membership.json',
    '/api/connectives/v1/discord-connected-group-membership.json',
  ],
  luma_example: [
    'openapi/examples/luma-vibe-candidate.json',
    '/api/connectives/v1/luma-vibe-candidate.json',
  ],
};

function tokenizeKey(key) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((token) => token.toLowerCase());
}

function hasTokenSequence(tokens, sequence) {
  return tokens.some((_, start) =>
    sequence.every((token, index) => tokens[start + index] === token),
  );
}

function isProhibitedKey(key) {
  const tokens = tokenizeKey(key);
  const compactKey = tokens.join('');

  return (
    tokens.some((token) => prohibitedTokens.has(token)) ||
    prohibitedCompoundKeys.has(compactKey) ||
    hasTokenSequence(tokens, ['client', 'id']) ||
    hasTokenSequence(tokens, ['client', 'identifier']) ||
    hasTokenSequence(tokens, ['user', 'id']) ||
    hasTokenSequence(tokens, ['user', 'identifier']) ||
    hasTokenSequence(tokens, ['main', 'user', 'id']) ||
    hasTokenSequence(tokens, ['main', 'user', 'identifier']) ||
    hasTokenSequence(tokens, ['main', 'id']) ||
    hasTokenSequence(tokens, ['main', 'identifier']) ||
    hasTokenSequence(tokens, ['main', 'account']) ||
    hasTokenSequence(tokens, ['main', 'address']) ||
    hasTokenSequence(tokens, ['main', 'uuid']) ||
    hasTokenSequence(tokens, ['internal', 'endpoint']) ||
    hasTokenSequence(tokens, ['internal', 'url']) ||
    hasTokenSequence(tokens, ['internal', 'host']) ||
    hasTokenSequence(tokens, ['internal', 'service'])
  );
}

function findProhibitedKey(value, location = '$') {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const found = findProhibitedKey(item, `${location}[${index}]`);
      if (found) return found;
    }
    return null;
  }

  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (isProhibitedKey(key)) {
        return `${location}.${key}`;
      }
      const found = findProhibitedKey(child, `${location}.${key}`);
      if (found) return found;
    }
  }

  return null;
}

function isValidDnsHostname(hostname) {
  if (hostname.length > 253) return false;

  return hostname.split('.').every(
    (label) =>
      label.length > 0 &&
      label.length <= 63 &&
      /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label),
  );
}

function isPublicHttpsUrl(value) {
  try {
    const url = new URL(value);
    const parsedHostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    const hostname = parsedHostname.endsWith('.') ? parsedHostname.slice(0, -1) : parsedHostname;

    if (url.protocol !== 'https:' || url.username || url.password || !hostname) {
      return false;
    }

    if (isIP(hostname) || !hostname.includes('.') || !isValidDnsHostname(hostname)) {
      return false;
    }
    if (
      reservedDnsSuffixes.some(
        (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`),
      )
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

function findNonPublicUrl(record) {
  if (!record || typeof record !== 'object') return null;

  for (const field of publicUrlFields) {
    if (field in record && !isPublicHttpsUrl(record[field])) return field;
  }

  return null;
}

async function getValidator() {
  if (validateApp) return validateApp;

  const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
  const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
    strictRequired: false,
  });
  addFormats(ajv);
  validateApp = ajv.compile(schema);
  return validateApp;
}

function formatSchemaErrors(errors) {
  return errors
    .map(({ instancePath, message }) => `${instancePath || '$'} ${message}`)
    .join('; ');
}

export async function validateRegistry(records) {
  if (!Array.isArray(records)) {
    throw new TypeError('Registry records must be an array.');
  }

  const validator = await getValidator();
  const ids = new Set();

  for (const record of records) {
    const prohibitedKey = findProhibitedKey(record);
    if (prohibitedKey) {
      throw new Error(`Prohibited field name at ${prohibitedKey}.`);
    }

    if (!validator(record)) {
      throw new Error(`Schema validation failed: ${formatSchemaErrors(validator.errors)}`);
    }

    const nonPublicUrl = findNonPublicUrl(record);
    if (nonPublicUrl) {
      throw new Error(`Public HTTPS URL required for ${nonPublicUrl}.`);
    }

    if (ids.has(record.id)) {
      throw new Error(`Duplicate app ID: ${record.id}`);
    }
    ids.add(record.id);
  }

  return records;
}

export async function loadRegistry(root = repositoryRoot) {
  const appsDirectory = path.join(root, 'registry', 'apps');
  const filenames = (await readdir(appsDirectory))
    .filter((filename) => filename.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right, 'en'));
  const records = [];

  for (const filename of filenames) {
    const record = JSON.parse(await readFile(path.join(appsDirectory, filename), 'utf8'));
    if (filename !== `${record.id}.json`) {
      throw new Error(`Manifest filename ${filename} must match ID ${record.id}.`);
    }
    records.push(record);
  }

  await validateRegistry(records);

  return records
    .map((record) => structuredClone(record))
    .sort(
      (left, right) =>
        STATUS_RANK[left.listing_status] - STATUS_RANK[right.listing_status] ||
        left.name.localeCompare(right.name, 'en'),
    );
}

function assertExactKeys(value, allowedKeys, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${name} must be an object.`);
  }
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) throw new Error(`${name} contains unknown key ${key}.`);
  }
}

function assertSafeArtifact(artifact, name) {
  assertExactKeys(artifact, artifactKeys, `Artifact ${name}`);
  if (
    typeof artifact.source_path !== 'string' ||
    !/^(?:openapi\/)?(?:examples\/)?[a-z0-9-]+\.json$/.test(artifact.source_path) ||
    artifact.source_path.includes('..') ||
    typeof artifact.public_snapshot_path !== 'string' ||
    !/^\/api\/connectives\/v1\/[a-z0-9-]+\.json$/.test(artifact.public_snapshot_path) ||
    !/^[a-f0-9]{64}$/.test(artifact.sha256)
  ) {
    throw new Error(`Artifact ${name} has unsafe snapshot metadata.`);
  }
}

function formatLabel(value) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function snapshotDiskPath(root, publicSnapshotPath) {
  return path.join(root, 'static', publicSnapshotPath.replace(/^\//, ''));
}

function compactSnapshotKey(key) {
  return key.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function isUnsafeSnapshotUrl(value) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
    if (hostname === 'cdn.example.test') return false;
    return (
      isIP(hostname) !== 0 ||
      hostname === 'localhost' ||
      ['internal', 'local', 'lan', 'corp', 'home', 'onion', 'invalid', 'arpa', 'alt'].some(
        (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`),
      ) ||
      hostname.endsWith('.test')
    );
  } catch {
    return false;
  }
}

function findUnsafeSnapshotValue(value, location = '$', parentKey = '') {
  if (typeof value === 'string') {
    if (snapshotCredentialPatterns.some((pattern) => pattern.test(value))) {
      return `${location} contains concrete credential material`;
    }
    if (snapshotConcreteCredentialKeys.has(compactSnapshotKey(parentKey)) && value.length > 0) {
      return `${location} contains concrete credential material`;
    }
    if (snapshotConcreteUrlKeys.has(compactSnapshotKey(parentKey)) && /^https?:\/\//i.test(value)) {
      return `${location} contains a concrete ${parentKey}`;
    }
    if (snapshotConcreteIdentifierKeys.has(compactSnapshotKey(parentKey)) && value.length >= 6) {
      return `${location} contains a concrete provider identifier`;
    }
    if (isUnsafeSnapshotUrl(value)) return `${location} contains a private or internal URL`;
    return null;
  }

  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const found = findUnsafeSnapshotValue(item, `${location}[${index}]`, parentKey);
      if (found) return found;
    }
    return null;
  }

  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (key === 'x-mains-world-callable' && child === true) {
        return `${location}.${key} makes the snapshot callable`;
      }
      const found = findUnsafeSnapshotValue(child, `${location}.${key}`, key);
      if (found) return found;
    }
  }
  return null;
}

function contractOperations(contract) {
  return Object.entries(contract.paths ?? []).flatMap(([operationPath, methods]) =>
    Object.entries(methods)
      .filter(([method, operation]) => standardHttpMethods.has(method.toLowerCase()) && operation && typeof operation === 'object')
      .map(([method, operation]) => ({ method: method.toUpperCase(), path: operationPath, operation })),
  );
}

export async function loadPlatform(root = repositoryRoot) {
  return JSON.parse(await readFile(path.join(root, 'registry', 'platform.json'), 'utf8'));
}

export async function validatePlatform(platform, root = repositoryRoot) {
  assertExactKeys(platform, platformKeys, 'Platform');
  if (
    platform.schema_version !== 'v1' ||
    platform.status !== 'preview' ||
    platform.callable !== false ||
    platform.source_repository !== 'https://github.com/pixel-potion/Mains.World' ||
    platform.source_repository_access !== 'restricted' ||
    !/^[a-f0-9]{40}$/.test(platform.source_revision) ||
    !Array.isArray(platform.scopes) ||
    !Array.isArray(platform.operations) ||
    !platform.artifacts || typeof platform.artifacts !== 'object' || Array.isArray(platform.artifacts)
  ) {
    throw new Error('Platform has invalid preview metadata.');
  }
  if (JSON.stringify(platform.scopes) !== JSON.stringify(requiredScopes)) {
    throw new Error('Platform scopes must match the reviewed preview scopes.');
  }
  if (Object.keys(platform.artifacts).sort().join(',') !== 'discord_example,luma_example,openapi') {
    throw new Error('Platform must describe exactly the three reviewed snapshots.');
  }
  for (const [name, artifact] of Object.entries(platform.artifacts)) {
    assertSafeArtifact(artifact, name);
    const [sourcePath, publicSnapshotPath] = expectedArtifactPaths[name];
    if (artifact.source_path !== sourcePath || artifact.public_snapshot_path !== publicSnapshotPath) {
      throw new Error(`Artifact ${name} must use its reviewed source and public snapshot paths.`);
    }
  }
  for (const operation of platform.operations) {
    assertExactKeys(operation, operationKeys, 'Platform operation');
  }
  if (
    JSON.stringify(platform.operations.map(({ method, path: operationPath }) => [method, operationPath])) !==
    JSON.stringify(requiredOperations)
  ) {
    throw new Error('Platform operations must match the reviewed preview operations.');
  }

  const snapshots = {};
  for (const [name, artifact] of Object.entries(platform.artifacts)) {
    const bytes = await readFile(snapshotDiskPath(root, artifact.public_snapshot_path));
    const digest = createHash('sha256').update(bytes).digest('hex');
    if (digest !== artifact.sha256) throw new Error(`Snapshot hash mismatch for ${name}.`);
    const snapshot = JSON.parse(bytes.toString('utf8'));
    const unsafeValue = findUnsafeSnapshotValue(snapshot);
    if (unsafeValue) throw new Error(`Snapshot ${name} is unsafe: ${unsafeValue}.`);
    snapshots[name] = snapshot;
  }

  const openapi = snapshots.openapi;
  if ('servers' in openapi || openapi['x-mains-world-status'] !== 'non-deployed-starter') {
    throw new Error('OpenAPI snapshot must remain non-deployed and have no server URL.');
  }
  const parsedOperations = contractOperations(openapi);
  const expectedPaths = [...new Set(requiredOperations.map(([, operationPath]) => operationPath))].sort();
  const actualPaths = Object.keys(openapi.paths ?? {}).sort();
  if (
    JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths) ||
    JSON.stringify(parsedOperations.map(({ method, path: operationPath }) => [method, operationPath])) !==
    JSON.stringify(requiredOperations) ||
    parsedOperations.some(({ operation }) => operation['x-mains-world-callable'] !== false)
  ) {
    throw new Error('OpenAPI snapshot does not match non-callable platform operations.');
  }
  const contractScopes = Object.keys(
    openapi.components?.securitySchemes?.PartnerOAuth?.flows?.clientCredentials?.scopes ?? {},
  );
  if (JSON.stringify(contractScopes.sort()) !== JSON.stringify([...requiredScopes].sort())) {
    throw new Error('OpenAPI snapshot scopes do not match platform metadata.');
  }
  return structuredClone(platform);
}

export function renderAppsJson(catalog, apps) {
  return `${JSON.stringify({
    schema_version: 'v1',
    catalog_version: catalog.catalog_version,
    space_source: catalog.space_source,
    apps,
  }, null, 2)}\n`;
}

export function renderAppsMarkdown(apps) {
  const rows = apps.map((app) =>
    `| [${app.name}](${app.website}) | ${formatLabel(app.listing_status)} | ${formatLabel(app.api_availability)} | ${app.capabilities.join(', ')} | ${app.summary} |`,
  );
  return `---\ntitle: Apps\n---\n\n# Apps in SPACE\n\nThis catalog shows every app represented in SPACE. A listing is not an activated integration or API grant.\n\n| App | Status | API availability | SPACE areas | Summary |\n| --- | --- | --- | --- | --- |\n${rows.join('\n')}\n\n## Status legend\n\n- **Connected**: a bespoke partner integration exists today.\n- **First party**: a Main's World capability, not a submitted partner app.\n- **Coming soon**: represented in SPACE but not connected or callable.\n- **Proposed**: a reviewed public listing that is not connected or activated.\n- **Wishlist**: a future possibility with no connector promised.\n`;
}

export function renderLlmsFull(catalog, apps, platform) {
  const operations = platform.operations.map(({ method, path: operationPath }) => `- ${method} ${operationPath} — Not callable`).join('\n');
  const artifacts = Object.values(platform.artifacts)
    .map(({ public_snapshot_path, sha256 }) => `- ${public_snapshot_path} (SHA-256: ${sha256})`)
    .join('\n');
  const rows = apps.map((app) =>
    `- ${app.name} (${app.id}): ${formatLabel(app.listing_status)}; API: ${formatLabel(app.api_availability)}; SPACE: ${app.capabilities.join(', ')}; ${app.website}`,
  ).join('\n');
  return `# Main's World public developer catalog\n\nThere are no public, self-service Main's World API endpoints to call today.\nNo base URL, credential, sandbox, public endpoint, or MCP endpoint exists.\n\nThe Connectives preview is read-only release documentation from the restricted normative source revision ${platform.source_revision}. It is not a runtime API and provides neither activation nor access.\n\n## Local preview snapshots\n\n${artifacts}\n\n## Preview scopes\n\n${platform.scopes.map((scope) => `- ${scope}`).join('\n')}\n\n## Preview operations\n\n${operations}\n\n## Listing and submission rules\n\nA merged manifest changes a public listing only. It never grants credentials, callbacks, provider access, runtime registration, or production activation. New external listings are proposed with no public API access until a separate reviewed promotion.\n\n## Status legend\n\n- Connected: bespoke partner integration exists today.\n- First party: Main's World operated capability.\n- Coming soon: represented, not connected or callable.\n- Proposed: reviewed listing, not connected or activated.\n- Wishlist: future possibility; no connector promised.\n\n## SPACE catalog (${catalog.catalog_version})\n\n${rows}\n`;
}

async function loadCatalog(root) {
  return JSON.parse(await readFile(path.join(root, 'registry', 'catalog.json'), 'utf8'));
}

async function renderAll(root) {
  const [catalog, apps, platform] = await Promise.all([loadCatalog(root), loadRegistry(root), loadPlatform(root)]);
  await validatePlatform(platform, root);
  return {
    [generatedOutputs.appsMarkdown]: renderAppsMarkdown(apps),
    [generatedOutputs.appsJson]: renderAppsJson(catalog, apps),
    [generatedOutputs.llmsFull]: renderLlmsFull(catalog, apps, platform),
  };
}

async function runCli() {
  const mode = process.argv[2];
  if (!['generate', 'check'].includes(mode) || process.argv.length !== 3) {
    throw new Error('Usage: node scripts/app-registry.mjs <generate|check>');
  }
  const rendered = await renderAll(repositoryRoot);
  if (mode === 'generate') {
    await Promise.all(Object.entries(rendered).map(async ([relativePath, content]) => {
      const outputPath = path.join(repositoryRoot, relativePath);
      await mkdir(path.dirname(outputPath), { recursive: true });
      await writeFile(outputPath, content);
    }));
    return;
  }
  const stale = [];
  for (const [relativePath, content] of Object.entries(rendered)) {
    try {
      if ((await readFile(path.join(repositoryRoot, relativePath), 'utf8')) !== content) stale.push(relativePath);
    } catch {
      stale.push(relativePath);
    }
  }
  if (stale.length) throw new Error(`Generated catalog outputs are stale: ${stale.join(', ')}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
