# Developers, API, and SPACE app submissions

**Status:** Approved product design; implementation not yet started

**Date:** 2026-08-29

**Repositories:** `pixel-potion/mainsworld.org` for public documentation and
listing review; `pixel-potion/Mains.World` for runtime contracts and future
activation

## Purpose

Main's World needs a public place where builders and their agents can learn
what the connected-app platform does, see every app represented in SPACE, and
propose a new listing for review. The public workflow must be useful before the
Connectives runtime is deployed without implying that preview endpoints,
credentials, or provider integrations already exist.

The smallest coherent release is therefore a documentation-and-review surface:

- `mainsworld.org` owns the public app catalog, developer guidance, generated
  catalog outputs, and pull-request submission flow.
- `Mains.World` owns the normative Connectives contract, permission policy, and
  any future runtime application registry or credential issuance.
- Merging a docsite pull request publishes or changes a public listing only. It
  never grants API access, approves provider credentials, or activates an
  integration in production.

No provider mutation, OAuth setup, endpoint deployment, credential issuance,
database change, or production configuration is part of this design.

## Source-of-truth boundaries

### Public catalog and submission authority

The docsite stores one public JSON manifest per app. Those manifests are the
single source for the human Apps page and machine-readable catalog. They contain
only public listing facts and must never contain secrets, tokens, client IDs,
private callback URLs, Main identifiers, internal service addresses, or grant
material.

The catalog answers:

- Which apps are represented in SPACE?
- What is each app's honest product status?
- Which Main's World nouns could it contribute to?
- Is there any public API access for it today?
- Where can a reviewer find its public website, support, and privacy material?

The catalog does not authorize runtime behavior.

### Runtime and contract authority

The MW application repository remains authoritative for:

- the Connectives OpenAPI contract and its permission vocabulary;
- World App authentication, consent, credits, wallet/Vault, and native actions;
- application registration, sandbox or production credentials, callback
  approval, grants, revocation, audit, and provider secrets; and
- whether an endpoint or integration is actually deployed and callable.

The docsite may link to a versioned MW contract and explain it. The link must
pin the exact publicly reachable MW commit that contains the matching endpoint,
scope, and example revisions; it must not point loosely at a branch that could
still contain the superseded native Crew-candidate flow. The docs pull request
must not merge before that pinned commit is available. The docsite must not
copy preview operations into a second normative API or turn a catalog merge
into runtime approval.

## Public status model

The Apps page shows every app currently represented in the SPACE constellation,
not only live integrations. Status is explicit so presence in the interface is
never confused with connectivity or API availability.

The listing statuses are:

- `connected` — a bespoke partner integration exists today. Initially RunPal.
- `first_party` — an MW-operated capability, not a submitted partner app.
  Initially Safety Alerts.
- `coming_soon` — deliberately shown on the current app shelf, but not connected
  or callable. Initially Strava, Apple Photos, Instagram, Spotify, Luma, and
  Discord.
- `wishlist` — represented as a future possibility, with no connector promised.
  Initially EventMagic.ai, Partiful, Meetup, Garmin, Google Photos, SoundCloud,
  WhatsApp, Telegram, TikTok, and X.
- `proposed` — a reviewed public listing from the builder submission process;
  it is not yet connected or activated.

API availability is a separate field:

- `none` — no public API access.
- `preview` — a documented non-callable contract exists.
- `sandbox` — callable sandbox access has been independently verified.
- `production` — callable production access has been independently verified.
- `not_applicable` — a first-party capability for which partner API availability
  does not apply.

The initial catalog must not use `sandbox` or `production`. RunPal is accurately
described as a bespoke connected integration with no public self-service API.
Safety Alerts is first-party. All other seed entries have no API access.

## Catalog structure

The public registry lives under:

```text
registry/
  README.md
  catalog.json
  platform.json
  schema/app-v1.schema.json
  apps/<app-id>.json
  examples/proposed-app.json
```

`catalog.json` declares the catalog version and records the exact MW commit and
source paths used for the initial SPACE audit. `platform.json` records the exact
pinned revised Connectives commit, three preview scopes, five preview
operations, `callable: false`, and repository-relative paths for the OpenAPI,
Discord example, and Luma example; it feeds immutable artifact links and
machine-readable platform guidance and is checked against the rendered API
page. These are provenance and public documentation inputs, not a runtime sync.
Later changes remain explicit pull requests.

Each manifest uses a bounded v1 shape:

