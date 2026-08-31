---
title: API preview
---

# API preview

**No public Main's World API endpoint is callable today.** There is no server or
base URL to call. The OpenAPI preview uses the reserved, non-routable
`https://example.invalid` documentation target so its default `/` cannot resolve
to this site. There is no sandbox. There is no self-service key issuance. There is
no public OAuth registration. There is no public write API, SDK, or MCP
endpoint. Do not treat this page or its snapshots as a runtime interface.

The Connectives preview is reviewed release documentation from the
access-restricted normative provenance in Main's World at revision
`ce8df37f26781edf6901344e0905c0f6286f3eb6`. The public snapshots below are
hash-pinned review material. They provide neither runtime access nor credentials.

## Reviewed snapshots

- <a href="/api/connectives/v1/openapi.json">OpenAPI contract</a> — SHA-256
  `fea7f6ec8a49625b5baab5c681a675edc06ba59a6207a149893011862fe8c4f4`
- <a href="/api/connectives/v1/discord-connected-group-membership.json">Discord connected-group membership example</a>
  — SHA-256 `4043b1ef41de71271352145f6a8fbb3e400e3d34e9d09d070d6b5791e78ca1db`
- <a href="/api/connectives/v1/luma-vibe-candidate.json">Luma Vibe candidate example</a>
  — SHA-256 `499d12a33183ce6fed9335fa3021d79ba2da30205d1d80d2e8c4017d3f6358a9`

## Preview contract — not available

The listed scopes are documentation only: `candidate-status:read`,
`link-sessions:create`, and `vibe-candidates:write`.

| Preview operation | Availability |
| --- | --- |
| `POST /oauth/token` | **Not callable** |
| `POST /connectives/v1/link-sessions` | **Not callable** |
| `GET /connectives/v1/link-sessions/{session_id}` | **Not callable** |
| `POST /connectives/v1/grants/{grant_id}/vibe-candidates` | **Not callable** |
| `GET /connectives/v1/grants/{grant_id}/candidates/{candidate_id}` | **Not callable** |

If this preview later changes, normal error handling would use the reviewed
contract. Today no request can be made, so there are no live errors to handle.

## Discord: external membership, native choice

For a Main that independently connects an eligible Discord server, its server
memberships may appear as **external Discord-badged Crews**. They are never
native Crew candidates or native Crew links. The flow does not change a roster,
bot, messages, or the provider.

When planning a Vibe, the current owner or manager can choose that external host
attribution and a dynamic invite audience. The Main who creates the Vibe remains
the operational host. Only Mains who are independently connected and currently
match the audience are eligible; each person explicitly RSVPs or joins.
Disconnecting or leaving removes future eligibility, but does not erase native
history from a Vibe already joined. External attribution never grants native
host or credit authority.

## Luma: a reviewed candidate, not a Vibe

Luma may provide a reviewed Vibe candidate input only. A candidate does not
create, host, publish, or join a Vibe on anyone's behalf. The World App keeps
identity, authentication, consent, native actions, credits, wallet, Vault, and
withdrawal decisions inside Main's World.
