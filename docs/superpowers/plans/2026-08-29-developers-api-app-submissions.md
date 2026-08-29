# Developers, API, and SPACE App Submissions Implementation Plan

<!-- prettier-ignore -->
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a truthful Developers section on `mainsworld.org`, backed by
a schema-validated public SPACE app catalog and a reviewable GitHub pull-request
submission flow that humans and coding agents can follow.

**Architecture:** The docs repository owns only public listing facts. One JSON
manifest per app feeds deterministic Markdown, JSON, and `llms-full.txt`
outputs. A Node/Ajv validator and CI diff policy keep new submissions
`proposed` with no API access. Human pages and `llms.txt` explain that no public
endpoint is callable. The revised MW OpenAPI commit is pinned as the normative
preview contract; runtime registration, credentials, grants, and activation
remain in MW.

**Tech Stack:** Docusaurus 3.10, Node.js 22, native `node:test`, JavaScript ESM,
JSON Schema 2020-12, Ajv 8, npm, Markdown.

**Spec:**
`docs/superpowers/specs/2026-08-29-developers-api-app-submissions-design.md`

## Global constraints

- Work only in `/private/tmp/mainsworld-developers-api` on
  `codex/developers-api-app-catalog`, created from current `origin/main`. Do not
  touch the dirty primary docsite checkout.
- Follow red-green-refactor for scripts and rendered behavior. Human prose does
  not get brittle exact-string tests; test manifest validation, generated
  artifacts, link resolution, routes, tables, and availability semantics at
  their consumer boundaries.
- Keep public catalog and runtime authority separate. Merging an app manifest
  lists it; it never creates credentials, callbacks, grants, provider access,
  or production activation.
- State that there are no callable public endpoints today. Every Connectives
  operation is a preview marked **Not callable** with no server URL, sandbox,
  self-service keys, or MCP endpoint.
- Pin the exact public MW commit produced by the companion plan. Do not link to
  a mutable branch or a revision that still contains the native Crew-candidate
  path/scope.
- Store public facts only. Reject secrets, tokens, credentials, client IDs,
  private callbacks, Main identifiers, wallets, grant material, and internal
  endpoint fields.
- Seed all 18 apps represented in the current SPACE catalog, with the approved
  honest statuses. Do not imply that coming-soon or wishlist apps are connected.
- Make no deployment, provider call, OAuth change, database write, external
  submission, or production mutation while implementing or testing.
- Use Node 22 from the repository `.node-version`; if the current shell is
  older, prefix commands with:
  `env PATH=/Users/philiployd/.nvm/versions/node/v22.20.0/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin`.

## Catalog seed map

Pin SPACE provenance to MW commit
`4babf633b209855c49e1bf698d04b2a03488de8c` and these audited paths:

- `src/app/components/backstage/constellation/constellationApps.tsx`
- `src/app/components/backstage/apps/comingSoonApps.tsx`
- `src/app/components/backstage/constellation/wishStars.tsx`
- `src/app/components/backstage/constellation/wishStarsEvents.tsx`
- `src/app/components/backstage/constellation/constellationSites.ts`

Use this exact initial status/capability map:

| ID         | Name          | Listing status | API            | Capabilities   |
| ---------- | ------------- | -------------- | -------------- | -------------- |
| runpal     | RunPal        | connected      | none           | moments        |
| alerts     | Safety Alerts | first_party    | not_applicable | mains          |
| discord    | Discord       | coming_soon    | none           | crews          |
| instagram  | Instagram     | coming_soon    | none           | moments, mains |
| luma       | Luma          | coming_soon    | none           | vibes          |
| photos     | Apple Photos  | coming_soon    | none           | moments        |
| spotify    | Spotify       | coming_soon    | none           | moments, vibes |
| strava     | Strava        | coming_soon    | none           | moments        |
| eventmagic | EventMagic.ai | wishlist       | none           | vibes, crews   |
| garmin     | Garmin        | wishlist       | none           | moments        |
| gphotos    | Google Photos | wishlist       | none           | moments        |
| meetup     | Meetup        | wishlist       | none           | vibes, crews   |
| partiful   | Partiful      | wishlist       | none           | vibes          |
| soundcloud | SoundCloud    | wishlist       | none           | moments, vibes |
| telegram   | Telegram      | wishlist       | none           | crews, mains   |
| tiktok     | TikTok        | wishlist       | none           | moments        |
| whatsapp   | WhatsApp      | wishlist       | none           | crews, mains   |
| x          | X             | wishlist       | none           | moments, mains |

