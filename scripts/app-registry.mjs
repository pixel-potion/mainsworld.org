import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readdir, readFile } from 'node:fs/promises';
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
  /secret|token|credential|clientid|callback|main(?:id|identifier|account|address)|wallet|grant|internal(?:endpoint|url|host|service)/i;

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
