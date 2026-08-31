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
const coreDiscoveryArtifacts = () => [
  'build/robots.txt',
  'build/sitemap.xml',
  'build/llms.txt',
  'build/llms-full.txt',
  'build/apps.json',
  ...['developers', 'developers/apps', 'developers/api', 'developers/submit-an-app'].map((route) => `build/${route}/index.html`),
  ...walk('build/api/connectives/v1').filter((path) => path.endsWith('.json')),
];
const discoveryArtifacts = () => [...new Set([
  ...coreDiscoveryArtifacts(),
  ...renderedSitemapPages(),
])];
const publicBuildPaths = () => walk(buildDir).map((path) => `/${relative(buildDir, path)}`);
const validateDiscoveryReferences = (documents) => registryPolicy.validateDiscoveryReferences(
  documents,
  { publicPaths: publicBuildPaths() },
);
const validateDiscoveryDocuments = (documents) => registryPolicy.validateDiscoveryDocuments(
  documents,
  { publicPaths: publicBuildPaths() },
);

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
    assert.doesNotThrow(() => validateDiscoveryDocuments({ [path]: content }));
  }
  assert.doesNotThrow(() => validateDiscoveryDocuments(semanticDiscoveryDocuments()));
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
        () => validateDiscoveryDocuments({ [path]: `${current}\n${claim}\n` }),
        /contradictory|availability claim/i,
        `${path} must reject: ${claim}`,
      );
    }
  }
  assert.doesNotThrow(() => validateDiscoveryDocuments({
    'llms.txt': read('build/llms.txt'),
  }));
});