Use the public websites already recorded in `constellationSites.ts`; Safety
Alerts points to `/how-it-works/safety-alerts`. Use concise, status-aware
summaries based on the current English SPACE copy. Every seed uses
`reviewed_at: 2026-08-29`. RunPal alone includes a pinned public
`status_evidence_url` to its connected source. Seed records do not claim a
public API.

---

### Task 1: Establish real schema validation

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `registry/catalog.json`
- Create: `registry/schema/app-v1.schema.json`
- Create: `scripts/app-registry.mjs`
- Create: `tests/app-registry.test.mjs`

- [ ] **Step 1: Add direct validator dependencies**

Run:

```sh
env PATH=/Users/philiployd/.nvm/versions/node/v22.20.0/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin npm install --save-dev ajv@8.20.0 ajv-formats@2.1.1
```

This only changes the docsite development dependency and lockfile; it adds no
runtime service. Both exact versions are already present with resolved npm
tarballs in the current lockfile as transitive packages; this step promotes
them to declared direct development dependencies.

- [ ] **Step 2: Write failing schema/loader tests**

Create `tests/app-registry.test.mjs` with native `node:test`, temporary
directories, and real JSON files. Import these not-yet-created exports:

```js
loadRegistry;
validateRegistry;
renderAppsJson;
renderAppsMarkdown;
renderLlmsFull;
```

Start with literal one-record fixtures. Name each break it catches and prove:

- a valid `proposed` manifest passes;
- an ID not matching its filename fails;
- duplicate IDs fail;
- unknown fields and duplicate capabilities fail;
- HTTP or malformed public URLs fail;
- proposed records require `submitted_at`, support, and privacy URLs;
- non-proposed records require `reviewed_at`;
- `connected` requires `status_evidence_url` and every other status forbids it;
- `preview|sandbox|production` requires `api_contract_url`, while
  `none|not_applicable` forbids it; and
- secret/token/client-ID/callback/Main/wallet/grant/internal-endpoint key names
  fail even if nested in malformed input.

- [ ] **Step 3: Run the test and observe RED**

```sh
env PATH=/Users/philiployd/.nvm/versions/node/v22.20.0/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin node --test tests/app-registry.test.mjs
```

Expected: module-not-found for `scripts/app-registry.mjs`.

- [ ] **Step 4: Add the catalog metadata and JSON Schema**

`registry/catalog.json` contains:

```json
{
  "schema_version": "v1",
  "catalog_version": "2026-08-29",
  "space_source": {
    "repository": "https://github.com/pixel-potion/Mains.World",
    "revision": "4babf633b209855c49e1bf698d04b2a03488de8c",
    "paths": ["<the five audited paths above>"]
  }
}
```

The Draft 2020-12 app schema uses `additionalProperties: false`, bounded text,
the five listing statuses, five API states, four capabilities, ISO date fields,
HTTPS URI patterns, and conditional required/forbidden evidence fields.

- [ ] **Step 5: Implement the minimum real loader/validator**

Use `Ajv2020` plus `ajv-formats`. Export pure functions and keep CLI execution
behind an `import.meta.url` main guard. Recursively inspect keys before schema
validation for prohibited field-name families. Load `registry/apps/*.json` in
filename order, validate exact filename/ID correspondence and cross-record
uniqueness, then return freshly sorted records using this rank:

