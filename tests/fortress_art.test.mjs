import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FORTRESS } from "../game/locations.js";
import { fortressParts, fortressClueKey } from "../phaser/fortress-assets.js";
import { createFortressFloorSampler } from "../phaser/fortress-floor.js";

test("modular fortress resolves every piece to PNG, keeps the two gate footprints and stays bounded", () => {
  const m = JSON.parse(
    readFileSync(
      new URL("../src/assets/fortress/manifest.json", import.meta.url),
    ),
  );
  const parts = fortressParts(FORTRESS);
  assert.ok(parts.length < 180);
  assert.equal(new Set(parts.map((p) => p.id)).size, parts.length);
  for (const p of parts) {
    assert.ok(m.frames[p.key.replace("fortress.", "")], p.key);
    assert.ok(
      p.x >= FORTRESS.bounds.x &&
        p.x <= FORTRESS.bounds.x + FORTRESS.bounds.width,
    );
    assert.ok(
      p.y >= FORTRESS.bounds.y &&
        p.y <= FORTRESS.bounds.y + FORTRESS.bounds.height,
    );
  }
  const gates = parts.filter((p) => p.drawOpened);
  assert.equal(gates.length, 2);
  for (const gate of gates) {
    const wall = FORTRESS.walls.find((w) => w.passage === gate.passage);
    assert.equal(gate.x, (wall.a.x + wall.b.x) / 2);
    assert.equal(gate.y, (wall.a.y + wall.b.y) / 2);
    assert.ok(m.frames[gate.openKey.replace("fortress.", "")]);
  }
  assert.ok(parts.some((p) => p.key.startsWith("fortress.corner.")));
});

test("floor selection is local, uses world coordinates including negative Y and leaves comparison unchanged", () => {
  assert.equal(createFortressFloorSampler(null, [FORTRESS]), null);
  const floors = Object.fromEntries(
    ["courtyard", "room", "archive"].map((name, k) => {
      const data = new Uint8ClampedArray(64 * 64 * 4);
      for (let y = 0; y < 64; y++)
        for (let x = 0; x < 64; x++)
          data.set([x, y, k + 1, 255], (y * 64 + x) * 4);
      return [name, data];
    }),
  );
  const sample = createFortressFloorSampler(
    { manifest: { regionId: "0:-1" }, floors },
    [FORTRESS],
  );
  assert.equal(sample(1600, 1600, 0), null);
  assert.equal(sample(FORTRESS.bounds.x, 0, 23), null);
  assert.deepEqual(sample(1600, -200, 0), [32, 28, 1]);
  assert.deepEqual(sample(1552, -736, 0), [8, 16, 2]);
  assert.deepEqual(sample(2000, -700, 0), [40, 34, 3]);
  assert.deepEqual(sample(1168, -600, 0), [8, 20, 2]);
});

test("only fortress notes get the new burned-paper textures", () => {
  const assets = { fortress: { manifest: { regionId: "0:-1" } } };
  assert.equal(
    fortressClueKey(assets, { id: "ruins-note", regionId: "0:-1" }),
    "fortress.diary",
  );
  assert.equal(
    fortressClueKey(assets, { id: "fortress-ledger", regionId: "0:-1" }),
    "fortress.note",
  );
  assert.equal(fortressClueKey(assets, { id: "note" }), "world.note");
  assert.equal(fortressClueKey({}, FORTRESS.clues[0]), "world.note");
});
