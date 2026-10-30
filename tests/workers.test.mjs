import test from "node:test";
import assert from "node:assert/strict";
import { createSimulation } from "../game/simulation.js";
import { createWorkers, WORKERS } from "../game/workers.js";
import { createInitialState } from "../game/config.js";

function create(emit = () => {}) {
  return createSimulation({ regional: true, survival: false, emit });
}
function ready(g) {
  g.state.campLevel = 2;
  g.nav.rebuildObstacles();
  const gate = g.regions.frontiers().find((g) => g.region.id === "1:0");
  Object.assign(g.player, { x: gate.x, y: gate.y, path: [], autoTimer: 1000 });
  g.state.maxWood = 12;
  for (let i = 0; i < 12; i++) g.forestry.addCargo(10);
  g.update(2.5);
  assert.ok(g.regions.unlocked.has("1:0"));
  Object.assign(g.player, { x: 1600, y: 1720, path: [] });
  g.state.coins = 150;
}
function until(g, predicate, seconds = 90) {
  for (let i = 0; i < seconds * 20 && !predicate(); i++) g.update(0.05);
  assert.ok(
    predicate(),
    JSON.stringify({ time: g.state.worldTime, crew: g.workers.crew }),
  );
}

test("hiring validates camp, opened oak, daylight, location, funds, cap; chapter progression is independent", () => {
  const g = create(),
    w = g.workers;
  g.state.coins = 1000;
  assert.equal(w.hire(), false);
  ready(g);
  assert.equal(g.state.story.phase, 0);
  g.state.coins = 149;
  assert.equal(w.hire(), false);
  g.state.coins = 150;
  g.player.x = 2000;
  assert.equal(w.hire(), false);
  g.player.x = 1600;
  g.state.worldTime = 240;
  assert.equal(w.hire(), false);
  g.state.worldTime = 120;
  g.paused = true;
  assert.ok(w.hire()); // Like the shop, an inspected paused menu may transact.
  assert.equal(g.state.coins, 0);
  g.state.coins = 1100;
  assert.ok(w.hire());
  assert.ok(w.hire());
  assert.equal(g.state.coins, 0);
  g.state.coins = 9999;
  assert.equal(w.hire(), false);
  assert.equal(w.crew.length, WORKERS.max);
  assert.equal(g.state.story.phase, 0);
});

test("real outbound, chopping, loaded return, warehouse and customer sale conserve wood and coins", () => {
  const events = [],
    g = create((t, e) => events.push([t, e]));
  ready(g);
  const w = g.workers,
    ancient = JSON.stringify(g.world.ancientTree),
    treeHP = g.trees.map((t) => t.hp);
  assert.ok(w.hire());
  until(g, () => w.crew[0].phase === "cutting");
  assert.ok(Math.hypot(w.crew[0].x - 3520, w.crew[0].y - 1600) < 160);
  assert.ok(g.nav.isWalkable(w.crew[0].x, w.crew[0].y));
  until(g, () => w.crew[0].cargo.length === 4);
  assert.equal(g.state.workforce.stock.length, 0);
  until(g, () => g.state.workforce.delivered >= 4);
  until(g, () => g.state.workforce.earned >= 32);
  assert.equal(JSON.stringify(g.world.ancientTree), ancient);
  assert.deepEqual(
    g.trees.map((t) => t.hp),
    treeHP,
  );
  assert.equal(g.state.coins, g.state.workforce.earned);
  assert.equal(
    g.state.workforce.delivered,
    g.state.workforce.stock.length + g.state.workforce.earned / 8,
  );
  assert.equal(g.state.wood, 0);
  assert.equal(g.tryChop(g.world.ancientTree.id), false);
  assert.ok(events.some(([t]) => t === "worker-chopped"));
});

test("stock reserve, withdrawals, exact value and stack capacity are atomic and do not duplicate resources", () => {
  const g = create();
  ready(g);
  const w = g.workers;
  w.hire();
  w.setAutoSell(false);
  until(g, () => w.data.stock.length >= 4);
  assert.equal(w.data.earned, 0);
  g.state.maxWood = 2;
  g.player.x = 2000;
  assert.equal(w.withdraw(), false);
  g.player.x = 1600;
  g.paused = true;
  assert.ok(w.withdraw());
  assert.ok(w.withdraw());
  assert.equal(w.withdraw(), false);
  assert.equal(g.state.wood, 2);
  assert.equal(g.state.cargoValue, 16);
  assert.equal(w.data.stock.length, 2);
  assert.equal(g.forestry.takeCargo(), 8);
  assert.ok(w.withdraw());
  assert.equal(w.data.stock.length + g.state.wood, 3);
  g.state.gameOver = true;
  assert.equal(w.withdraw(), false);
  assert.equal(w.hire(), false);
  assert.equal(w.upgrade(), false);
  assert.equal(w.setAutoSell(true), false);
  assert.equal(w.setRecalled(true), false);
});

