# UI standards

The floor under every screen we ship, on every site and app. A brand layer (for
this repo, `docs/design-system.md`) sits on top and may be stricter; nothing may
be looser. Written to be copied into a new project unchanged.

Read by both agents: Claude Code through `CLAUDE.md`, Codex through `AGENTS.md`.
Both files point here. A PR that breaks a rule in this file is not done,
whatever else it does.

## 1. Interfaces do not explain themselves

The screen shows what to do; it does not say what to do.

- **No helper text.** Nothing renders under a title, a section head, a field
  label or a button to explain it. If a label needs a sentence to be understood,
  change the label.
- **The one exception is a (?) affordance.** When a Main genuinely needs
  background (a rule, a consequence, a term), the label gets a small (?) icon
  button. Tapping it opens a small, quiet panel with one or two sentences and
  nothing else. Closed by default, always. In this repo that is `HelpTip`.
- **A new state changes the label of the thing that already exists.** It never
  adds a chip, a caption, a legend or a second element beside it. Budget is one
  or two words. If the state can't be said in two words, the state is the
  problem, not the copy.
- **Tooltips don't exist on phones.** A `title` attribute is a courtesy for
  desktop, never the place the meaning lives.
- **Empty states are one calm line and the action.** No paragraph, no
  exclamation mark doing the motivation's job.
- **What stays as words:** content, consent and permission copy, destructive
  confirms, error messages that say what to do next, and legally required
  attribution.

## 2. Standard patterns before invented ones

Build what the platform and the best-known apps already taught people.

- **Native controls first.** A date is a native date picker. A choice between a
  few options is a native `<select>` or a segmented control. Sharing uses the
  system share sheet. A custom widget needs a reason the native one can't meet,
  stated in the PR.
- **One primary action per screen**, visually distinct. Everything else is
  secondary or lives behind one labelled door (a ⋯ menu, a chip that reveals a
  row).
- **Progressive disclosure.** Show the common case; reveal the rest on request.
  Five buttons in a column is a wall.
- **Conventions people already know:** back is top-left or a swipe, close is
  top-right or a swipe down, destructive is red and confirmed, the keyboard's
  return key does the obvious thing, pull-to-refresh refreshes.
- **Consistency beats novelty.** The same thing looks and behaves the same way
  everywhere in the app. Reuse the existing component before writing one.

## 3. Text fields never trigger zoom

iOS Safari zooms the page when a focused field's computed font size is under
16px. That zoom breaks the layout and it never fully undoes itself.

- **Every `input`, `textarea` and `select` renders at 16px or larger.** No
  `text-sm`, `text-xs` or any pixel size under 16 on a field, ever, including in
  a shared class constant.
- **The stylesheet carries a floor** so a field with no size class still lands
  at 16px: `input, textarea, select { font-size: max(1rem, 1em) }` in the base
  layer.
- **A test enforces it** by scanning the source for fields under 16px, so a
  regression fails CI instead of Phil's phone. In this repo that is
  `src/app/inputTextSize.test.mjs`.
- Never "fix" this with `maximum-scale=1` or `user-scalable=no` in the viewport
  meta tag: that disables pinch-zoom for everyone who needs it.

## 4. Legibility and touch

- **Copy is legible before it is stylish.** Never shrink a font to make text
  fit; cut words instead. Body text is never under 14px; small sizes are for
  chrome only (counts, timestamps, chips), never for a sentence.
- **Touch targets are at least 44×44px**, even when the visible icon is smaller.
  Pad the hit area, not the glyph.
- **Contrast** meets WCAG AA for text. Faint text is for whispers; if it
  matters, it isn't faint.
- **Motion respects `prefers-reduced-motion`.** Every animation ships with its
  reduced branch.
- **Every interactive element has an accessible name.** Icon-only buttons get an
  `aria-label`. Copy in a component is never a literal string; it comes from the
  translation catalogs in every shipped language.

## 5. Installing this in a new project

1. Copy this file to the repo root as `DESIGN.md`.
2. Add to `CLAUDE.md` and `AGENTS.md`: "Read `DESIGN.md` before touching UI. It
   is a hard rule, not guidance."
3. Add the font-size floor from §3 to the base stylesheet.
4. Add a source-scanning test for fields under 16px and run it in CI.
5. Add a (?) affordance component before the first helper sentence is written,
   so there is never a reason to write one.
