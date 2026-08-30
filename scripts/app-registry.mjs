import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { createHash } from 'node:crypto';
import { execFile as execFileCallback } from 'node:child_process';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { isIP } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual, promisify } from 'node:util';

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(moduleDirectory, '..');
const execFile = promisify(execFileCallback);
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
const catalogKeys = new Set(['schema_version', 'catalog_version', 'space_source']);
const catalogSourceKeys = new Set(['repository', 'revision', 'paths']);
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
const requiredOperationSecurity = [
  undefined,
  [{ PartnerOAuth: ['link-sessions:create'] }],
  [{ PartnerOAuth: ['link-sessions:create'] }],
  [{ PartnerOAuth: ['vibe-candidates:write'] }],
  [{ PartnerOAuth: ['candidate-status:read'] }],
];
const documentationServer = {
  url: 'https://example.invalid',
  description: 'Non-callable documentation preview. No network endpoint exists.',
};
const documentationTokenUrl = 'https://example.invalid/oauth/token';
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
const reviewedSnapshotHttpValues = {
  openapi: [
    { path: ['servers', 0, 'url'], value: 'https://example.invalid' },
    {
      path: ['components', 'securitySchemes', 'PartnerOAuth', 'flows', 'clientCredentials', 'tokenUrl'],
      value: 'https://example.invalid/oauth/token',
    },
  ],
  discord_example: [
    { path: ['display', 'icon_url'], value: 'https://cdn.example.test/icon.png' },
  ],
  luma_example: [],
};
const reviewedSyntheticSnapshots = {
  discord_example: {
    schema_version: '2026-08-29',
    profile: 'community.membership.v1',
    provider: 'discord',
    group_key: 'group_opaque_example',
    connection_grant_id: 'grant_opaque_example',
    display: {
      name: 'Pixel Potion Creative',
      icon_url: 'https://cdn.example.test/icon.png',
    },
    authority: 'owner',
    observed_at: '2026-08-29T18:00:00.000Z',
    valid_until: '2026-08-29T18:10:00.000Z',
    state: 'active',
  },
  luma_example: {
    schema_version: '2026-08-29',
    resource_family: 'vibe',
    profile: 'calendar.event.v1',
    external_id: 'example-luma-event',
    revision: 1,
    payload: {
      label: 'Sunset VHS Swap',
      world: 'land',
      latitude: 0,
      longitude: 0,
      place_name: 'Example Hall',
      place_address: '100 Example Avenue, Example City',
      scheduled_for: '2026-09-12T22:00:00.000Z',
      scheduled_until: '2026-09-13T01:00:00.000Z',
    },
  },
};
const positiveDiscoveryAvailability = /\b(?:public\s+)?(?:api(?:\s+endpoints?)?|oauth(?:\s+registration)?|credentials?|servers?|base\s+urls?|mcp(?:\s+endpoints?)?)\b[^.!?\n]{0,80}\b(?:(?:is|are|remains?|becomes?|now|currently)\s+)?(?:live|callable|available|enabled|active|ready|deployed|exists?)\b/i;
const negativeDiscoveryAvailability = /\b(?:no|not|neither|without|none|unavailable|non-callable|does\s+not\s+exist|not\s+applicable)\b/i;

function isSafeCatalogSourcePath(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 512 &&
    !value.includes('\\') &&
    !value.includes('://') &&
    /^(?:[A-Za-z0-9][A-Za-z0-9._-]*\/)*[A-Za-z0-9][A-Za-z0-9._-]*\.(?:ts|tsx)$/.test(value)
  );
}

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

function pathEquals(actual, expected) {
  return actual.length === expected.length && actual.every((segment, index) => segment === expected[index]);
}

function isReviewedSnapshotHttpValue(pathSegments, value, reviewedHttpValues) {
  return reviewedHttpValues.some(
    (reviewed) => reviewed.value === value && pathEquals(pathSegments, reviewed.path),
  );
}

