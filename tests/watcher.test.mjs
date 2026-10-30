import { createNavigation } from "../game/navigation.js";
import { createInitialState } from "../game/config.js";
import test from "node:test";
import assert from "node:assert/strict";
import { createWatcher, WATCHER, watcherThreat } from "../game/watcher.js";
import { createSimulation } from "../game/simulation.js";
function fixture() {
  const player = { x: 2200, y: 1600, moving: false },
    m = {
      x: 2240,
      y: 1600,
      warning: 0,
      phase: "waking",
      phaseTime: 0,
      path: [],
      windup: 0,
    };
  const result = { health: 100, hits: [], events: [], clear: true };
  const safe = (p) => Math.hypot(p.x - 1600, p.y - 1600) < 210;
  const nav = {
    nearestGround: (x, y) => ({ x, y }),
    clearSegment: () => result.clear,
  };
  const ai = createWatcher({
    player,
    nav,
    accessible: () => true,
    isSafe: safe,
    safeRadius: () => 210,
    emit: (type, e) => result.events.push([type, e]),
    hurt: (damage, source) => {
      result.health = Math.max(0, result.health - damage);
      result.hits.push(source);
    },
    damage: 40,
    windupSeconds: 1.2,
  });
  function tick(seconds) {
    for (let i = 0; i < Math.round(seconds * 20); i++) ai.tick(0.05, m, 132);
  }
  function until(phase) {
    for (let i = 0; i < 100 && m.phase !== phase; i++) tick(0.05);
    assert.equal(m.phase, phase);
  }
  return { player, m, result, ai, tick, until };
}
test("detection pauses before chase; locked strike can be dodged and recovery cannot track or hit", () => {
  const f = fixture();
  f.until("notice");
  f.tick(0.5);
  assert.equal(f.m.phase, "notice");
  assert.equal(f.result.health, 100);
  f.until("windup");
  const area = { ...f.m.attack };
  f.player.x += 140;
  f.tick(0.5);
  assert.deepEqual(f.m.attack, area);
  assert.equal(f.m.goal, null);
  f.until("strike");
  assert.equal(f.result.health, 100);
  assert.equal(
    f.result.events.find(([t]) => t === "watcher-strike")[1].hit,
    false,
  );
  f.until("recover");
  f.tick(1);
  assert.equal(f.m.phase, "recover");
  assert.equal(f.m.goal, null);
});
test("standing in three announced attacks is lethal; watcher remains unkillable", () => {
  const f = fixture();
  for (let i = 0; i < 400 && f.result.health > 0; i++) f.tick(0.05);
  assert.equal(f.result.health, 0);
  assert.deepEqual(f.result.hits, ["watcher", "watcher", "watcher"]);
  const g = createSimulation({ regional: true });
  g.state.worldTime = 299.99;
  g.update(0.02);
  assert.equal(g.survival.hit("watcher", 99999), false);
  assert.ok(g.survival.monster.invulnerable);
});
test("entering camp light cancels a nearly completed strike immediately", () => {
  const f = fixture();
  f.until("windup");
  f.tick(1.05);
  f.player.x = 1600;
  f.player.y = 1700;
  f.tick(0.05);
  assert.equal(f.m.phase, "repelled");
  assert.equal(f.m.attack, null);
  assert.equal(f.m.windup, 0);
  f.tick(5);
  assert.equal(f.result.health, 100);
  assert.equal(
    f.result.events.filter(
      ([type, e]) => type === "watcher-state" && e.phase === "repelled",
    ).length,
    1,
  );
});
test("loss of sight leads to search at the last known point, not the hidden player position", () => {
  const f = fixture();
  f.until("chase");
  const known = { ...f.m.lastKnown };
  f.player.x = 5000;
  f.result.clear = false;
  f.tick(WATCHER.memory + 1);
  assert.equal(f.m.phase, "search");
  assert.deepEqual(f.m.lastKnown, known);
  assert.notEqual(f.m.goal?.x, f.player.x);
});
test("chopping is heard through cover; distant or silent player is not globally tracked", () => {
  const f = fixture();
  f.m.x = 2540;
  f.result.clear = false;
  f.tick(0.3);
  assert.equal(f.m.phase, "search");
  assert.equal(f.m.lastKnown, undefined);
  f.ai.hear(f.player);
  f.tick(0.3);
  assert.deepEqual(f.m.lastKnown, { x: 2200, y: 1600 });
  assert.equal(f.m.phase, "search");
  f.player.x = 5000;
  f.tick(10);
  assert.notEqual(f.m.goal?.x, 5000);
});
test("a trunk blocks damage even if the player stays inside the painted area", () => {
  const f = fixture();
  f.until("windup");
  f.result.clear = false;
  f.until("strike");
  assert.equal(f.result.health, 100);
});
test("model pause freezes windup and noise; dawn clears all hazards", () => {
  const g = createSimulation({ regional: true });
  g.state.worldTime = 299.99;
  g.update(0.02);
  g.update(12.1);
  const p = g.nav.nearestGround(1600, 2000);
  Object.assign(g.player, p, { path: [], autoTimer: 1000 });
  Object.assign(g.survival.monster, {
    x: p.x + 40,
    y: p.y,
    path: [],
    repath: 100,
  });
  for (let i = 0; i < 100 && g.survival.monster.phase !== "windup"; i++)
    g.update(0.05);
  assert.equal(g.survival.monster.phase, "windup");
  const time = g.survival.monster.phaseTime;
  g.paused = true;
  g.update(20);
  assert.equal(g.survival.monster.phaseTime, time);
  assert.equal(g.state.health, 100);
  g.paused = false;
  g.state.worldTime = 599.99;
  g.update(0.02);
  assert.equal(g.survival.monster, null);
  assert.equal(g.state.health, 100);
});
test("threat directions and dodge instruction work without sound", () => {
  const g = createSimulation({ regional: true });
  g.state.worldTime = 299.99;
  g.update(0.02);
  g.update(12.1);
  g.player.x = 2200;
  g.player.y = 1600;
  Object.assign(g.survival.monster, {
    x: 2240,
    y: 1600,
    phase: "windup",
    phaseTime: 0.3,
  });
  assert.equal(watcherThreat(g).direction, "справа");
  assert.match(watcherThreat(g).text, /круга/);
  assert.equal(g.guide.id, "dodge");
});

test("water blocks walking but not sight; live trunks block sight and stumps do not", () => {
  const world = {
    trees: [],
    ancientTree: { x: 3000, y: 3000 },
    landmarks: [],
    waterCollision: (x, y) =>
      Math.abs(x - 2000) < 50 && Math.abs(y - 2000) < 100,
  };
  const nav = createNavigation(world, createInitialState(), {
    x: 1900,
    y: 2000,
    radius: 10,
  });
  const a = { x: 1900, y: 2000 },
    b = { x: 2100, y: 2000 };
  assert.equal(nav.clearSegment(a, b), false);
  assert.equal(nav.hasLineOfSight(a, b), true);
  world.trees.push({ x: 2000, y: 2000, hp: 4 });
  nav.rebuildObstacles();
  assert.equal(nav.hasLineOfSight(a, b), false);
  world.trees[0].hp = 0;
  nav.rebuildObstacles();
  assert.equal(nav.hasLineOfSight(a, b), true);
});

test("protected camp noises do not leave an unreachable search goal inside the light", () => {
  const f = fixture();
  f.player.x = 3000;
  f.m.x = 1850;
  f.ai.hear({ x: 1600, y: 1600 });
  f.tick(0.3);
  assert.equal(f.m.phase, "search");
  assert.equal(f.m.lastKnown, undefined);
});
