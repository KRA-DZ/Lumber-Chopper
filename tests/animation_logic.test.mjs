import { test } from "node:test";
import assert from "node:assert/strict";
import {
  stageRatio,
  fencePlan,
  partialFence,
  constructionCollisionKey,
  STAGE_COSTS,
} from "../construction.js";
import { createEffects, EFFECT_LIMITS } from "../effects.js";
import { createEnvironment, ENVIRONMENT_LIMITS } from "../environment.js";

test("partial fence grows through connected sections and keeps the entrance open", () => {
  const plan = fencePlan();
  let previous = 0;
  for (let paid = 0; paid < STAGE_COSTS[2]; paid++) {
    const state = { campLevel: 2, buildWood: paid },
      part = partialFence(state, plan),
      ids = new Set(part.posts.map((p) => p.id));
    assert.ok(part.posts.length >= previous);
    previous = part.posts.length;
    assert.ok(part.segments.every(([a, b]) => ids.has(a.id) && ids.has(b.id)));
    assert.ok(part.posts.every((p) => p.y <= 1600 + 235 * 0.65));
  }
  assert.deepEqual(partialFence({ campLevel: 3, buildWood: 0 }, plan), plan);
  assert.equal(stageRatio({ campLevel: 3, buildWood: 25 }), 0.5);
  assert.equal(
    constructionCollisionKey({ campLevel: 3, buildWood: 5 }, plan),
    constructionCollisionKey({ campLevel: 3, buildWood: 25 }, plan),
  );
});

test("log flights track moving endpoints and never change the supplied inventory", () => {
  const effects = createEffects({}),
    player = { x: 100, y: 100 },
    inventory = { wood: 1, cargoValue: 12, coins: 0 };
  effects.pickup({ x: 0, y: 0 }, 0);
  assert.equal(effects.cargoHidden(0), true);
  effects.update(0, player, inventory.wood);
  assert.equal(effects.logs[0].age, 0);
  effects.update(0.4, player, inventory.wood);
  assert.ok(effects.logs[0].x > 0 && effects.logs[0].x < 100);
  effects.update(0.5, player, inventory.wood);
  assert.equal(effects.logs.length, 0);
  assert.equal(effects.cargoHidden(0), false);
  const buyer = { x: 200, y: 200 };
  effects.transfer(
    "sell",
    { x: 100, y: 100 },
    { follow: buyer, dx: 44, dy: -30 },
  );
  effects.update(0.25, player, 1);
  const before = effects.logs[0].x;
  buyer.x = 300;
  effects.update(0.1, player, 1);
  assert.ok(effects.logs[0].x > before);
  effects.update(1, player, 1);
  assert.equal(effects.logs.length, 0);
  assert.deepEqual(inventory, { wood: 1, cargoValue: 12, coins: 0 });
});

test("effect pools are capped and clean up after animations", () => {
  const effects = createEffects({}),
    player = { x: 0, y: 0 };
  for (let i = 0; i < 100; i++) {
    effects.pickup({ x: i, y: 0 }, i);
    effects.complete({ x: i, y: 0 });
  }
  assert.equal(effects.logs.length, EFFECT_LIMITS.logs);
  assert.equal(effects.dust.length, EFFECT_LIMITS.dust);
  assert.ok(effects.bursts.length <= 3);
  effects.update(3, player, 100);
  assert.equal(
    effects.logs.length + effects.dust.length + effects.bursts.length,
    0,
  );
});

test("ambient leaves remain bounded and stop appearing after nearby trees are cut", () => {
  const environment = createEnvironment({}),
    trees = [
      { x: 0, y: 0, hp: 4, type: "oak" },
      { x: 40, y: 10, hp: 3, type: "birch" },
    ],
    player = { x: 0, y: 0 };
  environment.update(0, 0, trees, player);
  assert.equal(environment.leaves.length, 0);
  for (let i = 0; i < 1000; i++)
    environment.update(0.1, i * 0.1, trees, player);
  assert.ok(
    environment.leaves.length > 0 &&
      environment.leaves.length <= ENVIRONMENT_LIMITS.leaves,
  );
  assert.deepEqual(
    trees.map((t) => t.hp),
    [4, 3],
  );
  trees.forEach((t) => (t.hp = 0));
  for (let i = 0; i < 100; i++)
    environment.update(0.1, 100 + i * 0.1, trees, player);
  assert.equal(environment.leaves.length, 0);
});
