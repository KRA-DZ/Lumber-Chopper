import test from "node:test";
import assert from "node:assert/strict";
import { createSimulation } from "../game/simulation.js";
import { REGION_SIZE, REGIONS } from "../game/regions.js";
const create = () => createSimulation({ regional: true });
function open(g, id) {
  const gate = g.regions.frontiers().find((p) => p.region.id === id);
  assert.ok(gate);
  Object.assign(g.player, { x: gate.x, y: gate.y, path: [], autoTimer: 1000 });
  g.state.maxWood = gate.region.cost;
  for (let i = 0; i < gate.region.cost; i++) g.forestry.addCargo(10);
  for (let i = 0; i < gate.region.cost + 1; i++) g.update(0.2);
  assert.ok(g.regions.unlocked.has(id));
}
test("regional world starts with one whole square, four neighbours and lazy deterministic trees", () => {
  const a = create(),
    b = create();
  assert.equal(REGION_SIZE, 1920);
  assert.equal(REGIONS.length, 25);
  assert.deepEqual(a.state.unlockedRegions, ["0:0"]);
  assert.equal(a.regions.frontiers().length, 4);
  assert.ok(a.trees.length > 70 && a.trees.length < 150);
  assert.deepEqual(a.trees, b.trees);
  assert.equal(a.world.decorBins.size, 1);
  assert.ok(a.nav.isWalkable(700, 1600));
  assert.ok(!a.nav.isWalkable(600, 1600));
  assert.ok(!a.treeAccessible({ x: 3000, y: 1600 }));
  assert.ok(!a.accessible(a.world.ancientTree));
  assert.ok(!a.accessible(a.world.pond));
});
test("a border project keeps partial payments, consumes exactly the cost and adds a full connected tile", () => {
  const events = [],
    g = createSimulation({
      regional: true,
      emit: (type, e) => events.push([type, e]),
    }),
    initial = g.trees.length,
    gate = g.regions.frontiers().find((p) => p.region.id === "1:0");
  Object.assign(g.player, { x: gate.x, y: gate.y, path: [] });
  g.forestry.addCargo(10);
  g.update(0);
  assert.equal(g.state.regionWood["1:0"], undefined);
  g.paused = true;
  g.update(5);
  assert.equal(g.state.wood, 1);
  g.paused = false;
  g.update(0.2);
  assert.equal(g.state.regionWood["1:0"], 1);
  assert.equal(g.state.wood, 0);
  assert.ok(!g.nav.isWalkable(2600, 1600));
  for (let i = 0; i < 11; i++) {
    g.forestry.addCargo(10);
    g.update(0.2);
  }
  assert.ok(g.regions.unlocked.has("1:0"));
  assert.equal(g.state.regionWood["1:0"], 12);
  assert.ok(g.trees.length >= initial + 90);
  assert.equal(g.world.decorBins.size, 2);
  assert.ok(g.nav.isWalkable(2600, 1600));
  assert.ok(g.accessible(g.world.ancientTree));
  assert.equal(events.filter((e) => e[0] === "region-open").length, 1);
  assert.equal(g.state.cargoValue, 0);
  const count = g.trees.length;
  g.update(1);
  assert.equal(g.trees.length, count);
  assert.equal(g.regions.deposit("1:0"), null);
  assert.equal(g.regions.deposit("2:2"), null);
});
test("camp stages improve buildings without opening regions, and tutorial follows real actions", () => {
  const g = create(),
    t = g.trees.find((t) => t.type === "oak" && t.size === 2);
  assert.equal(g.tutorialStep, 0);
  while (t.hp > 0) g.hitTree(t);
  assert.equal(g.tutorialStep, 1);
  for (let i = 0; i < 220; i++) g.update(0.1);
  Object.assign(g.player, { x: g.sale.x, y: g.sale.y, path: [] });
  g.forestry.addCargo(10);
  g.update(0.2);
  assert.equal(g.tutorialStep, 2);
  g.state.carryLevel = 1;
  assert.equal(g.tutorialStep, 3);
  for (const cost of [10, 20, 35, 50]) {
    g.state.maxWood = cost;
    while (g.state.wood) g.forestry.takeCargo();
    for (let i = 0; i < cost; i++) g.forestry.addCargo(10);
    Object.assign(g.player, { x: g.build.x, y: g.build.y, path: [] });
    for (let i = 0; i < cost + 1; i++) g.update(0.2);
  }
  assert.equal(g.state.campLevel, 4);
  assert.equal(g.state.unlockedRegions.length, 1);
});
test("all 25 squares can be opened, seams and negative-coordinate routes stay navigable", () => {
  const g = create();
  while (g.regions.unlocked.size < 25) {
    const id = g.regions.frontiers()[0].region.id;
    open(g, id);
  }
  assert.equal(g.world.decorBins.size, 25);
  assert.ok(g.trees.length > 2200 && g.trees.length < 3600);
  assert.ok(g.accessible(g.world.merchant));
  assert.ok(g.accessible(g.world.pond));
  assert.ok(!g.nav.isWalkable(g.world.pond.x, g.world.pond.y));
  const start = g.nav.nearestGround(-2000, -1500),
    goal = g.nav.nearestGround(-2200, -1800),
    path = g.nav.findPath(start, goal);
  assert.ok(path.length);
  let last = start;
  for (const p of path) {
    assert.ok(g.nav.clearSegment(last, p));
    last = p;
  }
  assert.ok(Math.hypot(last.x - goal.x, last.y - goal.y) < 1);
  assert.ok(!g.nav.isWalkable(-3300, 1600));
});