test("team upgrades have finite escalating costs, affect future hires and leave player upgrades unchanged", () => {
  const g = create();
  ready(g);
  const w = g.workers;
  assert.equal(w.upgrade(), false);
  w.hire();
  g.state.coins = 199;
  assert.equal(w.upgrade(), false);
  g.state.coins = 1050;
  assert.ok(w.upgrade());
  assert.ok(w.upgrade());
  assert.equal(w.capacity(), 8);
  assert.equal(w.speed(), 170);
  assert.equal(w.chopSeconds(), 1.7);
  assert.equal(w.upgrade(), false);
  assert.ok(w.hire());
  assert.equal(g.state.coins, 0);
  assert.equal(g.state.axePower, 1);
  assert.equal(g.state.runSpeed, 200);
  assert.equal(w.data.level, 2);
});

test("recall preserves cargo, returns to light before night and resumes work after dawn", () => {
  const g = create();
  ready(g);
  const w = g.workers;
  w.hire();
  w.setAutoSell(false);
  until(g, () => w.crew[0].cargo.length >= 1);
  const npc = w.crew[0],
    before = w.data.delivered + npc.cargo.length;
  g.state.worldTime = 239.99;
  until(g, () => npc.phase === "resting", 45);
  assert.ok(g.state.worldTime < 300);
  assert.ok(Math.hypot(npc.x - 1600, npc.y - 1600) < 310);
  assert.ok(w.data.delivered >= before);
  const delivered = w.data.delivered;
  g.state.worldTime = 350;
  g.update(40);
  assert.equal(w.data.delivered, delivered);
  assert.equal(npc.phase, "resting");
  g.state.worldTime = 599.99;
  g.update(0.02);
  until(g, () => npc.phase === "cutting", 45);
});

test("manual recall, full stock, pause and scene reset bound the simulation", () => {
  const g = create();
  ready(g);
  const w = g.workers;
  w.hire();
  assert.equal(w.setRecalled("yes"), false);
  assert.ok(w.setRecalled(true));
  g.update(1);
  assert.equal(w.crew[0].phase, "resting");
  assert.ok(w.setRecalled(false));
  w.setAutoSell(false);
  w.data.stock.push(...Array(30).fill(8));
  g.update(5);
  assert.equal(w.crew[0].phase, "waiting");
  assert.equal(w.crew[0].cargo.length, 0);
  assert.equal(w.data.stock.length, 30);
  g.paused = true;
  const snapshot = JSON.stringify(w.data),
    time = g.state.worldTime;
  g.update(120);
  assert.equal(JSON.stringify(w.data), snapshot);
  assert.equal(g.state.worldTime, time);
  const fresh = create();
  assert.equal(fresh.workers.crew.length, 0);
  assert.equal(fresh.workers.data.stock.length, 0);
  assert.equal(fresh.workers.data.level, 0);
});

function fixture() {
  const state = createInitialState();
  state.campLevel = 2;
  state.coins = 10000;
  const player = { x: 1710, y: 1780 },
    buyer = { load: 0, capacity: 5 },
    searches = [],
    threats = { raiders: [], monster: null };
  let now = 0,
    blocked = false,
    version = 1;
  const nav = {
    nearestGround: (x, y) => ({ x, y }),
    hasLineOfSight: () => true,
    findPath: (w, p) => {
      searches.push({ id: w.id, now });
      return blocked ? [] : [p];
    },
    followPath(w, dt, speed) {
      const p = w.path[0];
      if (!p) return 0;
      const d = Math.hypot(p.x - w.x, p.y - w.y),
        m = Math.min(d, dt * speed);
      w.x += ((p.x - w.x) * m) / d;
      w.y += ((p.y - w.y) * m) / d;
      if (d <= m) w.path.shift();
      return m;
    },
    get version() {
      return version;
    },
  };
  const system = createWorkers({
    state,
    player,
    regions: { isOpen: () => true },
    world: { ancientTree: { x: 3520, y: 1600 } },
    nav,
    forestry: { addCargo: () => false },
    sale: { x: 1420, y: 1690, radius: 53 },
    activeBuyer: () => (buyer.load < buyer.capacity ? buyer : null),
    getSurvival: () => threats,
  });
  return {
    state,
    player,
    buyer,
    system,
    searches,
    threats,
    block() {
      blocked = true;
      version++;
    },
    step(seconds) {
      for (let i = 0; i < seconds * 20; i++) {
        now += 0.05;
        system.update(0.05);
      }
    },
  };
}

