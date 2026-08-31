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
  'localdomain',
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
const reviewedPartnerOAuth = {
  type: 'oauth2',
  flows: {
    clientCredentials: {
      tokenUrl: documentationTokenUrl,
      scopes: {
        'candidate-status:read': 'Read candidate status within an approved grant.',
        'link-sessions:create': 'Create and poll application consent sessions.',
        'vibe-candidates:write': 'Submit Vibe candidates within an approved grant.',
      },
    },
  },
};
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
const reviewedSnapshotUriValues = {
  openapi: [
    { path: ['servers', 0, 'url'], value: 'https://example.invalid' },
    {
      path: ['components', 'securitySchemes', 'PartnerOAuth', 'flows', 'clientCredentials', 'tokenUrl'],
      value: 'https://example.invalid/oauth/token',
    },
    {
      path: ['paths', '/oauth/token', 'post', 'requestBody', 'content', 'application/x-www-form-urlencoded', 'schema', 'properties', 'client_assertion_type', 'const'],
      value: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    },
    { path: ['paths', '/connectives/v1/link-sessions', 'post', 'security', 0, 'PartnerOAuth', 0], value: 'link-sessions:create' },
    { path: ['paths', '/connectives/v1/link-sessions/{session_id}', 'get', 'security', 0, 'PartnerOAuth', 0], value: 'link-sessions:create' },
    { path: ['paths', '/connectives/v1/grants/{grant_id}/vibe-candidates', 'post', 'security', 0, 'PartnerOAuth', 0], value: 'vibe-candidates:write' },
    { path: ['paths', '/connectives/v1/grants/{grant_id}/candidates/{candidate_id}', 'get', 'security', 0, 'PartnerOAuth', 0], value: 'candidate-status:read' },
    { path: ['components', 'schemas', 'PartnerTokenClaims', 'oneOf', 0, 'properties', 'iss', 'const'], value: 'urn:mains-world:connectives:sandbox' },
    { path: ['components', 'schemas', 'PartnerTokenClaims', 'oneOf', 1, 'properties', 'iss', 'const'], value: 'urn:mains-world:connectives:production' },
    { path: ['components', 'schemas', 'PartnerTokenClaims', 'properties', 'iss', 'enum', 0], value: 'urn:mains-world:connectives:sandbox' },
    { path: ['components', 'schemas', 'PartnerTokenClaims', 'properties', 'iss', 'enum', 1], value: 'urn:mains-world:connectives:production' },
    { path: ['components', 'schemas', 'PartnerTokenClaims', 'properties', 'aud', 'const'], value: 'urn:mains-world:connectives:v1' },
    {
      path: ['components', 'schemas', 'PartnerTokenClaims', 'properties', 'scope', 'pattern'],
      value: '^(?:candidate-status:read|link-sessions:create|vibe-candidates:write)(?:[\\t-\\r ]+(?:candidate-status:read|link-sessions:create|vibe-candidates:write))*$',
    },
    {
      path: ['components', 'schemas', 'ConnectedGroupMembership', 'properties', 'display', 'properties', 'icon_url', 'pattern'],
      value: '^https://',
    },
    {
      path: ['components', 'schemas', 'ExternalCrewHostRef', 'properties', 'icon_url_snapshot', 'pattern'],
      value: '^https://',
    },
    { path: ['components', 'schemas', 'LinkSessionCreateRequest', 'properties', 'requested_scopes', 'items', 'enum', 0], value: 'candidate-status:read' },
    { path: ['components', 'schemas', 'LinkSessionCreateRequest', 'properties', 'requested_scopes', 'items', 'enum', 1], value: 'vibe-candidates:write' },
  ],
  discord_example: [
    { path: ['display', 'icon_url'], value: 'https://cdn.example.test/icon.png' },
  ],
  luma_example: [],
};
const reviewedSnapshotUnsafeKeys = {
  openapi: [
    {
      path: ['components', 'securitySchemes', 'PartnerOAuth', 'flows', 'clientCredentials', 'scopes', 'candidate-status:read'],
      value: 'candidate-status:read',
    },
    {
      path: ['components', 'securitySchemes', 'PartnerOAuth', 'flows', 'clientCredentials', 'scopes', 'link-sessions:create'],
      value: 'link-sessions:create',
    },
    {
      path: ['components', 'securitySchemes', 'PartnerOAuth', 'flows', 'clientCredentials', 'scopes', 'vibe-candidates:write'],
      value: 'vibe-candidates:write',
    },
    {
      path: ['components', 'schemas', 'TokenResponse', 'properties', 'access_token'],
      value: 'access_token',
    },
  ],
  discord_example: [],
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
const discoverySubjectSignal = /\b(?:api(?:\s+(?:calls?|endpoints?))?|oauth(?:\s+(?:registration|endpoints?))?|credentials?|endpoints?|requests?|servers?|base\s+urls?|mcp(?:\s+endpoints?)?)\b/i;
const discoveryAvailabilitySignal = /\b(?:access|accept(?:s|ed|ing)?|activ(?:e|ated|ation)|availab(?:le|ility)|call(?:s|ed|able|ing)?|deploy(?:ed|ment)?|enabled?|exists?|live|made|none|not\s+applicable|obtainable|online|operational|process(?:ed|es|ing)?|reachable|ready|required|requests?|registration|resolv(?:e|es|ed|ing)|respond(?:s|ed|ing)?|runtime|support(?:s|ed|ing)?|traffic|use|usable|using|working)\b/i;
const approvedGenericDiscoveryStatements = new Set([
  'no public api is callable today',
  'the api is not live',
  'the oauth endpoint cannot be called',
  'the server does not accept requests',
  'the mcp endpoint does not support requests',
  'neither the api nor the mcp endpoint is available',
  'no credentials are required',
  'the credentials are not required',
  'requests are not accepted by the api',
  'no requests are accepted by the mcp endpoint',
  'api none',
  'api not applicable',
]);
const networkPathReference = /(^|[^A-Za-z0-9+.\-:/])\/\/(?:(?:[A-Za-z0-9._~!$&'()*+,;=:]|%[0-9A-Fa-f]{2})*@)?(?:\[[^\]\s]+\]|(?:[A-Za-z0-9._~!$&'()*+,;=-]|%[0-9A-Fa-f]{2})*)(?::\d*)?(?:\/[^\s"'<>?#]*)*(?:\?[^\s"'<>#]*)?(?:#[^\s"'<>]*)?(?=$|[\s"'<>])/im;
const absoluteUriToken = /[A-Za-z][A-Za-z0-9+.-]*:(?=\S)/i;
const absoluteAuthorityReference = /\b[A-Za-z][A-Za-z0-9+.-]*:\/\/[^\s"'<>`)}\]]+/ig;
const specialNetworkScheme = /^(?:https?|wss?|ftp):/i;
const anyUriScheme = /^[A-Za-z][A-Za-z0-9+.-]*:/;
const urlBearingHtmlAttribute = /\b(href|src|srcset|imagesrcset|action|poster|formaction|data|cite|manifest|ping|background|longdesc|xlink:href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/ig;
const htmlContentAttribute = /\bcontent\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/ig;
const markdownInlineTarget = /!?\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s)]+))/ig;
const markdownReferenceTarget = /^[ \t]*\[[^\]]+\]:[ \t]*(?:<([^>]+)>|([^\s]+))/igm;
const cssUrlTarget = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)'"<>]+))/ig;
const cssImportTarget = /@import\s+(?:"([^"]*)"|'([^']*)')/ig;
const htmlStyleElement = /<style\b[^>]*>([\s\S]*?)<\/style>/ig;
const htmlStyleAttribute = /\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/ig;
const htmlMetaElement = /<meta\b[^>]*>/ig;
const htmlAttribute = /([A-Za-z_:][A-Za-z0-9:._-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
const reviewedUrlMetaIdentifiers = new Set([
  'og:url', 'og:image', 'og:image:url', 'og:image:secure_url',
  'twitter:url', 'twitter:image', 'twitter:image:src', 'msapplication-tileimage',
  'url', 'image', 'thumbnailurl', 'contenturl',
]);
const reviewedRuntimeScript = /<script src=\/assets\/js\/runtime~main\.[a-f0-9]{8}\.js defer><\/script>/g;
const publicAppNamePattern = /^[\p{L}\p{N}]+(?:[ .'+’\-][\p{L}\p{N}]+)*$/u;
const reviewedSemanticDocumentFingerprints = new Map([
  ['api-source', '2effce187b4da6780f2c7f88ddbf5953d61b1ddbec94ceb753f855f06c1d40ad'],
  ['api-rendered', '6d3a91672bac6bac87ec37673ee769cb6a6551df87c78f531174d725bd9d3410'],
  ['llms', 'e43269607b667b81416d023ee2d4fd7f1c9fa1eebc3fe38c10a5386bffb166b5'],
  ['llms-full', 'adc4283a21a2cf26d2e529717f457a9c203ab2bbf8d428314260ed8a38e67a78'],
]);
const reviewedPublicMachinePaths = new Set([
  '/api/connectives/v1/openapi.json',
  '/api/connectives/v1/discord-connected-group-membership.json',
  '/api/connectives/v1/luma-vibe-candidate.json',
]);
const reviewedProductReferences = new Set([
  'https://mains.world',
  'https://mains.world/space',
  'https://mains.world/how-it-works/safety-alerts',
]);
const reviewedNonHttpDiscoveryReferences = new Set([
  'mailto:hello@mains.world',
]);
const reviewedReservedDiscoveryReferences = new Map([
  ['docs/developers/api.md', new Set([
    'https://example.invalid',
  ])],
  ['build/developers/api/index.html', new Set([
    'https://example.invalid',
  ])],
  ['build/api/connectives/v1/openapi.json', new Set([
    'https://example.invalid',
    'https://example.invalid/oauth/token',
  ])],
  ['build/api/connectives/v1/discord-connected-group-membership.json', new Set([
    'https://cdn.example.test/icon.png',
  ])],
]);
const reviewedPublicSitePaths = new Set([
  '/', '/connect-your-app', '/contribute', '/country-availability', '/developers',
  '/developers/api', '/developers/apps', '/developers/submit-an-app', '/faq', '/glossary',
  '/how-it-works/crews', '/how-it-works/getting-started', '/how-it-works/moments',
  '/how-it-works/safety-alerts', '/how-it-works/signing-in', '/how-it-works/the-worlds',
  '/how-it-works/vibes', '/manifesto', '/privacy', '/roadmap', '/terms', '/the-economy',
  '/what-is-ship', '/whitepaper', '/your-main-on-chain', '/apps.json', '/llms.txt',
  '/llms-full.txt', '/robots.txt', '/sitemap.xml',
]);

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

function normalizedHostname(hostname) {
  return hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
}

function isNonPublicHostname(hostname) {
  const normalized = normalizedHostname(hostname);
  return (
    !normalized ||
    Boolean(isIP(normalized)) ||
    !normalized.includes('.') ||
    !isValidDnsHostname(normalized) ||
    reservedDnsSuffixes.some(
      (suffix) => normalized === suffix || normalized.endsWith(`.${suffix}`),
    )
  );
}

function isCanonicalRawNetworkUrl(value, schemes) {
  if (typeof value !== 'string' || value.includes('\\')) return false;
  const authority = value.match(new RegExp(`^(?:${schemes}):\\/\\/([^/?#]+)(?:[/?#]|$)`, 'i'))?.[1];
  return Boolean(authority && !authority.includes('@'));
}

function isCanonicalRawHttpsUrl(value) {
  return isCanonicalRawNetworkUrl(value, 'https');
}

function isPublicHttpsUrl(value) {
  if (!isCanonicalRawHttpsUrl(value)) return false;
  try {
    const url = new URL(value);
    const hostname = normalizedHostname(url.hostname);

    if (url.protocol !== 'https:' || url.username || url.password || !hostname) {
      return false;
    }

    if (isNonPublicHostname(url.hostname)) return false;

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

    if (!publicAppNamePattern.test(record.name)) {
      throw new Error(`Public app name must use plain text: ${record.name}.`);
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

function isReviewedSnapshotUriValue(pathSegments, value, reviewedUriValues) {
  return reviewedUriValues.some(
    (reviewed) => reviewed.value === value && pathEquals(pathSegments, reviewed.path),
  );
}

function findUnsafeSnapshotKey(key, location, pathSegments, reviewedUnsafeKeys) {
  const keyPath = [...pathSegments, key];
  if (isReviewedSnapshotUriValue(keyPath, key, reviewedUnsafeKeys)) return null;
  if (snapshotCredentialPatterns.some((pattern) => pattern.test(key))) {
    return `${location}.${key} contains concrete credential material in an object key`;
  }
  const compactKey = compactSnapshotKey(key);
  if (
    snapshotConcreteCredentialKeys.has(compactKey) ||
    snapshotConcreteUrlKeys.has(compactKey) ||
    snapshotConcreteIdentifierKeys.has(compactKey)
  ) {
    return `${location}.${key} contains an unsafe object key`;
  }
  if (networkPathReference.test(key)) {
    return `${location}.${key} contains a protocol-relative network-path URI in an object key`;
  }
  if (containsAbsoluteUriToken(key)) {
    return `${location}.${key} contains an unreviewed absolute URI in an object key`;
  }
  return null;
}

function containsAbsoluteUriToken(value) {
  const withoutIsoTimestamps = value.replace(
    /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\b/g,
    '',
  );
  return absoluteUriToken.test(withoutIsoTimestamps);
}

function findUnsafeSnapshotValue(
  value,
  location = '$',
  parentKey = '',
  pathSegments = [],
  reviewedUriValues = [],
  reviewedUnsafeKeys = [],
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
    if (networkPathReference.test(value)) {
      return `${location} contains a protocol-relative network-path URI reference`;
    }
    if (containsAbsoluteUriToken(value) && !isReviewedSnapshotUriValue(pathSegments, value, reviewedUriValues)) {
      return `${location} contains an unreviewed absolute URI`;
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
        reviewedUriValues,
        reviewedUnsafeKeys,
      );
      if (found) return found;
    }
    return null;
  }

  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      const unsafeKey = findUnsafeSnapshotKey(key, location, pathSegments, reviewedUnsafeKeys);
      if (unsafeKey) return unsafeKey;
      if (key === 'x-mains-world-callable' && child === true) {
        return `${location}.${key} makes the snapshot callable`;
      }
      const found = findUnsafeSnapshotValue(
        child,
        `${location}.${key}`,
        key,
        [...pathSegments, key],
        reviewedUriValues,
        reviewedUnsafeKeys,
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

function findDisallowedOpenApiReference(value, location = '$') {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const found = findDisallowedOpenApiReference(item, `${location}[${index}]`);
      if (found) return found;
    }
    return null;
  }
  if (!value || typeof value !== 'object') return null;

  for (const [key, child] of Object.entries(value)) {
    if (key === '$ref' && (typeof child !== 'string' || !child.startsWith('#/'))) {
      return `${location}.${key}`;
    }
    const found = findDisallowedOpenApiReference(child, `${location}.${key}`);
    if (found) return found;
  }
  return null;
}

function normalizeDiscoveryStatement(statement) {
  return statement
    .normalize('NFKC')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, '')
    .replace(/&#(?:39|x27);|&apos;|[\u2018\u2019']/gi, '')
    .replace(/&[A-Za-z0-9#]+;/g, ' ')
    .replace(/[^A-Za-z0-9/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function hasUnapprovedDiscoveryAvailability(statement, approvedStatements) {
  const normalized = normalizeDiscoveryStatement(statement);
  if (approvedStatements.has(normalized)) return false;
  return discoverySubjectSignal.test(normalized) && discoveryAvailabilitySignal.test(normalized);
}

function semanticDocumentKind(documentPath) {
  if (/(?:^|\/)docs\/developers\/api\.md$/.test(documentPath)) return 'api-source';
  if (/(?:^|\/)build\/developers\/api\/index\.html$/.test(documentPath)) return 'api-rendered';
  if (/(?:^|\/)(?:(?:static|build)\/)?llms-full\.txt$/.test(documentPath)) return 'llms-full';
  if (/(?:^|\/)(?:(?:static|build)\/)?llms\.txt$/.test(documentPath)) return 'llms';
  return null;
}

function semanticVisibleText(content, { lineBreaksAsStatements = false } = {}) {
  let visible = decodedDiscoveryContent(content);
  visible = visible
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/?(?:article|aside|div|footer|h[1-6]|header|li|main|nav|ol|p|section|table|tbody|thead|tr|ul)\b[^>]*>/gi, '.')
    .replace(/<\/?(?:td|th)\b[^>]*>/gi, ' ')
    .replace(/<[^>]*>/g, '');
  if (lineBreaksAsStatements) visible = visible.replace(/\r?\n+/g, '.');
  return visible
    .replace(/\s+/g, ' ')
    .trim();
}

function semanticDocumentFingerprint(documentPath, content) {
  const kind = semanticDocumentKind(documentPath);
  if (!kind) return null;
  if (kind === 'api-rendered') {
    const runtimeScripts = [...content.matchAll(reviewedRuntimeScript)];
    if (runtimeScripts.length !== 1) return '';
    const reviewedContent = content.replace(
      reviewedRuntimeScript,
      '<script src=/assets/js/runtime~main.<digest>.js defer></script>',
    );
    return createHash('sha256').update(reviewedContent).digest('hex');
  }
  if (kind === 'llms-full') {
    const markers = [...content.matchAll(/^## SPACE catalog \((\d{4}-\d{2}-\d{2})\)$/gm)];
    if (markers.length !== 1) return '';
    const marker = markers[0];
    const rows = content.slice(marker.index + marker[0].length).trim().split(/\r?\n/).filter(Boolean);
    const rowPattern = /^- (.+) \([a-z0-9](?:[a-z0-9-]*[a-z0-9])?\): (?:Connected|First Party|Coming Soon|Proposed|Wishlist); API: (?:None|Not Applicable); SPACE: [a-z]+(?:, [a-z]+)*; https:\/\/\S+$/;
    if (
      rows.length === 0 ||
      rows.some((row) => {
        const match = row.match(rowPattern);
        return (
          !match ||
          !publicAppNamePattern.test(match[1]) ||
          hasUnapprovedDiscoveryAvailability(match[1], new Set())
        );
      })
    ) return '';
    const reviewedPrefix = `${content.slice(0, marker.index)}## SPACE catalog`;
    return createHash('sha256').update(reviewedPrefix).digest('hex');
  }
  return createHash('sha256').update(content).digest('hex');
}

function validateDiscoveryDocumentMap(documents) {
  if (!documents || typeof documents !== 'object' || Array.isArray(documents)) {
    throw new TypeError('Discovery documents must be an object keyed by path.');
  }
  for (const [documentPath, content] of Object.entries(documents)) {
    if (typeof content !== 'string') {
      throw new TypeError(`Discovery document ${documentPath} must contain text.`);
    }
  }
}

function normalizedDiscoveryPath(reference) {
  let pathname = new URL(reference, 'https://mainsworld.org').pathname.normalize('NFKC');
  for (let attempts = 0; attempts < 4; attempts += 1) {
    try {
      const decoded = decodeURIComponent(pathname);
      if (decoded === pathname) break;
      pathname = decoded;
    } catch {
      break;
    }
  }
  return pathname;
}

function canonicalPublicPath(pathname) {
  return pathname !== '/' ? pathname.replace(/\/+$/, '') : pathname;
}

function decodedDiscoveryContent(content) {
  const namedEntities = {
    colon: ':', sol: '/', quest: '?', num: '#', amp: '&',
    lt: '<', gt: '>', quot: '"', apos: "'", equals: '=',
  };
  let decoded = content.normalize('NFKC');
  for (let pass = 0; pass < 4; pass += 1) {
    const previous = decoded;
    const next = decoded.replace(
      /&(?:#x([0-9a-f]+);?|#(\d+);?|(colon|sol|quest|num|amp|lt|gt|quot|apos|equals);)/gi,
      (match, hex, decimal, name) => {
        if (name) return namedEntities[name.toLowerCase()];
        const codePoint = Number.parseInt(hex ?? decimal, hex ? 16 : 10);
        try {
          return String.fromCodePoint(codePoint);
        } catch {
          return match;
        }
      },
    );
    decoded = next.normalize('NFKC');
    if (decoded === previous) break;
  }
  return decoded.replace(
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g,
    '',
  );
}

function isPrivateDiscoveryHostname(hostname) {
  const normalized = normalizedHostname(hostname);
  const labels = normalized.split('.');
  return (
    isNonPublicHostname(hostname) ||
    normalized === 'supabase.co' ||
    normalized.endsWith('.supabase.co') ||
    normalized === 'workers.dev' ||
    normalized.endsWith('.workers.dev') ||
    labels.some((label) => ['internal', 'private', 'staging', 'dev'].includes(label))
  );
}

function isReviewedLocalPreview(documentPath, reference) {
  return (
    reference === 'http://localhost:3000' &&
    /(?:^|\/)(?:docs\/contribute\.md|build\/contribute\/index\.html)$/.test(documentPath)
  );
}

function normalizedPublicPaths(publicPaths) {
  if (!publicPaths || typeof publicPaths[Symbol.iterator] !== 'function') {
    throw new TypeError('Public discovery paths must be iterable.');
  }
  return new Set([...publicPaths].map((publicPath) => canonicalPublicPath(normalizedDiscoveryPath(publicPath))));
}

function isAllowedRootReference(reference, allowedBuildPaths) {
  let target;
  try {
    target = new URL(reference, 'https://mainsworld.org');
  } catch {
    return false;
  }
  if (target.search) return false;
  const pathname = canonicalPublicPath(normalizedDiscoveryPath(target.href));
  if (reviewedPublicMachinePaths.has(pathname)) return !target.hash;
  if (target.hash) {
    return new Set([
      '/contribute#what-belongs-here',
      '/the-economy#reading-the-community-numbers',
    ]).has(`${pathname}${target.hash}`);
  }
  if (reviewedPublicSitePaths.has(pathname)) return true;
  return (
    (pathname.startsWith('/assets/') || pathname.startsWith('/img/')) &&
    allowedBuildPaths.has(pathname)
  );
}

function firstCapturedValue(match, start = 1) {
  return match.slice(start).find((value) => value !== undefined);
}

function trimBareUrlPunctuation(reference) {
  return reference.trim().replace(/[`.,;!?]+$/g, '');
}

function parseSrcsetCandidates(value) {
  const candidates = [];
  let position = 0;
  while (position < value.length) {
    while (position < value.length && /[\s,]/.test(value[position])) position += 1;
    if (position >= value.length) break;

    const start = position;
    while (position < value.length && !/\s/.test(value[position])) position += 1;
    let candidate = value.slice(start, position);
    const trailingCommas = candidate.match(/,+$/)?.[0].length ?? 0;
    if (trailingCommas) candidate = candidate.slice(0, -trailingCommas);
    if (candidate) candidates.push(candidate);
    if (trailingCommas) continue;

    let parentheses = 0;
    while (position < value.length) {
      const character = value[position];
      if (character === '(') parentheses += 1;
      if (character === ')' && parentheses > 0) parentheses -= 1;
      position += 1;
      if (character === ',' && parentheses === 0) break;
    }
  }
  return candidates;
}

function collectJsonUrlCandidates(value, candidates) {
  if (Array.isArray(value)) {
    for (const item of value) collectJsonUrlCandidates(item, candidates);
    return;
  }
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) collectJsonUrlCandidates(child, candidates);
    return;
  }
  if (
    typeof value === 'string' &&
    /^(?:[/#]|(?:https?|wss?|ftp|javascript|data):)/i.test(value.trim())
  ) {
    candidates.push({ reference: value.trim(), bare: false });
  }
}

function parsedHtmlAttributes(tag) {
  const attributes = new Map();
  for (const match of tag.matchAll(htmlAttribute)) {
    attributes.set(match[1].toLowerCase(), firstCapturedValue(match, 2) ?? '');
  }
  return attributes;
}

function hasUnsupportedCssUrlSyntax(content) {
  const contexts = [];
  for (const match of content.matchAll(htmlStyleElement)) contexts.push(match[1]);
  for (const match of content.matchAll(htmlStyleAttribute)) {
    contexts.push(firstCapturedValue(match));
  }
  return contexts.some(
    (context) => context.includes('\\') || /(?:^|[^-])(?:-webkit-)?image-set\s*\(/i.test(context),
  );
}

function discoveryUrlCandidates(content) {
  const decodedContent = decodedDiscoveryContent(content);
  const candidates = [];

  for (const match of decodedContent.matchAll(urlBearingHtmlAttribute)) {
    const attribute = match[1].toLowerCase();
    const value = firstCapturedValue(match, 2) ?? '';
    const references = attribute === 'srcset' || attribute === 'imagesrcset'
      ? parseSrcsetCandidates(value)
      : attribute === 'ping'
        ? value.trim().split(/\s+/).filter(Boolean)
        : [value];
    for (const reference of references) candidates.push({ reference, bare: false });
  }
  for (const match of decodedContent.matchAll(htmlContentAttribute)) {
    const contentValue = firstCapturedValue(match);
    const refreshTarget = contentValue?.match(/(?:^|;)\s*url\s*=\s*(.+)$/i)?.[1];
    if (refreshTarget) candidates.push({ reference: refreshTarget.trim(), bare: false });
  }
  for (const match of decodedContent.matchAll(htmlMetaElement)) {
    const attributes = parsedHtmlAttributes(match[0]);
    const identifiers = ['property', 'name', 'itemprop']
      .map((attribute) => attributes.get(attribute)?.toLowerCase())
      .filter(Boolean);
    if (identifiers.some((identifier) => reviewedUrlMetaIdentifiers.has(identifier)) && attributes.has('content')) {
      candidates.push({ reference: attributes.get('content'), bare: false });
    }
  }
  for (const pattern of [markdownInlineTarget, markdownReferenceTarget, cssUrlTarget]) {
    for (const match of decodedContent.matchAll(pattern)) {
      candidates.push({
        reference: firstCapturedValue(match),
        bare: false,
        css: pattern === cssUrlTarget,
      });
    }
  }
  for (const match of decodedContent.matchAll(cssImportTarget)) {
    candidates.push({ reference: firstCapturedValue(match), bare: false, css: true });
  }

  const trimmedContent = decodedContent.trim();
  if (trimmedContent.startsWith('{') || trimmedContent.startsWith('[')) {
    try {
      collectJsonUrlCandidates(JSON.parse(trimmedContent), candidates);
    } catch {
      // Non-JSON documents are handled by their native URL grammars.
    }
  }

  for (const match of decodedContent.matchAll(absoluteAuthorityReference)) {
    candidates.push({ reference: match[0], bare: true });
  }
  return candidates;
}

function isReviewedReservedDiscoveryReference(documentPath, reference) {
  for (const [reviewedPath, references] of reviewedReservedDiscoveryReferences) {
    if (
      (documentPath === reviewedPath || documentPath.endsWith(`/${reviewedPath}`)) &&
      references.has(reference)
    ) return true;
  }
  return false;
}

function findDisallowedUrlCandidate(candidate, documentPath, allowedBuildPaths) {
  const rawReference = candidate.bare
    ? trimBareUrlPunctuation(candidate.reference)
    : candidate.reference.trim();
  if (!rawReference || rawReference.startsWith('#')) return null;
  if (reviewedNonHttpDiscoveryReferences.has(rawReference)) return null;
  if (isReviewedLocalPreview(documentPath, rawReference)) return null;
  if (candidate.css && rawReference.includes('\\')) return rawReference;
  if (rawReference.includes('\\')) return rawReference;
  if (rawReference.startsWith('//')) return rawReference;
  if (specialNetworkScheme.test(rawReference) && !isCanonicalRawNetworkUrl(rawReference, 'https?|wss?|ftp')) {
    return rawReference;
  }
  if (!anyUriScheme.test(rawReference)) {
    if (rawReference.startsWith('/')) {
      return isAllowedRootReference(rawReference, allowedBuildPaths) ? null : rawReference;
    }
    return rawReference;
  }
  if (!isCanonicalRawNetworkUrl(rawReference, 'https?')) return rawReference;

  let target;
  try {
    target = new URL(rawReference);
  } catch {
    return rawReference;
  }
  if (target.username || target.password) return rawReference;
  const hostname = normalizedHostname(target.hostname);
  const pathname = normalizedDiscoveryPath(target.href);
  if (isReviewedReservedDiscoveryReference(documentPath, rawReference)) return null;
  if (isPrivateDiscoveryHostname(target.hostname)) {
    return isReviewedLocalPreview(documentPath, rawReference) ? null : rawReference;
  }
  if (hostname === 'mains.world') {
    return reviewedProductReferences.has(rawReference) ? null : rawReference;
  }
  if (hostname.endsWith('.mains.world') || hostname.endsWith('.mainsworld.org')) return rawReference;
  if (hostname === 'mainsworld.org') {
    if (
      target.protocol !== 'https:' || target.username || target.password || target.port ||
      !isAllowedRootReference(`${pathname}${target.search}${target.hash}`, allowedBuildPaths)
    ) return rawReference;
  }
  return null;
}

function findDisallowedDiscoveryReference(content, documentPath, allowedBuildPaths) {
  const decodedContent = decodedDiscoveryContent(content);
  if (hasUnsupportedCssUrlSyntax(decodedContent)) return 'unsupported CSS URL syntax';
  for (const candidate of discoveryUrlCandidates(content)) {
    const disallowed = findDisallowedUrlCandidate(candidate, documentPath, allowedBuildPaths);
    if (disallowed) return disallowed;
  }
  return null;
}

export function validateNetworkPathReferences(documents) {
  validateDiscoveryDocumentMap(documents);
  for (const [documentPath, content] of Object.entries(documents)) {
    if (networkPathReference.test(decodedDiscoveryContent(content))) {
      throw new Error(`Discovery document ${documentPath} contains a protocol-relative network-path URI reference.`);
    }
  }
  return documents;
}

export function validateDiscoveryReferences(documents, { publicPaths = [] } = {}) {
  validateNetworkPathReferences(documents);
  const allowedBuildPaths = normalizedPublicPaths(publicPaths);
  for (const [documentPath, content] of Object.entries(documents)) {
    const disallowedReference = findDisallowedDiscoveryReference(content, documentPath, allowedBuildPaths);
    if (disallowedReference) {
      throw new Error(`Discovery document ${documentPath} contains an unreviewed private target or route: ${disallowedReference}`);
    }
  }
  return documents;
}

export function validateDiscoveryDocuments(documents, options) {
  validateDiscoveryReferences(documents, options);
  for (const [documentPath, content] of Object.entries(documents)) {
    const documentKind = semanticDocumentKind(documentPath);
    if (documentKind) {
      const expectedFingerprint = reviewedSemanticDocumentFingerprints.get(documentKind);
      if (semanticDocumentFingerprint(documentPath, content) !== expectedFingerprint) {
        throw new Error(`Discovery document ${documentPath} contains an unreviewed availability claim or semantic change.`);
      }
      continue;
    }
    const contradictoryClaim = semanticVisibleText(content, { lineBreaksAsStatements: true })
      .split(/[.!?;]+/)
      .find((statement) => hasUnapprovedDiscoveryAvailability(statement, approvedGenericDiscoveryStatements));
    if (contradictoryClaim) {
      throw new Error(`Discovery document ${documentPath} contains a contradictory availability claim: ${normalizeDiscoveryStatement(contradictoryClaim)}.`);
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
      reviewedSnapshotUriValues[name] ?? [],
      reviewedSnapshotUnsafeKeys[name] ?? [],
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
    throw new Error('OpenAPI snapshot must not contain root security, webhooks, component callbacks, or component Path Items.');
  }
  const externalReference = findDisallowedOpenApiReference(openapi);
  if (externalReference) {
    throw new Error(`OpenAPI snapshot references must remain local at ${externalReference}.`);
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
    !isDeepStrictEqual(openapi.components?.securitySchemes?.PartnerOAuth, reviewedPartnerOAuth)
  ) {
    throw new Error('OpenAPI snapshot must define exactly the complete reviewed PartnerOAuth security scheme.');
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
  discoveryDocuments['docs/developers/api.md'] = await readFile(
    path.join(root, 'docs', 'developers', 'api.md'),
    'utf8',
  );
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