```js
const STATUS_RANK = {
  connected: 0,
  first_party: 1,
  coming_soon: 2,
  proposed: 3,
  wishlist: 4,
};
```

Sort by rank, then `name.localeCompare` with a pinned English locale.

- [ ] **Step 6: Run tests GREEN and commit**

```sh
env PATH=/Users/philiployd/.nvm/versions/node/v22.20.0/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin node --test tests/app-registry.test.mjs
git add package.json package-lock.json registry/catalog.json registry/schema/app-v1.schema.json scripts/app-registry.mjs tests/app-registry.test.mjs
git commit -m "feat: validate public SPACE app manifests"
```

---

### Task 2: Seed all SPACE apps and generate public outputs

**Dependency:** Complete and push the companion MW plan first. Replace
`<MW_CONNECTIVES_COMMIT>` below with its exact publicly reachable 40-character
commit before writing the platform record or generated outputs.

**Files:**

- Create: `registry/platform.json`
- Create: `registry/apps/*.json` (18 files from the seed map)
- Create: `docs/developers/apps.md` (generated)
- Create: `static/apps.json` (generated)
- Create: `static/llms-full.txt` (generated)
- Modify: `scripts/app-registry.mjs`
- Modify: `tests/app-registry.test.mjs`

- [ ] **Step 1: Write failing catalog and renderer tests**

Add literal expectations for the exact 18 IDs, status counts, and capability
arrays in the seed map. Test renderer behavior, not implementation text:

- `registry/platform.json` has `callable: false`, the exact three scopes, exact
  five operation method/path pairs, a 40-character pinned MW revision, and the
  exact three public artifact paths;
- `renderAppsJson` returns the exact `v1` envelope and sorted app array;
- `renderAppsMarkdown` produces one visible row per app, status labels, API
  labels, capabilities, and public website links;
- `renderLlmsFull` includes the no-public-API boundary, submission rules, status
  legend, preview operation list, and all 18 app records; and
- two renders of the same input are byte-for-byte identical.

- [ ] **Step 2: Run test and observe RED**

Expected: missing registry files and placeholder renderers.

- [ ] **Step 3: Add the 18 manifests**

Create one file per row. Use no logo, private identifier, support credential, or
provider configuration. Preserve the SPACE capability arrays exactly, including
Discord as `crews`; explain its future Vibe host/invite fit in the API guide,
not by changing the current catalog mapping.

Also add `registry/platform.json` as the sole structured input for expanded
platform guidance:

```json
{
  "schema_version": "v1",
  "status": "preview",
  "callable": false,
  "repository": "https://github.com/pixel-potion/Mains.World",
  "connectives_revision": "<MW_CONNECTIVES_COMMIT>",
  "artifacts": {
    "openapi": "openapi/connectives-v1.json",
    "discord_example": "openapi/examples/discord-connected-group-membership.json",
    "luma_example": "openapi/examples/luma-vibe-candidate.json"
  },
  "scopes": [
    "candidate-status:read",
    "link-sessions:create",
    "vibe-candidates:write"
  ],
  "operations": [
    { "method": "POST", "path": "/oauth/token" },
    { "method": "POST", "path": "/connectives/v1/link-sessions" },
    { "method": "GET", "path": "/connectives/v1/link-sessions/{session_id}" },
    {
      "method": "POST",
      "path": "/connectives/v1/grants/{grant_id}/vibe-candidates"
    },
    {
      "method": "GET",
      "path": "/connectives/v1/grants/{grant_id}/candidates/{candidate_id}"
    }
  ]
}
```

Validate this record with exact keys, a public HTTPS repository, safe
repository-relative artifact paths, and literal scope/operation tuples. It is
documentation input, not a runtime registry.

- [ ] **Step 4: Implement deterministic renderers and CLI modes**

The CLI supports:

```sh
node scripts/app-registry.mjs generate
node scripts/app-registry.mjs check
```

