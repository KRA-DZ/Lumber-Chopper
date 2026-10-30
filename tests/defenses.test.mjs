import test from "node:test";
import assert from "node:assert/strict";
import { createSimulation } from "../game/simulation.js";
import { createSurvival } from "../game/survival.js";
import { createInitialState, CENTER } from "../game/config.js";
const create = (emit) => createSimulation({ regional: true, emit });
function night(g, n = 5) {
  g.state.calendarDay = n - 1;
  g.state.worldTime = 299.99;
  g.update(0.02);
  g.update(12.1);
  g.player.autoTimer = 1000;
}
function build(g, level = 3) {
  g.state.campLevel = level;
  g.nav.rebuildObstacles();
}
function cargo(g, count) {
  g.state.maxWood = 82;
  for (let i = 0; i < count; i++) g.forestry.addCargo(11);
}
function near(g, d) {
  Object.assign(g.player, g.nav.nearestGround(d.x, d.y + 44), { path: [] });
}

test("a broken fence opens a physical gap; exact repair spends one log and safely closes it", () => {
  const g = create();
  build(g);
  const d = g.defenses.all().find((s) => s.kind === "fence" && s.a.id === 0);
  assert.equal(g.nav.isWalkable(d.x, d.y), false);
  const version = g.nav.version;
  assert.ok(g.defenses.damage(d.id, 60));
  assert.ok(g.nav.version > version);
  assert.ok(g.nav.isWalkable(d.x, d.y));
  cargo(g, 1);
  Object.assign(g.player, { x: d.x, y: d.y, path: [] });
  assert.ok(g.transferOneLog(d.id));
  assert.equal(g.defenses.get(d.id).hp, 20);
  assert.equal(g.state.wood, 0);
  assert.equal(g.state.cargoValue, 0);
  assert.equal(g.nav.isWalkable(d.x, d.y), false);
  assert.ok(g.nav.isWalkable(g.player.x, g.player.y));
  assert.equal(g.transferOneLog(d.id), false);
});

test("defense commands reject locked sites, remote or paused payments and do not consume other platform cargo", () => {
  const g = create();
  cargo(g, 8);
  assert.equal(g.orderDefense("trap-left"), false);
  build(g, 2);
  assert.equal(g.transferOneLog("barricade-left"), false);
  g.paused = true;
  assert.equal(g.orderDefense("trap-left"), false);
  g.paused = false;
  const d = g.defenses.get("trap-left");
  near(g, d);
  g.paused = true;
  assert.equal(g.transferOneLog(d.id), false);
  g.paused = false;
  assert.ok(g.transferOneLog(d.id));
  assert.equal(g.defenses.get(d.id).wood, 1);
  assert.equal(g.state.wood, 7);
  assert.equal(g.transferOneLog(d.id), false);
  g.update(0.31); // No selected work order, so the second payment is explicit.
  assert.ok(g.transferOneLog(d.id));
  assert.equal(g.defenses.get(d.id).hp, 1);
  assert.equal(g.state.wood, 6);
  assert.equal(g.state.cargoValue, 66);
  g.update(0.31);
  assert.equal(g.transferOneLog(d.id), false);
  Object.assign(g.player, g.build, { path: [] });
  assert.ok(g.orderDefense("barricade-left"));
  assert.equal(g.transferOneLog(), false);
  assert.equal(g.state.buildWood, 0);
  g.setDestination(g.player.x, g.player.y);
  assert.equal(g.defenseOrder, null);
});

test("three-log barricades preserve the central entrance and can be repaired without rebuilding", () => {
  const g = create();
  build(g, 2);
  cargo(g, 8);
  for (const id of ["barricade-left", "barricade-right"]) {
    const d = g.defenses.get(id);
    near(g, d);
    assert.ok(g.orderDefense(id));
    g.update(1);
    assert.equal(g.defenses.get(id).hp, 60);
    assert.equal(g.defenseOrder, null);
    assert.equal(g.nav.isWalkable(d.x, d.y), false);
  }
  assert.equal(g.state.wood, 2);
  assert.ok(g.nav.clearSegment({ x: 1600, y: 2000 }, { x: 1600, y: 1750 }));
  const d = g.defenses.get("barricade-right");
  g.defenses.damage(d.id, 24);
  near(g, d);
  assert.ok(g.orderDefense(d.id));
  g.update(0.31);
  assert.equal(g.defenses.get(d.id).hp, 56);
  assert.equal(g.state.wood, 1);
});

