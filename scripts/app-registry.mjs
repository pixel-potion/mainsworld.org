import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readdir, readFile } from 'node:fs/promises';
import { isIP } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(moduleDirectory, '..');
const schemaPath = path.join(repositoryRoot, 'registry', 'schema', 'app-v1.schema.json');
const STATUS_RANK = {
  connected: 0,
  first_party: 1,
  coming_soon: 2,
  proposed: 3,
  wishlist: 4,
};
const prohibitedKeyPattern =
  /secret|token|credential|clientid|callback|identity(?:id|identifier)?|(?:main)?user(?:id|identifier)?|main(?:id|identifier|account|address|uuid)|wallet|grant|internal(?:endpoint|url|host|service)/i;
const publicUrlFields = [
  'website',
  'support_url',
  'privacy_url',
  'api_contract_url',
  'status_evidence_url',
];

let validateApp;

function normalizeKey(key) {
  return key.replace(/[^a-z0-9]/gi, '').toLowerCase();
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
      if (prohibitedKeyPattern.test(normalizeKey(key))) {
        return `${location}.${key}`;
      }
      const found = findProhibitedKey(child, `${location}.${key}`);
      if (found) return found;
    }
  }

  return null;
}

function isNonPublicIpv4(hostname) {
  const octets = hostname.split('.').map(Number);
  const [first, second, third] = octets;

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 0) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    (first === 198 && second === 51 && third === 100) ||
    (first === 203 && second === 0 && third === 113) ||
    first >= 224
  );
}

function parseIpv6(hostname) {
  const expandIpv4Tail = (parts) => {
    if (!parts.at(-1)?.includes('.')) return parts;
    const octets = parts.pop().split('.').map(Number);
    if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet))) {
      return null;
    }
    parts.push(((octets[0] << 8) | octets[1]).toString(16));
    parts.push(((octets[2] << 8) | octets[3]).toString(16));
    return parts;
  };
  const [before, after, extra] = hostname.split('::');
  if (extra !== undefined) return null;
  const left = expandIpv4Tail(before ? before.split(':') : []);
  const right = expandIpv4Tail(after ? after.split(':') : []);
  if (!left || !right) return null;

  const missing = 8 - left.length - right.length;
  const hextets = after === undefined ? left : [...left, ...Array(missing).fill('0'), ...right];
  if (missing < 0 || hextets.length !== 8) return null;

  let address = 0n;
  for (const hextet of hextets) {
    if (!/^[0-9a-f]{1,4}$/i.test(hextet)) return null;
    address = (address << 16n) | BigInt(`0x${hextet}`);
  }
  return address;
}

function isInIpv6Range(address, base, prefixLength) {
  const mask = ((1n << 128n) - 1n) << BigInt(128 - prefixLength);
  return (address & mask) === (parseIpv6(base) & mask);
}

function isNonPublicIpv6(hostname) {
  const address = parseIpv6(hostname);
  if (address === null) return true;
  if (address === 0n || address === 1n) return true;
  if (isInIpv6Range(address, '::ffff:0:0', 96)) {
    const ipv4 = Number(address & 0xffffffffn);
    return isNonPublicIpv4(
      `${ipv4 >>> 24}.${(ipv4 >>> 16) & 255}.${(ipv4 >>> 8) & 255}.${ipv4 & 255}`,
    );
  }

  return (
    isInIpv6Range(address, 'fc00::', 7) ||
    isInIpv6Range(address, 'fe80::', 10) ||
    isInIpv6Range(address, '100::', 64) ||
    isInIpv6Range(address, '2001:2::', 48) ||
    isInIpv6Range(address, '2001:db8::', 32) ||
    isInIpv6Range(address, 'ff00::', 8)
  );
}

function isPublicHttpsUrl(value) {
  try {
    const url = new URL(value);
    const hostname = url.hostname
      .toLowerCase()
      .replace(/^\[|\]$/g, '')
      .replace(/\.+$/, '');

    if (url.protocol !== 'https:' || url.username || url.password || !hostname) {
      return false;
    }

    if (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname === 'local' ||
      hostname.endsWith('.local') ||
      hostname === 'test' ||
      hostname.endsWith('.test') ||
      hostname === 'invalid' ||
      hostname.endsWith('.invalid') ||
      hostname === 'example' ||
      hostname.endsWith('.example') ||
      ['example.com', 'example.net', 'example.org'].some(
        (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
      )
    ) {
      return false;
    }

    if (isIP(hostname) === 4) return !isNonPublicIpv4(hostname);
    if (isIP(hostname) === 6) return !isNonPublicIpv6(hostname);

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

export function renderAppsJson() {
  throw new Error('App catalog rendering is introduced in Task 2.');
}

export function renderAppsMarkdown() {
  throw new Error('App catalog rendering is introduced in Task 2.');
}

export function renderLlmsFull() {
  throw new Error('App catalog rendering is introduced in Task 2.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.error('App catalog generation is introduced in Task 2.');
  process.exitCode = 1;
}
