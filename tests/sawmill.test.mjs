import test from "node:test";
import assert from "node:assert/strict";
import { createSimulation } from "../game/simulation.js";
import { SAWMILL } from "../game/sawmill.js";
import { insideLocation } from "../game/locations.js";

function create(emit) {
  const g = createSimulation({ regional: true, survival: false, emit });
  for (const id of ["1:0", "1:1"]) {
    const gate = g.regions.frontiers().find((p) => p.region.id === id);
    Object.assign(g.player, {
      x: gate.x,
      y: gate.y,
      path: [],
      autoTimer: 10000,
    });
    g.state.maxWood = gate.region.cost;
    for (let i = 0; i < gate.region.cost; i++) g.forestry.addCargo(10);
    g.update((gate.region.cost + 1) * 0.2);
    assert.ok(g.regions.unlocked.has(id));
  }
  g.state.maxWood = 2;
  Object.assign(g.player, SAWMILL.entrance, { autoTimer: 0 });
  return g;
}
function beside(g, d, side = -1) {
  Object.assign(g.player, {
    x: d.x + side * 40,
    y: d.y,
    path: [],
    autoTimer: 0,
    clickTimer: 0,
  });
}
function length(path, start) {
  assert.ok(path.length);
  return path.reduce(
    (sum, p, i) =>
      sum +
      Math.hypot(
        p.x - (path[i - 1] || start).x,
        p.y - (path[i - 1] || start).y,
      ),
    0,
  );
}

test("sawmill reuses the field square, reserves the whole footprint and routes the map to its entrance", () => {
  const g = create();
  const region = g.regions.all.find((r) => r.id === "1:1");
  assert.equal(g.regions.all.length, 25);
  assert.equal(region.biome, "field");
  assert.equal(region.cost, 24);
  assert.equal(region.name, SAWMILL.name);
  assert.deepEqual(g.exploration.regionDestination(region), SAWMILL.entrance);
  assert.match(g.exploration.regionSummary(region.id), /0\/2/);
  for (const t of g.trees.filter((t) => t.regionId === region.id))
    assert.ok(!insideLocation(SAWMILL, t.x, t.y, 72));
  for (const p of g.world.decorBins.get(region.id))
    assert.ok(!insideLocation(SAWMILL, p.x, p.y, 32));
  assert.equal(
    g.world.landmarks.some(
      (p) => p.regionId === region.id && p.type === "camp",
    ),
    false,
  );
});

test("actual walking reaches the yard, store and machine hall with both shortcuts blocked", () => {
  const g = create();
  g.player.autoTimer = 10000;
  for (const room of SAWMILL.rooms) {
    const goal = { x: room.x + room.width / 2, y: room.y + 100 };
    g.setDestination(goal.x, goal.y);
    assert.ok(g.player.path.length, room.name);
    for (let i = 0; i < 600 && g.player.path.length; i++) g.update(0.05);
    assert.ok(
      Math.hypot(g.player.x - goal.x, g.player.y - goal.y) < 2,
      room.name,
    );
  }
  assert.deepEqual(g.state.exploration.debrisHP, {});
  for (const d of g.clearing.all) {
    assert.ok(
      !g.nav.clearSegment({ x: d.x - 48, y: d.y }, { x: d.x + 48, y: d.y }),
    );
    const body = { x: d.x - 48, y: d.y };
    g.nav.moveBody(body, 96, 0);
    assert.ok(body.x < d.x - d.r);
  }
});

test("both shortcuts clear with the starting axe and cut a long detour to a straight crossing", () => {
  const events = [],
    g = create((type, e) => events.push([type, e]));
  for (const d of g.clearing.all) {
    const a = { x: d.x - 48, y: d.y },
      b = { x: d.x + 48, y: d.y };
    const before = length(g.nav.findPath(a, b), a),
      version = g.nav.version;
    Object.assign(g.player, a, { path: [], autoTimer: 0 });
    assert.ok(g.orderClearing(d.id));
    g.update(d.maxHP * g.state.autoInterval + 0.1);
    assert.equal(g.clearing.hp(d), 0);
    assert.equal(
      g.nav.version,
      version + 1,
      "only the last hit changes topology",
    );
    assert.ok(g.nav.clearSegment(a, b));
    assert.ok(length(g.nav.findPath(a, b), a) < before / 3);
    assert.equal(g.tryClear(d.id), false);
    assert.equal(g.orderClearing(d.id), false);
  }
  assert.equal(events.filter(([type]) => type === "debris-cleared").length, 2);
  assert.match(g.exploration.regionSummary("1:1"), /2\/2/);
  assert.equal(g.state.coins, 0, "clearing drops wood, never instant money");
});

