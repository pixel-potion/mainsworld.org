import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync, readFileSync} from 'node:fs';
import {test} from 'node:test';

test('publishes one concise country availability table', () => {
  execFileSync(process.execPath, ['node_modules/@docusaurus/core/bin/docusaurus.mjs', 'build'], {
    stdio: 'pipe',
  });

  const toVisibleText = (html) =>
    html
      .replace(/<[^>]+>/g, ' ')
      .replace(/&(amp|#39|quot|lt|gt|nbsp);/g, ' ')
      .replace(/\s+/g, ' ');
  const page = toVisibleText(readFileSync('build/country-availability/index.html', 'utf8'));

  assert.match(page, /Country availability/);
  assert.match(page, /Use Main.s World/);
  assert.match(page, /Orb verification/);
  assert.match(page, /Receive MAIN/);
  assert.match(page, /Swap MAIN/);
  assert.match(page, /Withdraw local currency/);
  for (const country of [
    'United States',
    'Argentina',
    'Germany',
    'Japan',
    'Nigeria',
    'Singapore',
    'Uganda',
  ]) {
    assert.match(page, new RegExp(country));
  }
  assert.doesNotMatch(page, /WhatsApp/);
  assert.equal(existsSync('build/around-the-world/uganda/index.html'), false);
});