test("a trap is nonblocking, fires once, slows a survivor and needs two new logs to rearm", () => {
  const g = create();
  build(g, 2);
  const d = g.defenses.get("trap-left");
  near(g, d);
  cargo(g, 2);
  g.orderDefense(d.id);
  g.update(0.65);
  assert.equal(g.defenses.get(d.id).hp, 1);
  assert.ok(g.nav.isWalkable(d.x, d.y));
  night(g);
  const r = g.survival.raiders.find((a) => a.role === "breaker");
  Object.assign(g.player, { x: 1600, y: 1720, path: [] });
  Object.assign(r, { x: d.x, y: d.y, path: [], repath: 100 });
  const hp = r.hp;
  g.update(0.05);
  assert.equal(r.hp, hp - 3);
  assert.ok(r.slow > 0);
  assert.equal(g.defenses.get(d.id).hp, 0);
  assert.equal(g.defenses.get(d.id).wood, 0);
  g.update(0.2);
  assert.equal(r.hp, hp - 3);
  assert.equal(g.survival.monster.invulnerable, true);
  // Rearming is a new two-log purchase, not a free reset after consumption.
  g.state.worldTime = 599.99;
  g.update(0.02);
  near(g, d);
  cargo(g, 2);
  assert.ok(g.orderDefense(d.id));
  g.update(0.65);
  assert.equal(g.defenses.get(d.id).hp, 1);
  assert.equal(g.state.wood, 0);
});

test("breaker breaches a fence then advances into camp rather than dismantling the entire perimeter", () => {
  const g = create();
  build(g);
  night(g);
  const r = g.survival.raiders.find((a) => a.role === "breaker");
  const d = g.defenses.all().find((s) => s.kind === "fence" && s.a.id === 0);
  const dx = d.x - CENTER.x,
    dy = d.y - CENTER.y,
    l = Math.hypot(dx, dy);
  Object.assign(
    r,
    g.nav.nearestGround(d.x + (dx / l) * 40, d.y + (dy / l) * 40),
    { path: [], repath: 0 },
  );
  Object.assign(g.player, { x: 1600, y: 1720, path: [], autoTimer: 1000 });
  // Isolate the breaker without mutating its behavior or the real navigation.
  for (const a of [...g.survival.raiders])
    if (a !== r) g.survival.hit(a.id, 100);
  g.update(10);
  assert.equal(g.defenses.get(d.id).hp, 0);
  g.update(5);
  assert.ok(Math.hypot(r.x - CENTER.x, r.y - CENTER.y) < 190);
  assert.equal(
    g.defenses.all().filter((s) => s.kind === "fence" && s.hp === 0).length,
    1,
  );
});

test("focus prefers the clicked reachable enemy, knocks back without crossing walls and clears on movement", () => {
  const g = create();
  night(g);
  const [a, b] = g.survival.raiders;
  Object.assign(g.player, { x: 1600, y: 1720, path: [], autoTimer: 0 });
  Object.assign(a, { x: 1620, y: 1720, path: [], repath: 100 });
  Object.assign(b, { x: 1640, y: 1720, path: [], repath: 100 });
  assert.ok(g.selectEnemy(b.id));
  const ahp = a.hp,
    bhp = b.hp;
  g.update(0.01);
  assert.equal(a.hp, ahp);
  assert.equal(b.hp, bhp - 1);
  assert.ok(b.x > 1640);
  assert.ok(b.stun > 0);
  assert.ok(g.nav.isWalkable(b.x, b.y));
  g.setDestination(1600, 1720);
  assert.equal(g.selectedEnemyId, null);
  assert.equal(g.selectEnemy("watcher"), false);
  g.paused = true;
  assert.equal(g.selectEnemy(a.id), false);
});

