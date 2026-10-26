import { test } from "node:test";
import assert from "node:assert/strict";
import { createSimulation } from "../game/simulation.js";
import { buyUpgrade } from "../economy.js";
import { growthStage } from "../forestry.js";
const step = (g, n, dt = 0.1) => {
  for (let i = 0; i < n; i++) g.update(dt);
};
test("engine-independent simulation completes harvest, exact sale and first earned upgrade", () => {
  const events = [],
    g = createSimulation({ emit: (type, e) => events.push([type, e]) }),
    t = g.trees.find(
      (t) =>
        t.size === 2 &&
        t.type === "oak" &&
        g.treeAccessible(t) &&
        g.nav.isWalkable(t.x + 46, t.y + 38),
    );
  Object.assign(g.player, { x: t.x + 46, y: t.y + 38 });
  while (t.hp > 0) g.hitTree(t);
  assert.equal(g.forestry.piles.get(t.id).count, 3);
  step(g, 10);
  assert.equal(g.state.wood, 2);
  assert.equal(g.forestry.piles.get(t.id).count, 1);
  step(g, 220);
  assert.equal(g.activeBuyer().capacity, 5);
  Object.assign(g.player, { x: g.sale.x, y: g.sale.y });
  step(g, 6);
  assert.equal(g.state.coins, 20);
  assert.equal(g.state.wood, 0);
  assert.ok(events.some(([type]) => type === "transfer"));
  assert.equal(buyUpgrade(g.state, "carry"), true);
  assert.equal(g.state.maxWood, 4);
  assert.equal(g.state.coins, 0);
  Object.assign(g.player, { x: t.x + 46, y: t.y + 38 });
  step(g, 3);
  assert.equal(g.state.wood, 1);
  assert.equal(g.forestry.piles.size, 0);
});
test("all camp stages preserve paths, linked fences and trigger one expansion each", () => {
  const expansion = [],
    g = createSimulation({
      emit: (type, e) => {
        if (type === "expansion") expansion.push(e);
      },
    });
  for (const [i, cost] of [10, 20, 35, 50].entries()) {
    g.state.maxWood = cost;
    for (let n = 0; n < cost; n++) g.forestry.addCargo(10);
    Object.assign(g.player, { x: g.build.x, y: g.build.y, path: [] });
    step(g, cost * 3 + 5);
    assert.equal(g.state.campLevel, i + 1);
    assert.equal(g.state.cargoValue, 0);
    g.setDestination(1600, 1810);
    step(g, 150, 0.03);
    assert.ok(Math.hypot(g.player.x - 1600, g.player.y - 1810) < 3);
  }
  assert.deepEqual(
    expansion.map((e) => e.to),
    [1040, 1180, 1320, 1450],
  );
  assert.ok(
    g.nav
      .campFenceSegments()
      .every(([a, b]) => !g.nav.isWalkable((a.x + b.x) / 2, (a.y + b.y) / 2)),
  );
  assert.ok(g.nav.isWalkable(630, 1400));
  assert.ok(!g.nav.isWalkable(560, 1390));
});
test("paused and zero-time updates cannot spend cargo or progress the calendar", () => {
  const g = createSimulation();
  g.forestry.addCargo(10);
  Object.assign(g.player, { x: g.build.x, y: g.build.y });
  const time = g.state.worldTime;
  g.update(0);
  assert.equal(g.state.wood, 1);
  g.paused = true;
  g.update(600);
  assert.equal(g.state.worldTime, time);
  assert.equal(g.state.wood, 1);
  g.paused = false;
  g.update(0.1);
  assert.equal(g.state.buildWood, 1);
  assert.equal(g.state.wood, 0);
});
test("calendar regrowth restores colliders and safely displaces a player on the stump", () => {
  const g = createSimulation(),
    t = g.trees.find((t) => g.treeAccessible(t));
  while (t.hp > 0) g.hitTree(t);
  g.player.autoTimer = 1000;
  for (let day = 1; day <= 3; day++) {
    if (day === 3) Object.assign(g.player, { x: t.x, y: t.y, path: [] });
    g.state.worldTime = 599.99;
    g.update(0.02);
    assert.equal(g.dayNumber, day);
    assert.equal(growthStage(t, g.dayNumber), day);
  }
  assert.equal(t.hp, t.maxHp);
  assert.ok(!g.nav.isWalkable(t.x, t.y));
  assert.ok(g.nav.isWalkable(g.player.x, g.player.y));
});
