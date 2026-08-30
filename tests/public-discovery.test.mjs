import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync, readdirSync, readFileSync} from 'node:fs';
import {join, relative} from 'node:path';
import {test} from 'node:test';

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
  for (const path of ['build/llms.txt', 'build/llms-full.txt']) {
    const content = read(path);
    assert.match(content, /no public.*API.*(?:callable|to call)|no .*public API access/i, `${path} must deny public API calls`);
    assert.match(content, /(?:no |or )MCP endpoint/i, `${path} must deny public MCP endpoints`);
  }
});

test('excludes internal plans and private discovery origins from the built site', () => {
  assert.equal(execFileSync('git', ['ls-files', '--', 'docs/superpowers'], {encoding: 'utf8'}), '');

  const paths = walk(buildDir);
  for (const path of paths) {
    assert.doesNotMatch(relative(buildDir, path), /superpowers\//i, `internal path shipped: ${path}`);
  }

  const discoveryArtifacts = [
    'build/robots.txt',
    'build/sitemap.xml',
    'build/llms.txt',
    'build/llms-full.txt',
    'build/developers/api/index.html',
    'build/api/connectives/v1/openapi.json',
  ];
  const privateOrigin = /https?:\/\/[^\s"'<]*(?:supabase(?:\.co)?|workers\.dev|localhost|127\.0\.0\.1|0\.0\.0\.0|(?:internal|private|staging|dev)\.)[^\s"'<]*/i;
  const privateProductApi = /https:\/\/mains\.world\/(?:api|mcp)(?:[/?#]|$)/i;
  for (const path of discoveryArtifacts) {
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
