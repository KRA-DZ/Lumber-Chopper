import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SAWMILL } from "../game/sawmill.js";
import {
  sawmillParts,
  sawmillClueKey,
  sawmillSiteKey,
  sawmillDressingKey,
} from "../phaser/sawmill-assets.js";
import { createFortressFloorSampler } from "../phaser/fortress-floor.js";

test("workshop modules resolve to approved PNGs without closing either door or moving the interaction sites", () => {
  const m = JSON.parse(
    readFileSync(
      new URL("../src/assets/sawmill/manifest.json", import.meta.url),
    ),
  );
  assert.equal(m.approvedVariant, 1);
  const parts = sawmillParts(SAWMILL);
  assert.ok(parts.length < 180);
  assert.equal(new Set(parts.map((p) => p.id)).size, parts.length);
  for (const p of parts)
    assert.ok(m.frames[p.key.replace("sawmill.", "")], p.key);
  for (const s of SAWMILL.sites)
    assert.ok(m.frames[sawmillSiteKey(s).replace("sawmill.", "")]);
  for (const p of SAWMILL.dressing)
    assert.ok(m.frames[sawmillDressingKey(p).replace("sawmill.", "")]);
  const roofs = parts.filter((p) => p.roofCover);
  assert.equal(roofs.length, 2);
  for (const roof of roofs) {
    const b = roof.roofCover;
    assert.ok(
      b.width < 500 && b.height < 400,
      "only northern canopy fades, not a whole room",
    );
    assert.ok(roof.depth > roof.y);
  }
  const niche = SAWMILL.sites.find((s) => s.kind === "discovery");
  const closed = parts.find((p) => p.untilPassage),
    empty = parts.find((p) => p.afterDiscovery);
  assert.equal(closed.untilPassage, niche.requiredPassage);
  assert.equal(empty.afterDiscovery, niche.id);
  for (const p of [closed, empty])
    assert.deepEqual([p.x, p.y], [niche.x, niche.y]);
});

test("only sawmill papers use these PNGs, including when the art pack is absent", () => {
  const assets = { sawmill: { manifest: { regionId: SAWMILL.regionId } } };
  assert.equal(sawmillClueKey(assets, SAWMILL.clues[0]), "sawmill.note");
  assert.equal(sawmillClueKey(assets, SAWMILL.clues[1]), "sawmill.ledger");
  assert.equal(
    sawmillClueKey(assets, { id: "fortress-ledger", regionId: "0:-1" }),
    null,
  );
  assert.equal(sawmillClueKey({}, { id: "note" }), null);
  assert.equal(sawmillClueKey({}, SAWMILL.clues[0]), null);
});

test("yard, storage and machine floors use periodic world coordinates with soft pixel edges", () => {
  const floors = Object.fromEntries(
    ["courtyard", "room", "hall"].map((name, i) => {
      const data = new Uint8ClampedArray(64 * 64 * 4);
      for (let y = 0; y < 64; y++)
        for (let x = 0; x < 64; x++)
          data.set([x, y, i + 1, 255], (y * 64 + x) * 4);
      return [name, data];
    }),
  );
  const sample = createFortressFloorSampler(
    { manifest: { regionId: "1:1" }, floors },
    [SAWMILL],
    (r) => (r.name === "Машинный зал" ? "hall" : "room"),
  );
  assert.equal(sample(1600, 1600, 0), null);
  assert.equal(sample(SAWMILL.bounds.x, SAWMILL.bounds.y, 23), null);
  for (const [x, y, expected] of [
    [3520, 3500, 1],
    [3104, 3200, 2],
    [3952, 3200, 3],
  ]) {
    const rgb = sample(x, y, 0);
    assert.equal(rgb[2], expected);
    assert.deepEqual(sample(x + 128, y, 0), rgb);
  }
});