`generate` writes only the three generated outputs. `check` renders in memory,
compares bytes with committed outputs, prints actionable stale paths, and exits
nonzero without modifying the tree.

`renderLlmsFull` consumes both validated app manifests and
`registry/platform.json`. Its no-callable statement, scopes, operation list,
pinned contract/example URLs derived from the repository/revision/artifact
paths, status rules, submission rules, and catalog rows all come from those
reviewed inputs; no second hand-maintained endpoint or artifact list is
introduced.

The apps JSON envelope is:

```json
{
  "schema_version": "v1",
  "catalog_version": "2026-08-29",
  "space_source": { "repository": "...", "revision": "...", "paths": [] },
  "apps": []
}
```

- [ ] **Step 5: Generate, test, and commit**

```sh
env PATH=/Users/philiployd/.nvm/versions/node/v22.20.0/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin node scripts/app-registry.mjs generate
env PATH=/Users/philiployd/.nvm/versions/node/v22.20.0/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin node --test tests/app-registry.test.mjs
env PATH=/Users/philiployd/.nvm/versions/node/v22.20.0/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin node scripts/app-registry.mjs check
git add registry/platform.json registry/apps docs/developers/apps.md static/apps.json static/llms-full.txt scripts/app-registry.mjs tests/app-registry.test.mjs
git commit -m "feat: publish the SPACE app catalog"
```

---

### Task 3: Enforce the submission PR boundary

**Files:**

- Create: `registry/README.md`
- Create: `registry/examples/proposed-app.json`
- Create: `.github/pull_request_template.md`
- Modify: `.github/workflows/build.yml`
- Modify: `package.json`
- Modify: `scripts/app-registry.mjs`
- Modify: `tests/app-registry.test.mjs`

- [ ] **Step 1: Write a failing real Git diff test**

In a temporary directory, initialize a small Git repository, commit a valid base
registry, then exercise real add/modify/rename/delete changes. Call the
production base-diff policy and prove:

- an added `proposed`/`none` manifest passes;
- an added `connected`, `coming_soon`, `wishlist`, or `first_party` manifest
  fails even if evidence is supplied; and
- an added manifest claiming `preview`, `sandbox`, or `production` fails;
- modifying, renaming, or deleting an existing manifest fails in ordinary
  submission mode; and
- explicit maintenance mode permits those changes only when the final registry
  still satisfies schema, review-date, status-evidence, and API-contract rules.

This test uses real `git init/add/commit/diff`, not a mocked path list.

- [ ] **Step 2: Run test and observe RED**

- [ ] **Step 3: Implement `--base` diff enforcement**

`node scripts/app-registry.mjs check --base <commit>` uses the complete
`git diff --name-status <commit>...HEAD -- registry/apps` result. It requires
each added manifest to be `proposed` with `api_availability: none` and rejects
modified, renamed, copied, or deleted existing manifests. Reject an
invalid/missing base explicitly; never silently skip the PR policy.

`--allow-maintenance` permits changes to existing manifests but never weakens
schema or evidence rules. It is not documented as a builder escape hatch; CI
uses it only after a maintainer applies the `catalog-maintenance` PR label.

- [ ] **Step 4: Add builder and agent instructions**

`registry/README.md` and the example manifest explain:

- public facts only;
- exact copy/rename/edit/generate/test steps;
- new listings remain proposed;
- how a human reviewer supplies `reviewed_at`;
- merge means listing, not credentials or activation; and
- never paste secrets, tokens, client IDs, private callback URLs, Main/user
  data, wallets, or internal endpoints.

The pull-request template adds a focused app-submission checklist without
making unrelated docs PRs complete irrelevant fields.

- [ ] **Step 5: Wire scripts and CI**

Add package scripts:

```json
{
  "apps:generate": "node scripts/app-registry.mjs generate",
  "apps:check": "node scripts/app-registry.mjs check",
  "test:registry": "node --test tests/app-registry.test.mjs"
}
```

