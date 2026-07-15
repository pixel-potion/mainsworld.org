# mainsworld.org

The public, community-editable knowledge base for **Main's World** and for
**SHIP** (a Secure Human Interaction Protocol). Built with
[Docusaurus](https://docusaurus.io/).

This repo is intentionally **separate from the app repo** and holds only
public-appropriate content — no secrets, app IDs, security internals, or
unshipped economics stated as fact. See [`docs/contribute.md`](docs/contribute.md)
for what belongs here.

## Local development

```bash
npm install
npm start        # live preview at http://localhost:3000
```

Edit any file under `docs/`; pages hot-reload as you save.

## Build

```bash
npm run build    # static output in ./build
npm run serve    # preview the production build locally
```

## Deployment — Cloudflare Pages

Hosted on Cloudflare Pages to match the rest of the Main's World stack. Connect
this repo in the Cloudflare dashboard with:

- **Build command:** `npm run build`
- **Build output directory:** `build`
- **Node version:** 20 or newer

Point the `mainsworld.org` domain at the Pages project. Every merge to `main`
then publishes automatically. (The default `npm run deploy` script targets GitHub
Pages and is **not** used here.)

## Contributing

Every page has an "Edit this page" link. See
[`docs/contribute.md`](docs/contribute.md) or the live
[Contribute guide](https://mainsworld.org/contribute).

## Assets still to add

- `static/img/logo.svg` — currently the Docusaurus default; replace with the
  Main's World mark.
- `static/img/favicon.ico` — replace with the MW favicon.
- `static/img/social-card.jpg` — social/share preview image (referenced in
  `docusaurus.config.ts`).