function findUnsafeSnapshotValue(
  value,
  location = '$',
  parentKey = '',
  pathSegments = [],
  reviewedHttpValues = [],
) {
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
    if (/https?:\/\/[^\s"'<>]+/i.test(value) && !isReviewedSnapshotHttpValue(pathSegments, value, reviewedHttpValues)) {
      return `${location} contains an unreviewed HTTP URL`;
    }
    return null;
  }

  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const found = findUnsafeSnapshotValue(
        item,
        `${location}[${index}]`,
        parentKey,
        [...pathSegments, index],
        reviewedHttpValues,
      );
      if (found) return found;
    }
    return null;
  }

  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (key === 'x-mains-world-callable' && child === true) {
        return `${location}.${key} makes the snapshot callable`;
      }
      const found = findUnsafeSnapshotValue(
        child,
        `${location}.${key}`,
        key,
        [...pathSegments, key],
        reviewedHttpValues,
      );
      if (found) return found;
    }
  }
  return null;
}

function findDisallowedOpenApiInstanceData(value, location = '$') {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const found = findDisallowedOpenApiInstanceData(item, `${location}[${index}]`);
      if (found) return found;
    }
    return null;
  }
  if (!value || typeof value !== 'object') return null;

  for (const [key, child] of Object.entries(value)) {
    if (key === 'example' || key === 'examples' || key === 'default') return `${location}.${key}`;
    const found = findDisallowedOpenApiInstanceData(child, `${location}.${key}`);
    if (found) return found;
  }
  return null;
}

export function validateDiscoveryDocuments(documents) {
  if (!documents || typeof documents !== 'object' || Array.isArray(documents)) {
    throw new TypeError('Discovery documents must be an object keyed by path.');
  }
  for (const [documentPath, content] of Object.entries(documents)) {
    if (typeof content !== 'string') {
      throw new TypeError(`Discovery document ${documentPath} must contain text.`);
    }
    const contradictoryClaim = content
      .split(/(?<=[.!?;])(?:\s+|$)|\n+/)
      .find((statement) =>
        positiveDiscoveryAvailability.test(statement) &&
        !negativeDiscoveryAvailability.test(statement),
      );
    if (contradictoryClaim) {
      throw new Error(`Discovery document ${documentPath} contains a contradictory availability claim.`);
    }
  }
  return documents;
}

function contractOperations(contract) {
  return Object.entries(contract.paths ?? []).flatMap(([operationPath, methods]) =>
    Object.entries(methods)
      .filter(([method, operation]) => standardHttpMethods.has(method.toLowerCase()) && operation && typeof operation === 'object')
      .map(([method, operation]) => ({ method: method.toUpperCase(), path: operationPath, operation })),
  );
}

function hasExactDocumentationServer(servers) {
  return JSON.stringify(servers) === JSON.stringify([documentationServer]);
}