Change Actions checkout to `fetch-depth: 0`. On pull requests run
the base check without maintenance permission by default. If and only if the
maintainer-controlled `catalog-maintenance` label is present, run it with
`--allow-maintenance`. Add `labeled` and `unlabeled` pull-request activity types
so that changing the label reruns the gate. On push run `npm run apps:check`.
Run the registry tests before the existing legal test and production build.

- [ ] **Step 6: Run tests/check and commit**

```sh
env PATH=/Users/philiployd/.nvm/versions/node/v22.20.0/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin npm run test:registry
env PATH=/Users/philiployd/.nvm/versions/node/v22.20.0/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin npm run apps:check
git add registry/README.md registry/examples/proposed-app.json .github/pull_request_template.md .github/workflows/build.yml package.json scripts/app-registry.mjs tests/app-registry.test.mjs
git commit -m "feat: review app submissions through docs PRs"
```

---

### Task 4: Publish developer, preview API, and AI-readable guidance

**Dependency:** Task 2 already records the companion MW plan's exact publicly
reachable Connectives commit in `registry/platform.json`. The API page and its
tests must use that value for every contract/example link.

**Files:**

- Create: `docs/developers/index.md`
- Create: `docs/developers/api.md`
- Create: `docs/developers/submit-an-app.md`
- Create: `static/llms.txt`
- Create: `tests/developers-pages.test.mjs`
- Modify: `docs/connect-your-app.md`
- Modify: `sidebars.ts`
- Modify: `docusaurus.config.ts`
- Modify: `.github/workflows/build.yml`
- Modify: `package.json`

- [ ] **Step 1: Write the failing rendered-surface test**

Create a Node test that reads a completed Docusaurus build and checks observable
outputs:

- `/developers/`, `/developers/apps`, `/developers/api`, and
  `/developers/submit-an-app` exist;
- the Apps HTML contains 18 distinct table rows/links and the five status
  explanations;
- the API page visibly states that no public endpoint is callable and labels
  each of the five preview operations **Not callable**;
- `/apps.json`, `/llms.txt`, and `/llms-full.txt` exist in the build output;
- every local path advertised by `llms.txt` resolves in `build/`; and
- `registry/platform.json` contains a 40-character commit and every raw MW URL
  uses `/blob/<that exact commit>/` (or `/raw/<that exact commit>/` where
  appropriate), never `/main/`.

Do not test exact paragraphs or stylistic wording.

- [ ] **Step 2: Run a build/test and observe RED**

```sh
env PATH=/Users/philiployd/.nvm/versions/node/v22.20.0/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin npm run build
env PATH=/Users/philiployd/.nvm/versions/node/v22.20.0/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin node --test tests/developers-pages.test.mjs
```

Expected: missing developer routes and `llms.txt`.

- [ ] **Step 3: Add the Developers section**

Write concise public pages:

- overview: listing/runtime boundary and platform status;
- Apps: generated table and legend;
- API: available-now statement, preview credentials/scopes/operation table,
  Discord external-Crew flow, Luma candidate flow, errors, and exact pinned MW
  OpenAPI/example links; and
- Submit an app: GitHub web and local/agent paths, review checklist, commands,
  and what happens after merge.

The API page must say there is no server URL, sandbox, key issuance, public
OAuth registration, public write API, or MCP endpoint. It must not mention
RunPal's private route shapes. It must preserve World App as identity, consent,
native-action, credits, wallet/Vault, and withdrawal boundary.

Cross-check the human endpoint/scopes table against `registry/platform.json` in
the rendered-surface test. `static/llms-full.txt` is already generated from that
record; rerun `apps:generate` and include it if the reviewed platform input
changes while writing the page.

- [ ] **Step 4: Add navigation and reconcile existing copy**

- add a **Developers** sidebar category for the four pages;
- add a compact Developers navbar/footer link;
- point `connect-your-app.md` at the new pages;
- replace only the obsolete “no developer documentation” sentence while
  preserving the truthful no-public-interface/no-self-service-key boundary; and
