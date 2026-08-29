import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {test} from 'node:test';

const html = (route) => readFileSync(`build/${route}/index.html`, 'utf8');
const text = (value) => value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const platform = JSON.parse(readFileSync('registry/platform.json', 'utf8'));

test('publishes the developer routes and catalog as built pages', () => {
  for (const route of ['developers', 'developers/apps', 'developers/api', 'developers/submit-an-app']) {
    assert.ok(existsSync(`build/${route}/index.html`), `missing /${route}/`);
  }

  const apps = html('developers/apps');
  assert.equal((apps.match(/<tr[\s>]/g) ?? []).length - 1, 18, 'all catalog rows render');
  for (const label of ['Connected', 'First party', 'Coming soon', 'Proposed', 'Wishlist']) {
    assert.match(text(apps), new RegExp(label, 'i'));
  }
});

test('renders the preview boundary from platform metadata without runtime access', () => {
  const apiHtml = html('developers/api');
  const api = text(apiHtml);
  assert.match(api, /no public .*endpoint.*callable/i);
  assert.match(api, /no server.*URL/i);
  assert.match(api, /There is no sandbox\./i);
  assert.match(api, /no self-service key/i);
  assert.match(api, /no public OAuth registration/i);
  assert.match(api, /no public write API/i);
  assert.match(api, /no .*MCP endpoint/i);

  for (const scope of platform.scopes) assert.match(api, new RegExp(scope.replace(':', '\\:')));
  for (const operation of platform.operations) {
    assert.match(api, new RegExp(`${operation.method} ${operation.path.replace(/[{}]/g, '\\$&')}`));
    assert.match(api, new RegExp(`${operation.method} ${operation.path.replace(/[{}]/g, '\\$&')}[^]*?Not callable`));
  }
  for (const artifact of Object.values(platform.artifacts)) {
    assert.match(apiHtml, new RegExp(`href=(?:")?${artifact.public_snapshot_path.replace(/[./]/g, '\\$&')}(?:")?`));
    assert.ok(existsSync(`build${artifact.public_snapshot_path}`), `missing ${artifact.public_snapshot_path}`);
  }
  assert.match(api, new RegExp(platform.source_revision));
  assert.match(api, /access-restricted normative provenance/i);
});

test('ships a resolvable, public-only AI index and developer navigation', () => {
  for (const asset of ['apps.json', 'llms.txt', 'llms-full.txt']) assert.ok(existsSync(`build/${asset}`), `missing /${asset}`);

  const llms = readFileSync('build/llms.txt', 'utf8');
  assert.match(llms, /^No public Main's World API endpoint is callable today\./m);
  for (const [, path] of llms.matchAll(/^- [^\n]*: (\/[^\s]+)$/gm)) {
    assert.ok(existsSync(`build${path.replace(/\/$/, '/index.html')}`), `unresolved llms link ${path}`);
  }

  const publicSurfaces = [llms, readFileSync('build/llms-full.txt', 'utf8'), html('developers/api'), html('developers/submit-an-app')].join('\n');
  assert.doesNotMatch(publicSurfaces, /github\.com\/pixel-potion\/Mains\.World\/(?:raw|blob)\//i);
  assert.doesNotMatch(publicSurfaces, /https?:\/\/[^\s"']*(?:internal|private)[^\s"']*/i);
  assert.match(text(html('developers')), /Developers/);
  assert.match(text(html('developers')), /Apps/);
});
