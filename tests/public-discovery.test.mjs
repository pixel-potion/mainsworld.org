import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readdirSync, readFileSync} from 'node:fs';
import {join, relative} from 'node:path';
import {test} from 'node:test';

import * as registryPolicy from '../scripts/app-registry.mjs';

const buildDir = 'build';
const publicOrigin = 'https://mainsworld.org';
const read = (path) => readFileSync(path, 'utf8');
const walk = (directory) => readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
  const path = join(directory, entry.name);
  return entry.isDirectory() ? walk(path) : [path];
});
const sitemapLocations = () => [...read('build/sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
const renderedSitemapPages = () => sitemapLocations().map((location) => {
  const pathname = new URL(location).pathname;
  return pathname === '/' ? join(buildDir, 'index.html') : join(buildDir, pathname.replace(/^\//, ''), 'index.html');
});
const canonical = (html) => html.match(/<link\s+[^>]*rel=(?:["'])?canonical(?:["'])?[^>]*href=(?:["'])?([^\s"'>]+)/i)?.[1]
  ?? html.match(/<link\s+[^>]*href=(?:["'])?([^\s"'>]+)[^>]*rel=(?:["'])?canonical(?:["'])?[^>]*>/i)?.[1];
const mcpNonCallable = /(?:no\s+[^.]*MCP endpoint|MCP endpoint(?:\s+is)?\s+(?:not callable|does not exist|is unavailable))/i;
const privateProductApi = /(?:https?:)?\/\/mains\.world\/(?:api|mcp)(?:[/?#]|$)/i;
const semanticDiscoveryDocuments = () => ({
  'docs/developers/api.md': read('docs/developers/api.md'),
  'build/developers/api/index.html': read('build/developers/api/index.html'),
  'build/llms.txt': read('build/llms.txt'),
  'build/llms-full.txt': read('build/llms-full.txt'),
});
const allDiscoveryArtifactDocuments = () => Object.fromEntries(
  discoveryArtifacts().map((path) => [path, read(path)]),
);
const discoveryArtifacts = () => [
  'build/robots.txt',
  'build/sitemap.xml',
  'build/llms.txt',
  'build/llms-full.txt',
  'build/apps.json',
  ...['developers', 'developers/apps', 'developers/api', 'developers/submit-an-app'].map((route) => `build/${route}/index.html`),
  ...walk('build/api/connectives/v1').filter((path) => path.endsWith('.json')),
];

test('ships crawlable robots and a public-only sitemap', () => {
  assert.equal(read('static/robots.txt'), 'User-agent: *\nAllow: /\nSitemap: https://mainsworld.org/sitemap.xml\n');
  assert.equal(read('build/robots.txt'), read('static/robots.txt'));

  const sitemap = read('build/sitemap.xml');
  const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert.ok(locations.length > 0, 'sitemap must contain at least one URL');
  for (const location of locations) {
    const url = new URL(location);
    assert.equal(url.protocol, 'https:', `sitemap URL must use HTTPS: ${location}`);
    assert.equal(url.origin, publicOrigin, `sitemap URL must use mainsworld.org: ${location}`);
  }
});

test('renders mainsworld.org canonicals for every public page', () => {
  const pages = renderedSitemapPages();
  assert.ok(pages.length > 0, 'build must contain rendered pages');
  for (const path of pages) {
    const value = canonical(read(path));
    assert.ok(value, `missing canonical in ${relative(buildDir, path)}`);
    assert.equal(new URL(value).origin, publicOrigin, `wrong canonical in ${relative(buildDir, path)}`);
  }
});

test('keeps AI discovery documents explicitly non-callable', () => {
  assert.equal(
    typeof registryPolicy.validateDiscoveryDocuments,
    'function',
    'the registry policy must expose its discovery-claim validator',
  );
  for (const path of ['build/llms.txt', 'build/llms-full.txt']) {
    const content = read(path);
    assert.match(content, /no public.*API.*(?:callable|to call)|no .*public API access/i, `${path} must deny public API calls`);
    assert.match(content, mcpNonCallable, `${path} must deny public MCP endpoints`);
    assert.doesNotThrow(() => registryPolicy.validateDiscoveryDocuments({ [path]: content }));
  }
  assert.doesNotThrow(() => registryPolicy.validateDiscoveryDocuments(semanticDiscoveryDocuments()));
  assert.doesNotMatch('Use an API or MCP endpoint.', mcpNonCallable, 'a positive MCP phrase must not satisfy the denial check');
});

test('rejects contradictory API and MCP availability claims in both AI discovery documents', () => {
  assert.equal(
    typeof registryPolicy.validateDiscoveryDocuments,
    'function',
    'the registry policy must expose its discovery-claim validator',
  );
  for (const path of ['build/llms.txt', 'build/llms-full.txt']) {
    const current = read(path);
    for (const claim of ['A public MCP endpoint is available.', 'The API is live.']) {
      assert.throws(
        () => registryPolicy.validateDiscoveryDocuments({ [path]: `${current}\n${claim}\n` }),
        /contradictory|availability claim/i,
        `${path} must reject: ${claim}`,
      );
    }
  }
  assert.doesNotThrow(() => registryPolicy.validateDiscoveryDocuments({
    'llms.txt': [
      read('build/llms.txt'),
      'API: None',
      'API: Not Applicable',
      'Use an API or MCP endpoint.',
      'Human guide: https://mainsworld.org/developers/',
    ].join('\n'),
  }));
});

test('rejects availability claims that share a sentence with denial language', () => {
  for (const path of ['build/llms.txt', 'build/llms-full.txt']) {
    assert.throws(
      () => registryPolicy.validateDiscoveryDocuments({
        [path]: 'No public API is callable; a public MCP endpoint is available.',
      }),
      /contradictory|availability claim/i,
      `${path} must reject a positive availability clause despite a preceding denial`,
    );
  }
});

for (const claim of [
  'No public API is callable and a public MCP endpoint is available.',
  'No public API is callable, but its OAuth endpoint can be called.',
  'No public API is callable while the MCP endpoint supports requests.',
  'No public API is callable, the MCP endpoint is available.',
  'No public API is callable or the MCP endpoint is available.',
  'No credentials are required because the API is live.',
  'No credentials are needed because the API is live.',
  'No API documentation is planned because the MCP endpoint is live.',
  'No OAuth endpoint documentation will be published even though the server accepts requests.',
  'No server documentation is scheduled for release while the base URL is active.',
  'The server accepts requests.',
  'The MCP endpoint supports requests.',
]) {
  test(`rejects semantic discovery bypass: ${claim}`, () => {
    for (const [path, content] of Object.entries(semanticDiscoveryDocuments())) {
      assert.throws(
        () => registryPolicy.validateDiscoveryDocuments({ [path]: `${content}\n${claim}\n` }),
        /contradictory|availability claim/i,
        `${path} must reject: ${claim}`,
      );
    }
  });
}

test('keeps approved exact denials and neutral discovery text valid', () => {
  assert.doesNotThrow(() => registryPolicy.validateDiscoveryDocuments({
    'discovery.txt': [
      'No public API is callable today.',
      'The API is not live.',
      'The OAuth endpoint cannot be called.',
      'The server does not accept requests.',
      'The MCP endpoint does not support requests.',
      'Neither the API nor the MCP endpoint is available.',
      'No credentials are required.',
      'The credentials are not required.',
      'API: None',
      'API: Not Applicable',
      'Use an API or MCP endpoint.',
    ].join('\n'),
  }));
});

test('rejects a protocol-relative product API reference in rendered discovery text', () => {
  assert.throws(
    () => registryPolicy.validateDiscoveryDocuments({
      'build/developers/api/index.html': '<a href="//mains.world/api/token">Token endpoint</a>',
    }),
    /network-path|protocol-relative|URI|URL/i,
  );
});

test('rejects a single-label protocol-relative host in rendered discovery text', () => {
  assert.throws(
    () => registryPolicy.validateDiscoveryDocuments({
      'build/developers/api/index.html': '<a href="//localhost/api/token">Token endpoint</a>',
    }),
    /network-path|protocol-relative|URI|URL/i,
  );
});

for (const reference of [
  '//user@example.com/api',
  '//%65xample.com/api',
  '//@example.com/api',
  '//example.com:/api',
  '///path',
]) {
  test(`rejects protocol-relative authority form in discovery text: ${reference}`, () => {
    assert.throws(
      () => registryPolicy.validateDiscoveryDocuments({
        'build/developers/api/index.html': `<a href="${reference}">Endpoint</a>`,
      }),
      /network-path|protocol-relative|URI|URL/i,
    );
  });
}

test('rejects a generic network-path URI across the complete generated discovery artifact set', () => {
  assert.equal(
    typeof registryPolicy.validateNetworkPathReferences,
    'function',
    'the registry policy must expose its generic network-path validator',
  );
  const artifacts = allDiscoveryArtifactDocuments();
  assert.doesNotThrow(() => registryPolicy.validateNetworkPathReferences(artifacts));
  assert.throws(
    () => registryPolicy.validateNetworkPathReferences({
      ...artifacts,
      'build/apps.json': `${artifacts['build/apps.json']}\n//evil.example/endpoint\n`,
    }),
    /network-path|protocol-relative|URI|URL/i,
  );
});

test('the public artifact guard recognizes protocol-relative product API references', () => {
  assert.match('//mains.world/api/token', privateProductApi);
});

test('excludes internal plans and private discovery origins from the built site', () => {
  assert.equal(execFileSync('git', ['ls-files', '--', 'docs/superpowers'], {encoding: 'utf8'}), '');

  const paths = walk(buildDir);
  for (const path of paths) {
    assert.doesNotMatch(relative(buildDir, path), /superpowers\//i, `internal path shipped: ${path}`);
  }

  const privateOrigin = /https?:\/\/[^\s"'<]*(?:supabase(?:\.co)?|workers\.dev|localhost|127\.0\.0\.1|0\.0\.0\.0|(?:internal|private|staging|dev)\.)[^\s"'<]*/i;
  for (const path of discoveryArtifacts()) {
    const content = read(path);
    assert.doesNotMatch(content, privateOrigin, `private backend origin leaked in ${path}`);
    assert.doesNotMatch(content, privateProductApi, `private product API or MCP URL leaked in ${path}`);
  }
});

test('retains the exact non-routable OpenAPI preview boundary', () => {
  const openapi = JSON.parse(read('build/api/connectives/v1/openapi.json'));
  assert.deepEqual(openapi.servers, [{
    url: 'https://example.invalid',
    description: 'Non-callable documentation preview. No network endpoint exists.',
  }]);
  assert.equal(openapi.components.securitySchemes.PartnerOAuth.flows.clientCredentials.tokenUrl, 'https://example.invalid/oauth/token');
  assert.equal(openapi['x-mains-world-status'], 'non-deployed-starter');
  for (const operations of Object.values(openapi.paths)) {
    for (const operation of Object.values(operations)) {
      assert.equal(operation['x-mains-world-callable'], false);
    }
  }
});