```json
{
  "schema_version": "v1",
  "id": "discord",
  "name": "Discord",
  "summary": "A future connection for Discord communities in the Crews experience.",
  "website": "https://discord.com/",
  "listing_status": "coming_soon",
  "api_availability": "none",
  "capabilities": ["crews"],
  "support_url": "https://support.discord.com/",
  "privacy_url": "https://discord.com/privacy",
  "reviewed_at": "2026-08-29"
}
```

Every manifest requires `schema_version`, `id`, `name`, `summary`, `website`,
`listing_status`, `api_availability`, and `capabilities`. A `proposed` manifest
also requires a builder-supplied `submitted_at`, `support_url`, and
`privacy_url`; `reviewed_at` is optional until a maintainer reviews it. Every
non-proposed seed or promoted record requires the maintainer-written
`reviewed_at`. Support and privacy URLs are optional for historical wishlist
records until reviewed. Logos are deferred from this starter so the catalog is
not blocked on unverified third-party brand assets.

An optional `api_contract_url` may point to a reviewed public contract. It is
required before `api_availability` can become `preview`, `sandbox`, or
`production`. An optional `status_evidence_url` is required before an app can
be promoted to `connected`. Both fields must be public HTTPS URLs.

Allowed capabilities mirror the app's current SPACE filters: `mains`, `crews`,
`moments`, and `vibes`. They describe where the app is represented in the
current SPACE catalog, not every approved future use, an OAuth scope, or a
granted permission. Discord therefore remains `crews` in the catalog while the
separate preview documentation explains future external-Crew Vibe hosting and
invites.

## Validation and generated outputs

A repository script validates every manifest against the v1 schema and applies
cross-record rules:

- file name equals `<id>.json`;
- IDs are unique lowercase DNS-style slugs;
- all enum values and capability lists are bounded and duplicate-free;
- public links use HTTPS;
- aggregate outputs use the fixed status order `connected`, `first_party`,
  `coming_soon`, `proposed`, `wishlist`, then display name;
- a proposed app includes public support and privacy links;
- `connected` requires `status_evidence_url`; every other listing status forbids
  it;
- `preview`, `sandbox`, or `production` API availability requires
  `api_contract_url`; `none` and `not_applicable` forbid it;
- unknown fields fail validation; and
- prohibited credential, token, callback, identity, internal endpoint, and
  grant-like field names fail validation even if nested.

On a pull request, CI compares added manifests with the checked-out base commit.
Every newly added external manifest must use `listing_status: proposed` and
`api_availability: none`; the workflow fetches sufficient history to make that
check deterministic. Status promotion is a separate reviewed change and must
include `status_evidence_url` for `connected` and `api_contract_url` for any
public API tier. This prevents a submission from self-declaring that it is
connected or callable.

Modifying, renaming, or deleting an existing manifest is catalog maintenance,
not a new-app submission. CI rejects it unless a maintainer applies the
`catalog-maintenance` pull-request label. The label changes only the review
mode; final manifests must still pass schema and evidence rules.

One deterministic generation command creates:

- `docs/developers/apps.md`, containing the visible table and status legend;
- `static/apps.json`, containing a `v1` catalog envelope, pinned SPACE source
  revision, and the complete app array; and
- the catalog portion of `static/llms-full.txt`.

Generated files are committed so they can be reviewed and served as ordinary
static assets. CI reruns generation and fails if the working tree changes,
preventing the table, JSON output, and manifests from drifting.

The JSON envelope is:

```json
{
  "schema_version": "v1",
  "catalog_version": "2026-08-29",
  "space_source": {
    "repository": "https://github.com/pixel-potion/Mains.World",
    "revision": "<40-character commit>",
    "paths": ["<audited catalog source paths>"]
  },
  "apps": []
}
```

## Developer documentation

The Docusaurus sidebar gains a **Developers** category with four pages:

1. `/developers/` — what the platform is, its current availability, and the
   boundary between a public listing and an activated integration.
2. `/developers/apps` — the generated app table and status explanations.
3. `/developers/api` — the available-now API statement plus the preview
   Connectives endpoint, token, permission, and example-flow documentation.
4. `/developers/submit-an-app` — the human and agent submission procedure.

The top-level **Connect your app** page points builders into this section and is
updated only where necessary to stay consistent.

### API truth boundary

The API page begins with an unambiguous statement:

> There are no public, self-service Main's World API endpoints to call today.

It then documents the non-deployed Connectives preview from the MW repository:

- `POST /oauth/token`
- `POST /connectives/v1/link-sessions`
- `GET /connectives/v1/link-sessions/{session_id}`
- `POST /connectives/v1/grants/{grant_id}/vibe-candidates`
- `GET /connectives/v1/grants/{grant_id}/candidates/{candidate_id}`

