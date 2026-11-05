import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";

test("the canonical page starts Phaser directly and the old URL is only a compatibility redirect", async () => {
  const root = new URL("../", import.meta.url);
  const html = await readFile(new URL("index.html", root), "utf8");
  assert.match(html, /src="\.\/phaser\/main\.js"/);
  assert.doesNotMatch(html, /lumberGame|data-legacy-link|art=procedural/);
  const alias = await readFile(new URL("phaser.html", root), "utf8");
  assert.match(alias, /location\.replace/);
  assert.match(alias, /location\.search \+ location\.hash/);
  assert.doesNotMatch(alias, /new Phaser|<canvas|type="module"/);
});

test("every local Phaser runtime import resolves without the removed renderer modules", async () => {
  const root = new URL("../", import.meta.url),
    seen = new Set();
  async function visit(url) {
    if (seen.has(url.href)) return;
    seen.add(url.href);
    await access(url);
    const code = await readFile(url, "utf8");
    for (const [, name] of code.matchAll(
      /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)["']([^"']+)["']/g,
    ))
      if (name.startsWith(".")) await visit(new URL(name, url));
  }
  await visit(new URL("phaser/main.js", root));
  for (const name of ["terrain.js", "effects.js", "expansion.js"])
    assert.ok(!seen.has(new URL(name, root).href));
  assert.ok(seen.has(new URL("forestry.js", root).href));
  assert.ok(seen.has(new URL("economy.js", root).href));
});