test("a distant tap routes around walls and starts automatic clearing on arrival", () => {
  const g = create(),
    d = g.clearing.all[1];
  assert.ok(g.orderClearing(d.id));
  assert.ok(g.player.path.length);
  assert.equal(g.tryClear(d.id), false);
  for (let i = 0; i < 800 && g.clearing.hp(d); i++) g.update(0.05);
  assert.equal(g.clearing.hp(d), 0);
  assert.ok(g.nav.isWalkable(g.player.x, g.player.y));
});

test("full hands never block clearing; extra wood waits, sells at its exact value and never regenerates", () => {
  const g = create(),
    d = g.clearing.all[0];
  g.forestry.addCargo(10);
  g.forestry.addCargo(15);
  beside(g, d);
  assert.ok(g.orderClearing(d.id));
  g.update(6);
  assert.equal(g.clearing.hp(d), 0);
  assert.deepEqual(g.state.cargo, [10, 15]);
  assert.equal(g.forestry.piles.get(d.id).count, 3);
  g.forestry.takeCargo();
  g.forestry.takeCargo();
  g.update(0.4);
  assert.deepEqual(g.state.cargo, [8, 8]);
  assert.equal(g.forestry.piles.get(d.id).count, 1);
  while (!g.activeBuyer() && g.state.worldTime < 150) g.update(1);
  assert.ok(g.activeBuyer());
  Object.assign(g.player, g.sale, { path: [] });
  g.update(0.5);
  assert.equal(g.state.coins, 16);
  assert.equal(g.state.wood, 0);
  beside(g, d);
  g.update(0.4);
  assert.deepEqual(g.state.cargo, [8]);
  assert.equal(g.forestry.piles.size, 0);
  g.forestry.updateGrowth(g.trees, g.dayNumber + 4);
  g.nav.rebuildObstacles();
  assert.equal(g.orderClearing(d.id), false);
  assert.equal(g.tryClear(d.id), false);
  assert.equal(g.clearing.hp(d), 0);
  const fresh = create();
  assert.deepEqual(fresh.state.exploration.debrisHP, {});
  assert.equal(fresh.clearing.hp(d), d.maxHP);
  assert.equal(fresh.forestry.piles.size, 0);
});

test("damage obeys pause, death, range, region access, visibility and shared strike timers", () => {
  const locked = createSimulation({ regional: true, survival: false }),
    d = locked.clearing.all[0];
  beside(locked, d);
  assert.equal(locked.orderClearing(d.id), false);
  assert.equal(locked.tryClear(d.id), false);
  const g = create();
  assert.equal(g.tryClear(d.id), false);
  beside(g, d);
  g.paused = true;
  assert.equal(g.orderClearing(d.id), false);
  assert.equal(g.tryClear(d.id), false);
  g.paused = false;
  g.state.gameOver = true;
  assert.equal(g.tryClear(d.id), false);
  g.state.gameOver = false;
  assert.equal(g.tryClear(d.id, "invalid"), false);
  assert.equal(g.tryClear("missing"), false);
  // A real solid tree between the feet and debris prevents a hit through it.
  const blocker = { id: "test-blocker", x: d.x - 27, y: d.y + 3, hp: 4 };
  g.trees.push(blocker);
  g.nav.rebuildObstacles();
  assert.equal(g.tryClear(d.id), false);
  g.trees.pop();
  g.nav.rebuildObstacles();
  assert.ok(g.tryClear(d.id));
  assert.equal(g.clearing.hp(d), d.maxHP - 1);
  assert.equal(g.tryClear(d.id), false);
  assert.equal(g.player.clickTimer, g.state.clickInterval);
  g.player.autoTimer = 1;
  assert.equal(g.tryClear(d.id, "auto"), false);
  assert.equal(g.clearing.hp(d), d.maxHP - 1);
  g.update(0);
  assert.equal(g.clearing.hp(d), d.maxHP - 1);
});

test("movement, another destination and pause cancel a clearing order without resetting damage", () => {
  for (const cancel of [
    (g) => g.keys.add("KeyD"),
    (g) => g.setDestination(g.player.x, g.player.y + 90),
    (g) => {
      g.paused = true;
    },
  ]) {
    const g = create(),
      d = g.clearing.all[1];
    beside(g, d);
    assert.ok(g.orderClearing(d.id));
    assert.ok(g.tryClear(d.id));
    const hp = g.clearing.hp(d);
    cancel(g);
    g.update(0.05);
    assert.equal(g.clearingOrder, null);
    assert.equal(g.clearing.hp(d), hp);
    assert.equal(g.forestry.piles.size, 0);
    g.nav.rebuildObstacles();
    assert.equal(g.clearing.hp(d), hp);
  }
});
