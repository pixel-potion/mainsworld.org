---
title: Submit an app
---

# Submit an app

You can propose a public SPACE listing. A merge lists the app only: it never
issues credentials, creates a callback, grants provider access, registers a
runtime integration, or activates production access.

The submission policy runs from the trusted base branch and reads your pull
request as data; contributor scripts are never part of that validation. If a
new schema or policy format is needed, maintainers may land it first, then
review the catalog migration in a follow-up PR.

## In GitHub

Open the [proposed app example](https://github.com/pixel-potion/mainsworld.org/blob/main/registry/examples/proposed-app.json),
copy it into `registry/apps/<app-id>.json`, and open a pull request. Use concise
public facts: a truthful summary, public website, support and privacy links, and
the SPACE areas it fits.

Your pull request should show that the manifest is new, remains
`"listing_status": "proposed"` and `"api_availability": "none"`, and includes
the generated catalog output and passing checks. Do not edit an existing catalog
record, `registry/catalog.json`, `registry/platform.json`, or the reviewed
snapshots. Those changes are maintainer work, not a builder submission.

## Locally or with an agent

```sh
git clone https://github.com/pixel-potion/mainsworld.org
cd mainsworld.org
cp registry/examples/proposed-app.json registry/apps/<app-id>.json
# edit only the new manifest with public facts
npm run apps:generate
npm run test:registry
npm run apps:check
git add registry/apps/<app-id>.json docs/developers/apps.md static/apps.json static/llms-full.txt
git commit -m "docs: propose <app name> SPACE listing"
```

Open a docs pull request with the app's public website, support and privacy
links, and the command output as review evidence. Never include secrets, tokens,
credentials, client IDs, private callback URLs, Main or user data, wallets,
grant material, or internal endpoints.

## After review

A maintainer checks that the facts are public and honest. If merged, the app is
listed as **Proposed** with no API access. It is not connected, callable, or
activated; any future promotion is a separate reviewed decision.
