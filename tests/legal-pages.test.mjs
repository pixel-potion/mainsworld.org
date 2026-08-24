import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const buildSite = () =>
  execFileSync(
    process.execPath,
    ["node_modules/@docusaurus/core/bin/docusaurus.mjs", "build"],
    { stdio: "pipe" },
  );

const html = (route) => readFileSync(`build/${route}/index.html`, "utf8");
const visibleText = (markup) =>
  markup
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:amp|#39|quot|lt|gt|nbsp);/g, " ")
    .replace(/\s+/g, " ");

test("publishes current Terms and Privacy routes with legal navigation", () => {
  buildSite();

  const termsHtml = html("terms");
  const privacyHtml = html("privacy");
  const terms = visibleText(termsHtml);
  const privacy = visibleText(privacyHtml);

  for (const page of [terms, privacy]) {
    assert.match(page, /Pixel Potion Creative LLC/);
    assert.match(page, /hello@mains\.world/);
    assert.match(page, /Austin, Texas, USA/);
  }

  assert.match(terms, /at least 18 years old/);
  assert.match(
    termsHtml,
    /href=(?:")?https:\/\/world\.org\/legal\/user-terms-and-conditions(?:")?/,
  );
  assert.match(
    privacyHtml,
    /href=(?:")?https:\/\/world\.org\/legal\/privacy-notice(?:")?/,
  );
  assert.doesNotMatch(termsHtml, /user-terms-and-conditions\/4\.0/);

  assert.match(terms, /mandatory automated or AI-assisted review/);
  assert.match(terms, /may block public placement/);
  assert.match(terms, /broad public-facing audience/);
  assert.match(privacy, /broad public-facing audience/);
  assert.doesNotMatch(terms, /all-ages audience/);
  assert.doesNotMatch(privacy, /all-ages audience/);
  assert.match(terms, /SKY is public and can include precise location/);
  assert.match(
    privacy,
    /unauthorized LAND viewers.*approximately 110-meter location hint.*without identity or content/i,
  );
  assert.match(privacy, /DEEP provides no location hint/i);
  assert.match(terms, /not offered as an investment/);
  assert.doesNotMatch(terms, /\$MAIN is .*not an investment/);
  assert.match(privacy, /Anthropic.*Claude/);
  assert.match(privacy, /visible in the administrator queue for seven days/);
  assert.match(privacy, /signed access.*expires after seven days/);
  assert.match(privacy, /removed by a later administrator cleanup/);
  assert.match(privacy, /refusal records may remain in operational storage/);
  assert.doesNotMatch(privacy, /records and quarantine media expire after/);
  assert.match(privacy, /administrator may override/);
  assert.match(privacy, /no user-facing appeal/);
  assert.match(privacy, /advisory.*does not block posting/i);
  assert.match(
    privacy,
    /Mapbox receives coordinates and search terms.*maps, search, and geocoding/i,
  );
  assert.match(
    privacy,
    /National Weather Service.*public alert providers.*rounded coordinates/i,
  );
  assert.match(
    terms,
    /provenance-declared or high-confidence AI-generated images/,
  );
  assert.match(terms, /signals are imperfect/);

  assert.match(privacy, /complete read-only view/);
  assert.match(privacy, /precise location/);
  assert.match(privacy, /comments/);
  assert.match(privacy, /privacy-trimmed RunPal route/);
  assert.match(
    privacy,
    /Except for that exact-link authenticated Vibe auto-join.*no other write access/i,
  );
  assert.match(
    privacy,
    /do not maintain a separate archive of deleted content/i,
  );

  assert.match(termsHtml, />Terms of Service</);
  assert.match(termsHtml, />Privacy Policy</);
  assert.match(termsHtml, /navbar__item dropdown[^>]*>[\s\S]*?>Legal</);

  assert.match(
    terms,
    /do not apply to fraud, willful misconduct, gross negligence/,
  );
  assert.match(terms, /arising out of your content, your misuse of the Service/);
  assert.doesNotMatch(
    terms,
    /arising out of your content, your use of the Service/,
  );
  const arbitrationNotice = terms.indexOf(
    "IMPORTANT ARBITRATION, CLASS ACTION, AND JURY-TRIAL NOTICE",
  );
  assert.ok(arbitrationNotice >= 0);
  assert.ok(arbitrationNotice < terms.indexOf("1. Who may use the Service"));

  const workflow = readFileSync(".github/workflows/build.yml", "utf8");
  assert.match(workflow, /node --test tests\/legal-pages\.test\.mjs/);
});