function findDisallowedServerPath(value, pathSegments = []) {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const found = findDisallowedServerPath(item, [...pathSegments, index]);
      if (found) return found;
    }
    return null;
  }

  if (!value || typeof value !== 'object') return null;

  for (const [key, child] of Object.entries(value)) {
    const childPath = [...pathSegments, key];
    if (key === 'servers' && !pathEquals(childPath, ['servers'])) return childPath;
    const found = findDisallowedServerPath(child, childPath);
    if (found) return found;
  }
  return null;
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
    const unsafeValue = findUnsafeSnapshotValue(
      snapshot,
      '$',
      '',
      [],
      reviewedSnapshotHttpValues[name] ?? [],
    );
    if (unsafeValue) throw new Error(`Snapshot ${name} is unsafe: ${unsafeValue}.`);
    snapshots[name] = snapshot;
  }

  for (const [name, reviewedSnapshot] of Object.entries(reviewedSyntheticSnapshots)) {
    if (!isDeepStrictEqual(snapshots[name], reviewedSnapshot)) {
      throw new Error(`Snapshot ${name} must match the reviewed synthetic fixture.`);
    }
  }

  const openapi = snapshots.openapi;
  if (
    !hasExactDocumentationServer(openapi.servers) ||
    openapi['x-mains-world-status'] !== 'non-deployed-starter'
  ) {
    throw new Error('OpenAPI snapshot must use exactly the reserved non-routable documentation server.');
  }
  if (findDisallowedServerPath(openapi)) {
    throw new Error('OpenAPI snapshot must not override the reserved documentation server.');
  }
  if (
    Object.hasOwn(openapi, 'webhooks') ||
    Object.hasOwn(openapi, 'security') ||
    Object.hasOwn(openapi.components ?? {}, 'pathItems') ||
    Object.hasOwn(openapi.components ?? {}, 'callbacks')
  ) {
    throw new Error('OpenAPI snapshot must not contain webhooks or component Path Items.');
  }
  const inlineInstanceData = findDisallowedOpenApiInstanceData(openapi);
  if (inlineInstanceData) {
    throw new Error(`OpenAPI snapshot must not contain inline instance data at ${inlineInstanceData}.`);
  }
  const parsedOperations = contractOperations(openapi);
  const expectedPaths = [...new Set(requiredOperations.map(([, operationPath]) => operationPath))].sort();
  const actualPaths = Object.keys(openapi.paths ?? {}).sort();
  if (
    JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths) ||
    JSON.stringify(parsedOperations.map(({ method, path: operationPath }) => [method, operationPath])) !==
    JSON.stringify(requiredOperations) ||
    parsedOperations.some(({ operation }) => operation['x-mains-world-callable'] !== false) ||
    parsedOperations.some(({ operation }) => Object.hasOwn(operation, 'callbacks')) ||
    parsedOperations.some(({ operation }, index) => {
      const requiredSecurity = requiredOperationSecurity[index];
      return requiredSecurity === undefined
        ? Object.hasOwn(operation, 'security')
        : !isDeepStrictEqual(operation.security, requiredSecurity);
    })
  ) {
    throw new Error('OpenAPI snapshot does not match non-callable platform operations.');
  }
  if (
    Object.keys(openapi.components?.securitySchemes ?? {}).length !== 1 ||
    !Object.hasOwn(openapi.components?.securitySchemes ?? {}, 'PartnerOAuth')
  ) {
    throw new Error('OpenAPI snapshot must define exactly the reviewed PartnerOAuth security scheme.');
  }
  const contractScopes = Object.keys(
    openapi.components?.securitySchemes?.PartnerOAuth?.flows?.clientCredentials?.scopes ?? {},
  );
  if (JSON.stringify(contractScopes.sort()) !== JSON.stringify([...requiredScopes].sort())) {
    throw new Error('OpenAPI snapshot scopes do not match platform metadata.');
  }
  if (openapi.components?.securitySchemes?.PartnerOAuth?.flows?.clientCredentials?.tokenUrl !== documentationTokenUrl) {
    throw new Error('OpenAPI snapshot OAuth token URL must use the reserved non-routable documentation server.');
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

export async function validateCatalog(catalog) {
  assertExactKeys(catalog, catalogKeys, 'Catalog');
  if (
    catalog.schema_version !== 'v1' ||
    typeof catalog.catalog_version !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(catalog.catalog_version)
  ) {
    throw new Error('Catalog has invalid schema metadata.');
  }

  assertExactKeys(catalog.space_source, catalogSourceKeys, 'Catalog space source');
  const { repository, revision, paths } = catalog.space_source;
  if (repository !== 'https://github.com/pixel-potion/Mains.World') {
    throw new Error('Catalog source repository is not the reviewed Main’s World source.');
  }
  if (typeof revision !== 'string' || !/^[a-f0-9]{40}$/.test(revision)) {
    throw new Error('Catalog source revision must be a 40-character lowercase Git revision.');
  }
  if (
    !Array.isArray(paths) ||
    paths.length === 0 ||
    paths.some((sourcePath) => !isSafeCatalogSourcePath(sourcePath)) ||
    new Set(paths).size !== paths.length
  ) {
    throw new Error('Catalog source paths must be unique safe relative TypeScript paths.');
  }

  return structuredClone(catalog);
}

export async function loadCatalog(root = repositoryRoot) {
  const catalog = JSON.parse(await readFile(path.join(root, 'registry', 'catalog.json'), 'utf8'));
  return validateCatalog(catalog);
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

function parseNameStatusDiff(output) {
  const fields = output.toString('utf8').split('\0');
  fields.pop();
  const changes = [];

  for (let index = 0; index < fields.length;) {
    const status = fields[index++];
    if (!status) throw new Error('Git diff returned an empty name-status record.');

    if (/^[RC]\d*$/.test(status)) {
      const from = fields[index++];
      const to = fields[index++];
      if (from === undefined || to === undefined) {
        throw new Error(`Git diff returned an incomplete ${status} record.`);
      }
      changes.push({ status: status[0], score: status.slice(1), from, to });
      continue;
    }

    if (!/^[ACDMRTXUB]$/.test(status)) {
      throw new Error(`Git diff returned an unsupported name-status code: ${status}.`);
    }
    const file = fields[index++];
    if (file === undefined) throw new Error(`Git diff returned an incomplete ${status} record.`);
    changes.push({ status, from: file, to: file });
  }
  return changes;
}

function changeSurface(change) {
  const paths = [change.from, change.to];
  if (paths.some((file) => file === 'registry/catalog.json')) return 'catalog';
  if (paths.some((file) => file === 'registry/platform.json')) return 'platform';
  if (paths.some((file) => file.startsWith('static/api/connectives/v1/'))) return 'snapshot';
  if (paths.some((file) => file.startsWith('registry/apps/'))) return 'app';
  throw new Error(`Git diff returned a path outside the registry policy: ${paths.join(', ')}.`);
}

function addedAppId(change) {
  if (change.status !== 'A' || changeSurface(change) !== 'app') return null;
  if (!/^registry\/apps\/[a-z0-9]+(?:-[a-z0-9]+)*\.json$/.test(change.to)) {
    throw new Error(`Added app manifest has an invalid path: ${change.to}.`);
  }
  return path.basename(change.to, '.json');
}

async function resolveBaseCommit(base, root) {
  if (typeof base !== 'string' || base.length === 0) {
    throw new Error('A base commit is required for registry diff validation.');
  }
  try {
    const { stdout } = await execFile('git', ['rev-parse', '--verify', `${base}^{commit}`], { cwd: root });
    return stdout.trim();
  } catch {
    throw new Error(`Invalid or missing base commit: ${base}.`);
  }
}

/**
 * Validate a pull-request registry change against a committed base revision.
 * This function intentionally validates the complete current release before
 * applying the narrower submission policy, so maintenance mode never bypasses
 * schema, evidence, snapshot, parity, or public-safety checks.
 */
export async function checkBaseDiff(base, { root = repositoryRoot, allowMaintenance = false } = {}) {
  const baseCommit = await resolveBaseCommit(base, root);
  const [apps, platform] = await Promise.all([loadRegistry(root), loadPlatform(root)]);
  await loadCatalog(root);
  await validatePlatform(platform, root);

  let output;
  try {
    ({ stdout: output } = await execFile(
      'git',
      [
        'diff', '--name-status', '-z', '--find-renames', '--find-copies-harder',
        `${baseCommit}...HEAD`, '--', 'registry/apps', 'registry/catalog.json', 'registry/platform.json', 'static/api/connectives/v1',
      ],
      { cwd: root },
    ));
  } catch (error) {
    throw new Error(`Unable to read registry diff from base ${base}: ${error.message}`);
  }
  const changes = parseNameStatusDiff(output);
  if (allowMaintenance) return changes;

  const appsById = new Map(apps.map((app) => [app.id, app]));
  for (const change of changes) {
    const surface = changeSurface(change);
    if (surface === 'catalog' || surface === 'platform' || surface === 'snapshot') {
      throw new Error(`Changes to ${surface} files require catalog maintenance permission.`);
    }

    const appId = addedAppId(change);
    if (!appId) {
      throw new Error(`Changes to an existing app manifest require catalog maintenance permission (${change.status}).`);
    }
    const app = appsById.get(appId);
    if (!app) throw new Error(`Added app manifest is missing from the final registry: ${change.to}.`);
    if (app.listing_status !== 'proposed' || app.api_availability !== 'none') {
      throw new Error(`New app manifest ${change.to} must be proposed with API availability none.`);
    }
  }
  return changes;
}

function parseCliArguments(args) {
  const [mode, ...flags] = args;
  if (!['generate', 'check'].includes(mode)) {
    throw new Error('Usage: node scripts/app-registry.mjs <generate|check> [--root <path>] [--base <commit>] [--allow-maintenance]');
  }
  const options = { mode, root: null, base: null, allowMaintenance: false };
  for (let index = 0; index < flags.length; index += 1) {
    const flag = flags[index];
    if (flag === '--root') {
      if (!flags[index + 1] || flags[index + 1].startsWith('--')) throw new Error('--root requires a path.');
      if (options.root) throw new Error('The root may be supplied only once.');
      options.root = path.resolve(flags[++index]);
    } else if (flag === '--base') {
      if (!flags[index + 1] || flags[index + 1].startsWith('--')) throw new Error('--base requires a commit.');
      if (options.base) throw new Error('The base may be supplied only once.');
      options.base = flags[++index];
    } else if (flag === '--allow-maintenance' && mode === 'check') {
      if (options.allowMaintenance) throw new Error('The allow-maintenance option may be supplied only once.');
      options.allowMaintenance = true;
    } else {
      throw new Error('Usage: node scripts/app-registry.mjs <generate|check> [--root <path>] [--base <commit>] [--allow-maintenance]');
    }
  }
  if (mode === 'generate' && options.root) {
    throw new Error('Generate does not accept --root.');
  }
  if (mode === 'generate' && (options.base || options.allowMaintenance)) {
    throw new Error('Generate does not accept registry diff options.');
  }
  if (options.allowMaintenance && !options.base) {
    throw new Error('--allow-maintenance requires --base <commit>.');
  }
  return options;
}

async function runCli() {
  const { mode, root: requestedRoot, base, allowMaintenance } = parseCliArguments(process.argv.slice(2));
  const root = requestedRoot ?? repositoryRoot;
  const rendered = await renderAll(root);
  const discoveryDocuments = mode === 'generate'
    ? {
      'static/llms.txt': await readFile(path.join(root, 'static', 'llms.txt'), 'utf8'),
      'static/llms-full.txt': rendered[generatedOutputs.llmsFull],
    }
    : Object.fromEntries(await Promise.all(
      ['static/llms.txt', 'static/llms-full.txt'].map(async (relativePath) => [
        relativePath,
        await readFile(path.join(root, relativePath), 'utf8'),
      ]),
    ));
  validateDiscoveryDocuments(discoveryDocuments);
  if (mode === 'generate') {
    await Promise.all(Object.entries(rendered).map(async ([relativePath, content]) => {
      const outputPath = path.join(root, relativePath);
      await mkdir(path.dirname(outputPath), { recursive: true });
      await writeFile(outputPath, content);
    }));
    return;
  }
  const stale = [];
  for (const [relativePath, content] of Object.entries(rendered)) {
    try {
      if ((await readFile(path.join(root, relativePath), 'utf8')) !== content) stale.push(relativePath);
    } catch {
      stale.push(relativePath);
    }
  }
  if (stale.length) throw new Error(`Generated catalog outputs are stale: ${stale.join(', ')}`);
  if (base) await checkBaseDiff(base, { root, allowMaintenance });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