test('rejects availability claims that share a sentence with denial language', () => {
  for (const path of ['build/llms.txt', 'build/llms-full.txt']) {
    assert.throws(
      () => validateDiscoveryDocuments({
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
  'The public API can now be called.',
  'The MCP endpoint can safely be called.',
  'Requests are accepted by the API.',
  'Requests are currently accepted by the MCP endpoint.',
  'The API is accepting requests.',
  'API calls are supported.',
  'Requests are processed by the API.',
  'The public API can very safely and reliably now be called.',
  'The OAuth endpoint is operational.',
  'Use an API or MCP endpoint.',
  'Call the API.',
  'The server accepts requests.',
  'The MCP endpoint supports requests.',
  'No public API is callable today but is live.',
  'No public API is callable today. It is live.',
  'Requests can be made now.',
  'The endpoint is live.',
  'The endpoint is reachable.',
  'Credentials are obtainable.',
  'The server responds.',
  'The base URL resolves.',
]) {
  test(`rejects semantic discovery bypass: ${claim}`, () => {
    for (const [path, content] of Object.entries(semanticDiscoveryDocuments())) {
      assert.throws(
        () => validateDiscoveryDocuments({ [path]: `${content}\n${claim}\n` }),
        /contradictory|availability claim/i,
        `${path} must reject: ${claim}`,
      );
    }
  });
}

test('keeps approved exact denials and neutral discovery text valid', () => {
  assert.doesNotThrow(() => validateDiscoveryDocuments({
    'discovery.txt': [
      'No public API is callable today.',
      'The API is not live.',
      'The OAuth endpoint cannot be called.',
      'The server does not accept requests.',
      'The MCP endpoint does not support requests.',
      'Neither the API nor the MCP endpoint is available.',
      'No credentials are required.',
      'The credentials are not required.',
      'Requests are not accepted by the API.',
      'No requests are accepted by the MCP endpoint.',
      'API: None',
      'API: Not Applicable',
    ].join('\n'),
  }));
});

test('rejects availability prose transplanted into a structured llms-full catalog row', () => {
  const current = read('build/llms-full.txt');
  const mutated = current.replace('- RunPal (runpal):', '- API is live (runpal):');
  assert.notEqual(mutated, current, 'catalog-row mutation must apply');
  assert.throws(
    () => validateDiscoveryDocuments({ 'build/llms-full.txt': mutated }),
    /unreviewed|availability claim|semantic change/i,
  );
});

for (const [name, path, mutate] of [
  ['source HTML comment', 'docs/developers/api.md', (content) => `${content}\n<!-- The public API is live. -->\n`],
  ['source HTML metadata', 'docs/developers/api.md', (content) => `${content}\n<meta name="description" content="The public API is live.">\n`],
  [
    'rendered metadata',
    'build/developers/api/index.html',
    (content) => content.replace('</head>', '<meta name="description" content="The public API is live."></head>'),
  ],
  [
    'rendered JSON-LD',
    'build/developers/api/index.html',
    (content) => content.replace('</head>', '<script type="application/ld+json">{"description":"The public API is live."}</script></head>'),
  ],
]) {
  test(`protects semantic discovery documents against ${name}`, () => {
    const current = read(path);
    const content = mutate(current);
    assert.notEqual(content, current, 'semantic mutation must apply');
    assert.throws(
      () => validateDiscoveryDocuments({ [path]: content }),
      /unreviewed|availability claim|semantic change/i,
      `${path} must reject hidden availability metadata`,
    );
  });
}

test('rejects a protocol-relative product API reference in rendered discovery text', () => {
  assert.throws(
    () => validateDiscoveryDocuments({
      'build/developers/api/index.html': '<a href="//mains.world/api/token">Token endpoint</a>',
    }),
    /network-path|protocol-relative|URI|URL/i,
  );
});

test('rejects a single-label protocol-relative host in rendered discovery text', () => {
  assert.throws(
    () => validateDiscoveryDocuments({
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
      () => validateDiscoveryDocuments({
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

test('scans every rendered sitemap page and every machine discovery artifact', () => {
  const pages = renderedSitemapPages();
  const artifacts = discoveryArtifacts();
  assert.ok(pages.length > 4, 'the sitemap must exercise more than the original four developer pages');
  assert.deepEqual(
    pages.filter((path) => artifacts.includes(path)).sort(),
    pages.slice().sort(),
    'every rendered sitemap page must be covered by the discovery artifact gate',
  );
  for (const path of [
    'build/robots.txt',
    'build/sitemap.xml',
    'build/llms.txt',
    'build/llms-full.txt',
    'build/apps.json',
    ...walk('build/api/connectives/v1').filter((path) => path.endsWith('.json')),
  ]) {
    assert.ok(artifacts.includes(path), `machine discovery artifact is not covered: ${path}`);
  }
});

test('rejects private machine targets while preserving reviewed public and human links', () => {
  assert.equal(
    typeof registryPolicy.validateDiscoveryReferences,
    'function',
    'the registry policy must expose its complete discovery-reference validator',
  );
  assert.doesNotThrow(() => validateDiscoveryReferences({
    'approved.md': [
      '[Open Main\'s World](https://mains.world)',
      '[Open SPACE](https://mains.world/space)',
      '[Safety](https://mains.world/how-it-works/safety-alerts)',
      '[Developer guide](https://mainsworld.org/developers/api)',
      '[OpenAPI](/api/connectives/v1/openapi.json)',
      '[Discord example](/api/connectives/v1/discord-connected-group-membership.json)',
      '[Luma example](https://mainsworld.org/api/connectives/v1/luma-vibe-candidate.json)',
    ].join('\n'),
  }));
  assert.doesNotThrow(() => validateDiscoveryReferences(allDiscoveryArtifactDocuments()));

  for (const target of [
    'https://api.mains.world/oauth/token',
    'https://mains.world/oauth/token',
    'https://mains.world/connectives/v1/link-sessions',
    'https://edge.mains.world/mcp/session',
    'https://mainsworld.org/api/unreviewed.json',
    '/connectives/v1/link-sessions',
  ]) {
    assert.throws(
      () => validateDiscoveryReferences({
        'unsafe.md': `[Machine target](${target})`,
      }),
      /private|machine|endpoint|target|reference|URL/i,
      `must reject private machine target: ${target}`,
    );
  }
});

test('applies a default-private product and root-relative route allowlist', () => {
  for (const target of [
    'https://mains.world/moments/private-id',
    'https://mains.world/profile/alice',
    'https://mains.world/vault',
    'https://mains.world/map?lat=41.88&lng=-87.63',
    'https://mains.world/?private=1',
    'https://mains.world/space#today',
    'https://mains.world/how-it-works/safety-alerts/',
    'https://mains.world.:443/space',
    'https://user@mains.world/space',
    'wss://mains.world/connectives/v1',
    'https://private.mains.world/',
    '/moments/private-id',
    '/profile/alice',
    '/vault',
    '/map?lat=41.88&lng=-87.63',
    '/not-a-public-build-route',
  ]) {
    assert.throws(
      () => validateDiscoveryReferences({ 'unsafe.md': `[Target](${target})` }),
      /private|product|route|target|reference|URL/i,
      `must reject unreviewed product or root-relative target: ${target}`,
    );
  }

  assert.doesNotThrow(() => validateDiscoveryReferences({
    'approved.md': [
      '[Product](https://mains.world)',
      '[SPACE](https://mains.world/space)',
      '[Safety](https://mains.world/how-it-works/safety-alerts)',
      '[Contribute](/contribute#what-belongs-here)',
      `[Built asset](${publicBuildPaths().find((path) => path.startsWith('/assets/'))})`,
      '[Snapshot](/api/connectives/v1/openapi.json)',
    ].join('\n'),
  }));
});

test('parses every browser URL candidate before applying the default-private allowlist', () => {
  for (const content of [
    '<a href="https:api.mains.world/oauth/token">Token</a>',
    String.raw`<a href="https:\\api.mains.world/oauth/token">Token</a>`,
    String.raw`<a href="\vault">Vault</a>`,
    '<img srcset="/ 1x, /vault 2x">',
    '<a href="https://mainsworld.org/vault">Vault</a>',
    '<video poster="/vault"></video>',
    '<meta http-equiv="refresh" content="0;url=/vault">',
    '<style>.card { background-image: url(/vault); }</style>',
    '[Vault][private]\n\n[private]: /vault',
    '{"images":["/","/vault"]}',
  ]) {
    assert.throws(
      () => validateDiscoveryReferences({ 'unsafe.html': content }),
      /private|product|route|target|reference|URL/i,
      `must reject hidden browser URL candidate: ${content}`,
    );
  }
});

for (const content of [
  '[SPACE](https://mains.world/space.)',
  '[Contribute](/contribute.)',
  '<style>.card { background-image: url(https://mains.world/space.); }</style>',
]) {
  test(`retains punctuation on structured URL target: ${content}`, () => {
    assert.throws(
      () => validateDiscoveryReferences({ 'unsafe.html': content }),
      /private|product|route|target|reference|URL/i,
      `must reject punctuated structured target: ${content}`,
    );
  });
}

for (const [name, content] of [
  ['CSS imports', '<style>@import "/vault";</style>'],
  ['ping lists', '<a href="/" ping="/ /vault">Home</a>'],
  ['image source sets', '<link rel="preload" imagesrcset="/ 1x, /vault 2x">'],
  [
    'iteratively entity-encoded embedded markup',
    '<iframe srcdoc="&amp;lt;a &amp;#104;&amp;#114;&amp;#101;&amp;#102;=&amp;quot;/vault&amp;quot;&amp;gt;Vault&amp;lt;/a&amp;gt;"></iframe>',
  ],
  ['CSS escape syntax', String.raw`<style>.card { background: url(\contribute); }</style>`],
]) {
  test(`parses ${name} before applying the default-private allowlist`, () => {
    assert.throws(
      () => validateDiscoveryReferences({ 'unsafe.html': content }),
      /private|product|route|target|reference|URL/i,
      `must reject URL-bearing syntax: ${content}`,
    );
  });
}

for (const target of [
  'https://public:secret@www.iana.org/',
  'https://public@www.iana.org/',
]) {
  test(`rejects userinfo on absolute discovery URL: ${target}`, () => {
    assert.throws(
      () => validateDiscoveryReferences({ 'unsafe.md': `[External](${target})` }),
      /private|credential|userinfo|target|reference|URL/i,
    );
  });
}

test('rejects IP literals and reserved local DNS origins in discovery references', () => {
  for (const target of [
    'https://10.0.0.1/rest/v1/moments',
    'https://169.254.169.254/latest/meta-data',
    'https://192.0.2.1/documentation',
    'https://[::1]/private',
    'https://[fc00::1]/private',
    'https://[fe80::1]/private',
    'https://[2001:db8::1]/documentation',
    'https://service.local/private',
    'https://service.lan/private',
    'https://localhost.localdomain/private',
  ]) {
    assert.throws(
      () => validateDiscoveryReferences({ 'unsafe.md': `[Private origin](${target})` }),
      /private|origin|target|reference|URL/i,
      `must reject non-public discovery origin: ${target}`,
    );
  }
});

test('keeps the localhost preview exception exact and document scoped', () => {
  assert.doesNotThrow(() => validateDiscoveryReferences({
    'docs/contribute.md': read('docs/contribute.md'),
    'build/contribute/index.html': read('build/contribute/index.html'),
  }));
  assert.throws(
    () => validateDiscoveryReferences({
      'docs/other.md': 'Preview at `http://localhost:3000`.',
    }),
    /private|origin|target|reference|URL/i,
  );
});

test('rejects a private endpoint injected into an arbitrary non-developer sitemap page', () => {
  assert.equal(typeof registryPolicy.validateDiscoveryReferences, 'function');
  const page = renderedSitemapPages().find((path) => !path.includes('/developers/'));
  assert.ok(page, 'expected a non-developer sitemap page');
  const artifacts = allDiscoveryArtifactDocuments();
  assert.throws(
    () => validateDiscoveryReferences({
      ...artifacts,
      [page]: `${artifacts[page]}\n<a href="https://api.mains.world/oauth/token">Private API</a>\n`,
    }),
    /private|machine|endpoint|target|reference|URL/i,
  );
});

test('rejects a private origin injected into an arbitrary non-developer sitemap page', () => {
  const page = renderedSitemapPages().find((path) => !path.includes('/developers/'));
  assert.ok(page, 'expected a non-developer sitemap page');
  const artifacts = allDiscoveryArtifactDocuments();
  assert.throws(
    () => validateDiscoveryReferences({
      ...artifacts,
      [page]: `${artifacts[page]}\n<a href="https://project.supabase.co/rest/v1/moments">Private data</a>\n`,
    }),
    /private|origin|target|reference|URL/i,
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
    const reviewedContent = path === 'build/contribute/index.html'
      ? content.replaceAll('http://localhost:3000', '')
      : content;
    assert.doesNotMatch(reviewedContent, privateOrigin, `private backend origin leaked in ${path}`);
  }
  for (const path of discoveryArtifacts()) {
    const content = read(path);
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

for (const html of [
  'A<b>P</b>I is live.',
  'A<span>PI</span> is live.',
  '<table><tr><td>POST /oauth/token</td><td>Live</td></tr></table>',
]) {
  test(`rejects semantic availability split across rendered inline or table markup: ${html}`, () => {
    assert.throws(
      () => validateDiscoveryDocuments({ 'discovery.html': html }),
      /contradictory|availability claim/i,
    );
  });
}
