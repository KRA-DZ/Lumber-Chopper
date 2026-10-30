import test from "node:test";
import assert from "node:assert/strict";
import { createSimulation } from "../game/simulation.js";
import { createCycleManager } from "../game/cycle.js";
import { createInitialState } from "../game/config.js";
import { applyUpgrades } from "../economy.js";
import { createSurvival } from "../game/survival.js";
import { stackOffset } from "../game/stack-layout.js";
const create = (survival = false, emit = () => {}) =>
  createSimulation({ regional: true, survival, emit });
function beginNight(g, night = 1) {
  g.state.calendarDay = night - 1;
  g.state.worldTime = 299.99;
  g.update(0.02);
}
function outside(g) {
  const p = g.nav.nearestGround(2050, 1600);
  Object.assign(g.player, p, { path: [], autoTimer: 1000 });
  Object.assign(g.survival.monster, {
    x: p.x + 40,
    y: p.y,
    path: [],
    repath: 100,
  });
}
test("chop commands reject remote, forged, paused and repeated strikes; active bonus remains separate", () => {
  const g = create(),
    t = g.trees[0],
    hp = t.hp;
  assert.equal(g.tryChop(t.id), false);
  assert.equal(g.hitTree({ ...t, id: "fake" }), false);
  Object.assign(g.player, { x: t.x + 58, y: t.y });
  g.paused = true;
  assert.equal(g.tryChop(t.id), false);
  g.paused = false;
  assert.equal(g.tryChop(t.id), true);
  assert.equal(g.tryChop(t.id), false);
  assert.equal(t.hp, hp - 1);
  if (t.hp > 0) assert.equal(g.tryChop(t.id, "auto"), true);
});
test("model purchases apply boots immediately and invalid purchases leave state unchanged", () => {
  const g = create();
  assert.equal(g.purchaseUpgrade("boots"), false);
  g.state.coins = 90;
  assert.equal(g.purchaseUpgrade("boots"), true);
  assert.equal(g.player.speed, 216);
  assert.equal(g.state.runSpeed, 216);
  assert.equal(g.state.coins, 0);
  assert.equal(g.purchaseUpgrade("missing"), false);
});
test("regional economic loop earns a real carry purchase and preserves exact resource value", () => {
  const g = create(),
    t = g.trees.find((t) => t.size === 2 && t.type === "oak");
  Object.assign(g.player, { x: t.x + 58, y: t.y, path: [] });
  for (let n = 0; t.hp > 0 && n < 100; n++) {
    g.tryChop(t.id);
    g.update(0.2);
  }
  g.update(1);
  assert.equal(g.state.wood, 2);
  assert.equal(g.forestry.piles.get(t.id).count, 1);
  Object.assign(g.player, { x: g.sale.x, y: g.sale.y, path: [] });
  g.update(30);
  assert.equal(g.state.coins, 20);
  assert.equal(g.state.cargoValue, 0);
  assert.ok(g.purchaseUpgrade("carry"));
  assert.equal(g.state.maxWood, 4);
});
test("public transfers reject wrong target, distance, empty cargo and repeated same-tick debits", () => {
  const g = create();
  const gate = g.regions.frontiers()[0];
  assert.equal(g.transferOneLog(gate.region.id), false);
  g.forestry.addCargo(12);
  assert.equal(g.transferOneLog(gate.region.id), false);
  Object.assign(g.player, { x: gate.x, y: gate.y, path: [] });
  assert.equal(g.transferOneLog("sell"), false);
  assert.equal(g.transferOneLog(gate.region.id), true);
  assert.equal(g.state.regionWood[gate.region.id], 1);
  assert.equal(g.state.cargoValue, 0);
  g.forestry.addCargo(15);
  assert.equal(g.transferOneLog(gate.region.id), false);
  assert.equal(g.state.cargoValue, 15);
});
test("all 82 stack slots have distinct bounded positions and retain capacity limits", () => {
  const g = create();
  g.state.carryLevel = 40;
  applyUpgrades(g.state);
  for (let i = 0; i < 100; i++) g.forestry.addCargo(10);
  assert.equal(g.state.cargo.length, 82);
  assert.equal(g.state.cargoValue, 820);
  const slots = Array.from({ length: 82 }, (_, i) => stackOffset(i, 82));
  assert.equal(new Set(slots.map((p) => `${p.x}:${p.y}`)).size, 82);
  assert.ok(slots.every((p) => Math.abs(p.x) <= 44 && p.y >= -247));
});
test("cycle emits each edge once including a large delta and counts nights only at dawn", () => {
  const s = createInitialState(),
    events = [],
    cycle = createCycleManager(s, (type, e) => events.push([type, e]));
  cycle.update(180);
  assert.equal(events.filter(([type]) => type === "night-started").length, 1);
  assert.equal(s.nightsSurvived, 0);
  cycle.update(0);
  assert.equal(events.length, 3);
  cycle.update(300);
  assert.equal(s.nightsSurvived, 1);
  assert.equal(s.calendarDay, 1);
  cycle.update(1200);
  assert.equal(s.nightsSurvived, 3);
  assert.deepEqual(
    events.filter(([type]) => type !== "sunset-warning").map((e) => e[0]),
    [
      "night-started",
      "day-started",
      "night-started",
      "day-started",
      "night-started",
      "day-started",
    ],
  );
});
test("night waves only schedule on nights 5, 10, 15; actors are capped", () => {
  for (let night = 1; night <= 15; night++) {
    const g = create(true);
    beginNight(g, night);
    assert.equal(g.survival.pending, night % 5 === 0 ? 2 + night / 5 : 0);
    assert.ok(g.survival.monster?.invulnerable);
  }
  const g = create(true);
  beginNight(g, 100);
  g.update(12.1);
  assert.ok(g.survival.raiders.length > 0 && g.survival.raiders.length <= 8);
});
test("watcher cannot be killed, telegraphs damage, respects pause and can cause defeat", () => {
  const g = create(true);
  beginNight(g);
  g.update(12.1);
  outside(g);
  const m = g.survival.monster;
  assert.equal(g.tryAttack(m.id), false);
  assert.ok(m.invulnerable);
  g.update(0.5);
  assert.equal(g.state.health, 100);
  g.paused = true;
  g.update(20);
  assert.equal(g.state.health, 100);
  g.paused = false;
  g.update(10);
  assert.equal(g.state.health, 0);
  assert.ok(g.state.gameOver);
  const time = g.state.worldTime;
  assert.equal(g.tryChop(g.trees[0].id), false);
  g.paused = false;
  g.update(600);
  assert.equal(g.state.worldTime, time);
});
test("camp light protects the player; dawn removes all enemies and restores health", () => {
  const g = create(true);
  beginNight(g);
  g.update(12.1);
  Object.assign(g.player, { x: 1600, y: 1720, path: [] });
  Object.assign(g.survival.monster, { x: 1600, y: 1760, path: [] });
  g.update(20);
  assert.equal(g.state.health, 100);
  g.state.health = 60;
  g.state.worldTime = 599.99;
  g.update(0.02);
  assert.equal(g.state.health, 100);
  assert.equal(g.survival.monster, null);
  assert.equal(g.survival.raiders.length, 0);
  assert.equal(g.state.nightsSurvived, 1);
});
test("raiders damage the camp; build pad repairs before consuming logs for construction", () => {
  const g = create(true);
  beginNight(g, 5);
  g.update(12.1);
  assert.ok(g.survival.raiders.length);
  Object.assign(g.player, { x: 2150, y: 1720, path: [], autoTimer: 1000 });
  const r = g.survival.raiders[0];
  Object.assign(r, { x: 1600, y: 1540, path: [], repath: 100 });
  g.update(1.1);
  assert.ok(g.state.campHealth < 200);
  Object.assign(g.player, { x: g.build.x, y: g.build.y, path: [] });
  g.forestry.addCargo(10);
  const build = g.state.buildWood;
  assert.equal(g.transferOneLog("build"), true);
  assert.equal(g.state.campHealth, 200);
  assert.equal(g.state.buildWood, build);
});
test("raiders can be killed by guarded axe commands without rewarding duplicate deaths", () => {
  const g = create(true);
  beginNight(g, 5);
  g.update(12.1);
  const r = g.survival.raiders[0];
  const p = g.nav.nearestGround(1950, 1600);
  Object.assign(r, p, { path: [], repath: 100 });
  Object.assign(g.player, { x: p.x + 40, y: p.y, path: [], autoTimer: 1000 });
  assert.equal(g.tryAttack(r.id), true);
  assert.equal(g.tryAttack(r.id), false);
  for (let i = 0; i < 10 && g.survival.raiders.includes(r); i++) {
    g.update(0.2);
    g.tryAttack(r.id);
  }
  assert.ok(!g.survival.raiders.includes(r));
  assert.equal(g.tryAttack(r.id), false);
});
test("letters unlock at dawn and journal rewards can only be claimed once", () => {
  const events = [],
    g = create(false, (type, e) => events.push([type, e]));
  beginNight(g);
  g.state.worldTime = 599.99;
  g.update(0.02);
  assert.deepEqual(g.state.unlockedLetters, ["first-dawn"]);
  assert.equal(g.lore.claim("warm-dawn"), false);
  g.state.campLevel = 1;
  assert.ok(g.lore.claim("warm-dawn"));
  assert.equal(g.state.coins, 20);
  assert.equal(g.lore.claim("warm-dawn"), false);
  g.lore.onDawn();
  assert.equal(events.filter((e) => e[0] === "letter-received").length, 1);
  g.lore.read({ id: "note" });
  g.lore.read({ id: "note" });
  assert.deepEqual(g.state.readClues, ["note"]);
});

test("path search budget rotates fairly across all nine enemies", () => {
  const state = createInitialState(),
    seen = new Set(),
    player = { x: 2500, y: 2500 };
  const nav = {
    nearestGround: (x, y) => ({ x, y }),
    clearSegment: () => true,
    findPath: (a) => {
      seen.add(a.id);
      return [];
    },
    followPath: () => 0,
  };
  const director = createSurvival({
    state,
    player,
    nav,
    accessible: () => true,
    emit: () => {},
    defeat: () => {},
  });
  director.nightStarted({ night: 100 });
  for (let i = 0; i < 400; i++) director.update(0.05);
  assert.equal(director.raiders.length, 8);
  assert.equal(seen.size, 9);
});
