# Public SPACE app listings

This registry is for public listing facts only. A merged manifest lists an app
in SPACE; it does not create credentials, callbacks, grants, provider access,
runtime registration, or production activation.

## Submit a new listing

1. Copy the example with
   `cp registry/examples/proposed-app.json registry/apps/<app-id>.json`.
   Keep the filename and `id` identical.
2. If you need to rename an uncommitted draft, use
   `git mv registry/apps/<old-id>.json registry/apps/<new-id>.json` and update
   its `id` to `<new-id>`. Do not rename existing manifests in a normal
   submission.
3. Replace the example with concise public facts: an honest summary, public
   website, support URL, privacy URL, and the SPACE areas it fits today.
4. Keep every new external listing at `"listing_status": "proposed"` and
   `"api_availability": "none"`. Do not rename, edit, or delete existing
   manifests, platform metadata, or preview snapshots in a normal submission.
5. Run `npm run apps:generate`, `npm run test:registry`, and
   `npm run apps:check`. Commit the resulting generated catalog outputs with
   the manifest.
6. Open a docs pull request. A human maintainer reviews public facts and may
   add `reviewed_at` later. Promotion to a connected listing or an API tier is
   a separate reviewed change with its required public evidence.

Before editing an existing listing or the reviewed preview snapshot, ask a
maintainer to apply the `catalog-maintenance` label. That label only enables
maintenance review; it never bypasses validation or makes anything callable.

Pull-request policy validation runs from the trusted base branch, against the
proposed checkout as data only. It does not run a contributor's scripts. A
change to the policy or schema format may therefore need a policy-first
maintainer PR before a later data migration can use that format.

## Never include private material

Do not paste secrets, tokens, credentials, client IDs, private callback URLs,
Main or user data, wallet addresses, grant material, or internal endpoints.
There are no public self-service API endpoints, sandbox credentials, or MCP
endpoint to call today.
