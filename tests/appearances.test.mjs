import test from "node:test";
import assert from "node:assert/strict";
import { createSimulation } from "../game/simulation.js";
import {
  HERO_APPEARANCES,
  normalizeAppearance,
  workerAppearance,
  buyerAppearance,
} from "../game/appearances.js";

test("exactly the two approved heroes are selectable and all gameplay stats remain identical", () => {
  assert.deepEqual(
    Object.values(HERO_APPEARANCES).map((a) => a.variant),
    [2, 3],
  );
  const a = createSimulation({ regional: true, appearance: "traveler" }),
    b = createSimulation({ regional: true, appearance: "woodcutter" });
  const { appearance: x, ...left } = a.state,
    { appearance: y, ...right } = b.state;
  assert.equal(x, "traveler");
  assert.equal(y, "woodcutter");
  assert.deepEqual(left, right);
  assert.deepEqual(a.player, b.player);
  assert.equal(normalizeAppearance("__proto__"), "traveler");
  assert.equal(normalizeAppearance("forged"), "traveler");
  assert.equal(normalizeAppearance(["woodcutter"]), "traveler");
});
test("helper outfits use only approved options and four buyer looks occur with both transport types", () => {
  assert.deepEqual([0, 1, 2].map(workerAppearance), [
    "worker3",
    "worker4",
    "worker3",
  ]);
  assert.deepEqual([0, 1, 2, 3].map(buyerAppearance), [
    "buyer1",
    "buyer2",
    "buyer3",
    "buyer4",
  ]);
  for (let look = 1; look <= 4; look++) {
    const ids = Array.from({ length: 8 }, (_, i) => i).filter(
      (i) => buyerAppearance(i) === `buyer${look}`,
    );
    assert.ok(ids.some((i) => i % 2 === 0));
    assert.ok(ids.some((i) => i % 2 === 1));
  }
});