// Controlled navigation isolates bookkeeping from path timing; the real-navigation cases above cover collision.
function director() {
  const state = createInitialState(),
    events = [],
    player = { x: 2500, y: 2500 };
  const nav = {
    nearestGround: (x, y) => ({ x, y }),
    clearSegment: () => true,
    findPath: () => [],
    followPath: () => 0,
  };
  const d = createSurvival({
    state,
    player,
    nav,
    accessible: () => true,
    emit: (t, e) => events.push([t, e]),
    defeat: () => {},
  });
  d.nightStarted({ night: 5 });
  d.update(12.1);
  return { d, state, events };
}
test("raid reward is paid exactly once, grows with difficulty and dawn does not grant an unfinished reward", () => {
  const { d, state, events } = director();
  assert.deepEqual(
    d.raiders.map((r) => r.role),
    ["attacker", "thief", "breaker"],
  );
  const ids = d.raiders.map((r) => r.id);
  for (const id of ids) assert.ok(d.hit(id, 100));
  assert.equal(d.wave.status, "won");
  assert.equal(state.coins, 60);
  assert.equal(state.raidsWon, 1);
  assert.equal(d.hit(ids[0], 100), false);
  d.update(20);
  d.dawn();
  assert.equal(state.coins, 60);
  assert.equal(events.filter(([t]) => t === "wave-ended").length, 1);
  d.nightStarted({ night: 10 });
  d.update(12.1);
  for (const r of [...d.raiders]) d.hit(r.id, 100);
  assert.equal(state.coins, 140);
  assert.equal(state.raidsWon, 2);
  d.nightStarted({ night: 15 });
  d.update(12.1);
  d.hit(d.raiders[0].id, 100);
  d.dawn();
  assert.equal(d.wave.status, "withdrawn");
  assert.equal(state.coins, 140);
});
test("thieves steal at most available coins, return them on defeat, and escape reduces wave reward", () => {
  const { d, state } = director();
  state.coins = 9;
  const thief = d.raiders.find((r) => r.role === "thief");
  Object.assign(thief, { x: 1600, y: 1540 });
  d.update(1.3);
  assert.equal(state.coins, 0);
  assert.equal(thief.stolen, 9);
  assert.ok(thief.fleeing);
  d.hit(thief.id, 100);
  assert.equal(state.coins, 9);
  for (const r of [...d.raiders]) d.hit(r.id, 100);
  assert.equal(state.coins, 69);
  const q = director(),
    t = q.d.raiders.find((r) => r.role === "thief");
  q.state.coins = 30;
  Object.assign(t, { x: 1600, y: 1540 });
  q.d.update(1.3);
  assert.equal(q.state.coins, 15);
  Object.assign(t, t.home);
  q.d.update(0.1);
  assert.equal(q.d.wave.escaped, 1);
  for (const r of [...q.d.raiders]) q.d.hit(r.id, 100);
  assert.equal(q.d.wave.status, "escaped");
  assert.equal(q.d.wave.reward, 40);
  assert.equal(q.state.coins, 55);
  assert.equal(q.state.raidsWon, 0);
});

test("a repair order resumes its route after a modal pause and never spends while paused", () => {
  const g = create();
  build(g, 2);
  cargo(g, 3);
  assert.ok(g.orderDefense("barricade-left"));
  g.paused = true;
  g.update(5);
  assert.equal(g.state.wood, 3);
  assert.equal(g.defenses.get("barricade-left").wood, 0);
  g.paused = false;
  g.update(10);
  assert.equal(g.defenses.get("barricade-left").hp, 60);
  assert.equal(g.state.wood, 0);
});
test("axe knockback respects the base of a solid building", () => {
  const g = create();
  night(g);
  // Shop occupies x1340..1500, y1588..1620. Push into its southern edge.
  const r = g.survival.raiders[0];
  Object.assign(r, { x: 1450, y: 1631, path: [], repath: 100 });
  Object.assign(g.player, { x: 1450, y: 1671, path: [], autoTimer: 1000 });
  assert.ok(g.nav.isWalkable(r.x, r.y));
  assert.ok(g.tryAttack(r.id));
  assert.ok(g.nav.isWalkable(r.x, r.y));
  assert.ok(r.y >= 1630);
});

test("an upgraded axe and actual focus pursuit can repel the first full wave without scripted damage", () => {
  const g = create();
  build(g);
  g.state.axePower = 2;
  g.state.autoInterval = 0.8;
  night(g);
  g.player.autoTimer = 0;
  for (
    let i = 0;
    i < 1200 && !g.state.gameOver && g.survival.wave.status === "active";
    i++
  ) {
    if (!g.selectedEnemyId) {
      const nearest = [...g.survival.raiders].sort(
        (a, b) =>
          Math.hypot(a.x - g.player.x, a.y - g.player.y) -
          Math.hypot(b.x - g.player.x, b.y - g.player.y),
      )[0];
      if (nearest) assert.ok(g.selectEnemy(nearest.id));
    }
    g.update(0.05);
  }
  assert.equal(g.state.gameOver, false);
  assert.equal(g.survival.wave.status, "won");
  assert.equal(g.survival.wave.killed, 3);
  assert.equal(g.state.coins, 60);
  assert.equal(g.state.raidsWon, 1);
});

test("sunset does not cancel an in-progress defense construction order", () => {
  const g = create();
  build(g, 2);
  cargo(g, 3);
  assert.ok(g.orderDefense("barricade-left"));
  g.state.worldTime = 299.99;
  g.update(10);
  assert.ok(g.cycle.isNight);
  assert.equal(g.defenses.get("barricade-left").hp, 60);
  assert.equal(g.state.wood, 0);
  assert.equal(g.defenseOrder, null);
});
