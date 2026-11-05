import { test } from "node:test";
import assert from "node:assert/strict";
import {
  stageRatio,
  fencePlan,
  partialFence,
  constructionCollisionKey,
  STAGE_COSTS,
} from "../construction.js";
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