- do not describe the rolled-back SPACE map controls as live.

- [ ] **Step 5: Add curated `llms.txt`**

Keep it short. Link to the four developer pages, `/apps.json`, `/llms-full.txt`,
the schema, registry README, and GitHub submission directory. Lead with “No
public Main's World API endpoint is callable today.” Do not duplicate catalog
rows or create agent-only product facts.

- [ ] **Step 6: Build, test, and commit**

```sh
env PATH=/Users/philiployd/.nvm/versions/node/v22.20.0/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin npm run typecheck
env PATH=/Users/philiployd/.nvm/versions/node/v22.20.0/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin npm run build
env PATH=/Users/philiployd/.nvm/versions/node/v22.20.0/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin node --test tests/developers-pages.test.mjs
git add docs/developers docs/connect-your-app.md static/llms.txt sidebars.ts docusaurus.config.ts .github/workflows/build.yml package.json tests/developers-pages.test.mjs
git commit -m "docs: publish developer API and submission guide"
```

---

### Task 5: Full docsite and browser verification

**Files:** Verification only unless an observed defect needs a focused test/fix.

- [ ] **Step 1: Run deterministic catalog gates**

```sh
env PATH=/Users/philiployd/.nvm/versions/node/v22.20.0/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin npm run apps:check
env PATH=/Users/philiployd/.nvm/versions/node/v22.20.0/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin npm run test:registry
```

- [ ] **Step 2: Run existing and new tests, typecheck, and production build**

```sh
env PATH=/Users/philiployd/.nvm/versions/node/v22.20.0/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin node --test tests/legal-pages.test.mjs
env PATH=/Users/philiployd/.nvm/versions/node/v22.20.0/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin npm run typecheck
env PATH=/Users/philiployd/.nvm/versions/node/v22.20.0/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin npm run build
env PATH=/Users/philiployd/.nvm/versions/node/v22.20.0/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin node --test tests/developers-pages.test.mjs
```

Also run `tests/around-the-world.test.mjs` because navigation/build changes share
the same site surface.

- [ ] **Step 3: Verify generated and security boundaries**

Confirm:

- all 18 manifests appear once in Markdown and JSON;
- generated files are byte-stable after a second generation;
- no secret-like values or private endpoints exist;
- no `crew-candidates:write`, `/crew-candidates`, mutable MW branch link, server
  URL, or callable claim exists;
- app-submission merge is repeatedly described as listing only; and
- `git diff origin/main --name-status` contains only the planned public docs,
  registry, validation, test, and CI files.

- [ ] **Step 4: Browser-verify the built site**

Use the project's `verify` skill against a local static server. Check
`/developers/`, `/developers/apps`, `/developers/api`, and
`/developers/submit-an-app` at approximately `390x844` and `1280x720`.
Confirm table readability/scrolling, navigation, code blocks, links, dark/light
contrast, and that no page visually suggests preview endpoints are live.

- [ ] **Step 5: Request code review and resolve validated findings**

Use the requesting-code-review workflow on the complete branch diff. Add a
failing test before fixing behavioral findings.

### Task 6: Open the reviewable PR without deploying

- [ ] **Step 1: Re-run the final gate from a clean worktree**

Record catalog/test/build/browser results and `git status --short`.

- [ ] **Step 2: Push the isolated branch**

```sh
git push -u origin codex/developers-api-app-catalog
```

- [ ] **Step 3: Open a GitHub pull request**

The PR body must state:

- all 18 SPACE entries and honest statuses are public;
- no public API endpoint is callable;
- the exact pinned MW Connectives commit;
- how builders submit a proposed manifest;
- merge publishes a listing only;
- verification commands/results; and
- no deployment, provider mutation, credential, OAuth configuration, or
  production-data change occurred.

Do not merge or deploy. Return the PR URL to the user for review.