test("automation respects customer capacities, stock limits and the player's sale priority", () => {
  const f = fixture(),
    w = f.system;
  w.hire();
  w.setRecalled(true);
  w.data.stock.push(...Array(30).fill(8));
  f.buyer.load = 4;
  f.step(10);
  assert.equal(f.buyer.load, 5);
  assert.equal(w.data.earned, 8);
  assert.equal(w.data.stock.length, 29);
  f.buyer.capacity = 15;
  f.step(10);
  assert.equal(f.buyer.load, 15);
  assert.equal(w.data.earned, 88);
  f.buyer.load = 0;
  Object.assign(f.player, { x: 1420, y: 1690 });
  f.state.wood = 1;
  f.step(3);
  assert.equal(f.buyer.load, 0);
  f.state.wood = 0;
  f.step(1);
  assert.ok(f.buyer.load > 0);
});

test("three workers share a timed fair path budget; blocked routes retry slowly without producing remotely", () => {
  const f = fixture();
  for (let i = 0; i < 3; i++) f.system.hire();
  f.block();
  f.step(12);
  assert.equal(new Set(f.searches.map((s) => s.id)).size, 3);
  assert.ok(f.searches.length <= 15);
  for (let i = 1; i < f.searches.length; i++)
    assert.ok(f.searches[i].now - f.searches[i - 1].now >= 0.299);
  assert.ok(
    f.system.crew.every((w) => w.cargo.length === 0 && w.phase === "blocked"),
  );
  assert.equal(f.system.data.delivered, 0);
});

test("nearby danger triggers return and keeps work stopped until the danger memory expires", () => {
  const f = fixture();
  f.system.hire();
  f.step(20);
  const w = f.system.crew[0];
  assert.equal(w.phase, "cutting");
  f.threats.monster = { x: w.x + 10, y: w.y };
  f.step(0.1);
  assert.equal(w.phase, "delivery");
  f.threats.monster = null;
  const load = w.cargo.length;
  f.step(3);
  assert.equal(w.cargo.length, load);
  assert.notEqual(w.phase, "cutting");
});

test("a fallback ground point at camp never turns into remote oak production", () => {
  const state = createInitialState();
  state.campLevel = 2;
  state.coins = 150;
  const nav = {
    version: 1,
    nearestGround: () => ({ x: 1710, y: 1780 }),
    hasLineOfSight: () => true,
    findPath: () => [],
    followPath: () => 0,
  };
  const system = createWorkers({
    state,
    player: { x: 1710, y: 1780 },
    world: { ancientTree: { x: 3520, y: 1600 } },
    regions: { isOpen: () => true },
    nav,
    forestry: { addCargo: () => false },
    activeBuyer: () => null,
    sale: { x: 1420, y: 1690, radius: 53 },
    getSurvival: () => null,
  });
  assert.ok(system.hire());
  for (let i = 0; i < 200; i++) system.update(0.05);
  assert.equal(system.crew[0].phase, "blocked");
  assert.equal(system.crew[0].cargo.length, 0);
});

test("three upgraded workers retain walkable paths through every camp stage and never exceed storage", () => {
  for (const stage of [2, 3, 4]) {
    const g = create();
    ready(g);
    g.state.campLevel = stage;
    g.nav.rebuildObstacles();
    const w = g.workers;
    g.state.coins = 10000;
    for (let i = 0; i < 3; i++) assert.ok(w.hire());
    w.upgrade();
    w.upgrade();
    w.setAutoSell(false);
    let invalid = false;
    for (let i = 0; i < 105 * 20; i++) {
      g.update(0.05);
      invalid ||= w.crew.some((n) => !g.nav.isWalkable(n.x, n.y));
      assert.ok(w.data.stock.length <= 30);
      assert.ok(w.crew.every((n) => n.cargo.length <= 8));
    }
    assert.equal(invalid, false, `camp ${stage}`);
    assert.ok(w.data.delivered >= 24, `camp ${stage}`);
    assert.equal(w.data.stock.length, 30);
    assert.equal(w.data.earned, 0);
  }
});