Every preview operation is labeled **Not callable**. The page states that
there is no server URL, sandbox, key issuance, public OAuth client registration,
public write API, or MCP endpoint. RunPal's bespoke private routes are not
presented as a public API.

The documented preview scope set is:

- `link-sessions:create`
- `vibe-candidates:write`
- `candidate-status:read`

`crew-candidates:write` is excluded because the approved Discord model mirrors
external group membership instead of creating a native Crew candidate.

The page links to the pinned, revised MW OpenAPI document and the matching
synthetic Discord connected-group and Luma Vibe examples. The MW revision must
remove the old `/crew-candidates` operation and `crew-candidates:write` scope
before the docsite can reference it. The page explains that Discord host/invite
actions remain first-party World App actions and that Luma candidates remain
review-before-adoption input. The World App remains the identity,
authentication, consent, credits, wallet/Vault, and native-action boundary.

## Submission workflow

The live builder workflow is GitHub pull-request review:

1. A builder or their agent reads `/developers/submit-an-app`, `llms.txt`, and
   `registry/README.md`.
2. They copy the example proposed-app manifest to
   `registry/apps/<app-id>.json` and add only public facts.
3. They run the validation/generation command and the documented site checks.
4. They open a pull request against `pixel-potion/mainsworld.org` with the app's
   public website, support, privacy, capability fit, and honest current status.
5. CI validates the schema, generated outputs, and Docusaurus build.
6. CI requires every newly added external app to remain `proposed` with no API
   access. A maintainer reviews the public listing and supplies `reviewed_at` as
   part of the reviewed change. Merge publishes the proposed listing; it does
   not create an account, grant, key, callback, or provider connection.
7. Any later sandbox or production activation is separate MW implementation
   work and requires independent evidence before the public API status changes.

The repository pull-request template includes an app-submission checklist. It
does not ask contributors to paste secrets, tokens, client IDs, credentials,
private callback URLs, or user data.

## AI-readable surface

The same public facts are available in several deliberately simple forms:

- `/llms.txt` — a small, curated index of the developer pages, submission guide,
  machine-readable catalog, and current no-public-API status; link checks keep
  it aligned, but catalog rows are not duplicated there;
- `/llms-full.txt` — expanded rules, status vocabulary, endpoint availability,
  submission procedure, and generated catalog;
- `/apps.json` — versioned structured catalog derived from the manifests;
- `registry/schema/app-v1.schema.json` — exact submission shape; and
- `registry/README.md` — step-by-step instructions written for both people and
  coding agents.

The agent instructions explicitly require honest status labels, forbid secrets,
and forbid claiming a preview operation is callable. No separate agent-only
truth source is introduced.

## Testing and review gates

Focused Node tests must prove:

- all 18 initial manifests validate and have unique IDs;
- catalog provenance pins the MW revision and paths used to audit the initial
  18 status and capability mappings;
- proposed submissions require support and privacy links;
- a newly added manifest cannot self-declare a non-proposed status or public API
  availability;
- every final catalog record enforces the evidence URL required by a connected
  status or public API tier, including later promotions of existing records;
- malformed IDs, HTTP links, unknown fields, duplicate capabilities, and
  prohibited secret-like fields fail;
- generated Markdown, versioned JSON envelope, and `llms-full.txt` are
  deterministic and current, while curated `llms.txt` links remain valid;
- the Apps page contains every catalog entry and its honest status;
- the API page calls every preview endpoint non-callable and contains no server
  URL or public credential instructions;
- `crew-candidates:write` does not reappear; and
- navigation and existing public-doc tests remain green.

The normal Docusaurus typecheck and production build remain required. No live
deployment is needed to validate this starter, though a future release should
receive responsive browser verification after merge.

## Non-goals

- A public application-registration or credential endpoint.
- A hosted submission form or database.
- Automatic activation after a catalog merge.
- Provider OAuth, bots, webhooks, messages, roster imports, or write actions.
- A runtime app registry in the docsite.
- Publishing RunPal's private partner routes.
- Claiming Discord, Luma, Slack, or any wishlist app is connected.
- Shipping a sandbox, MCP server, SDK, mobile package, or production API.
- Synchronizing docsite manifests into MW at runtime.

## Acceptance criteria

The design is implemented when a builder or coding agent can determine, without
private context:

1. Every app currently represented in SPACE and its honest status.
2. Whether any public endpoint is callable today.
3. Which operations and scopes exist only in the preview contract.
4. How to create a valid public listing submission PR.
5. Which data must never be committed.
6. Why a merged listing does not grant credentials or production access.
7. Where the normative future runtime contract lives.
8. How the Discord external-Crew and Luma reviewed-candidate examples preserve
   World App authority.

All of this must be testable without making a production provider mutation.
