import test from "node:test";
import assert from "node:assert/strict";
import { BIOMES } from "../game/biomes.js";
import { REGIONS, regionAt } from "../game/regions.js";
import { biomeWeights, sampleMaterial } from "../game/biome-terrain.js";
import { createBiomeEnemies, BIOME_ENEMIES } from "../game/biome-enemies.js";
import { createInitialState } from "../game/config.js";
import { createSimulation } from "../game/simulation.js";
const ids = {
  forest: "1:0",
  field: "1:1",
  swamp: "0:1",
  shore: "-1:0",
  web: "2:1",
  ruins: "0:-1",
};
function fixture(biome = "forest") {
  const state = createInitialState(),
    region = REGIONS.find((r) => r.id === ids[biome]);
  state.worldTime = 301;
  const player = { x: region.cx, y: region.cy },
    events = [],
    damage = [];
  const regions = { all: REGIONS, unlocked: new Set([region.id]) };
  let searches = 0;
  const nav = {
    version: 1,
    nearestGround: (x, y) => ({ x, y }),
    isWalkable: () => true,
    hasLineOfSight: () => true,
    clearSegment: () => true,
    findPath: (a, b) => {
      searches++;
      return [{ x: b.x, y: b.y }];
    },
    moveBody: (b, x, y) => {
      b.x += x;
      b.y += y;
    },
    followPath(b, dt, speed) {
      const p = b.path[0];
      if (!p) return 0;
      const d = Math.hypot(p.x - b.x, p.y - b.y),
        s = Math.min(d, dt * speed);
      if (!d) {
        b.path = [];
        return 0;
      }
      b.x += ((p.x - b.x) * s) / d;
      b.y += ((p.y - b.y) * s) / d;
      if (d <= s) b.path.shift();
      return s;
    },
  };
  const model = createBiomeEnemies({
    state,
    player,
    regions,
    nav,
    isSafe: (p) => Math.hypot(p.x - 1600, p.y - 1600) < 310,
    hurtPlayer: (...args) => damage.push(args),
    emit: (...args) => events.push(args),
  });
  return {
    state,
    player,
    regions,
    region,
    model,
    nav,
    damage,
    events,
    get searches() {
      return searches;
    },
    step(seconds) {
      for (let i = 0; i < seconds * 20; i++) model.update(0.05);
    },
  };
}
test("six biome families follow the selected collage and retain all activity locations", () => {
  assert.deepEqual(
    Object.values(BIOMES).map((b) => b.enemy),
    ["wood", "doll", "cosmic", "drowned", "spider", "masked"],
  );
  for (const [biome, id] of Object.entries(ids))
    assert.equal(REGIONS.find((r) => r.id === id).biome, biome);
  assert.equal(REGIONS.find((r) => r.id === "0:1").activity, "mystery");
  assert.equal(REGIONS.find((r) => r.id === "0:-1").activity, "ruins");
});
test("global biome weights sum to one, are continuous at seams/corners and deterministic in negative coordinates", () => {
  for (let x = -3200; x < 6400; x += 137)
    for (let y = -3200; y < 6400; y += 313) {
      const w = biomeWeights(x, y);
      assert.ok(
        Math.abs(Object.values(w).reduce((a, b) => a + b, 0) - 1) < 1e-9,
      );
      assert.ok(Object.keys(w).every((k) => BIOMES[k]));
      assert.deepEqual(w, biomeWeights(x, y));
      const next = biomeWeights(x + 0.01, y + 0.01);
      for (const k of Object.keys(BIOMES))
        assert.ok(Math.abs((w[k] || 0) - (next[k] || 0)) < 0.001);
    }
  assert.ok(Object.keys(biomeWeights(1600, 2560)).length > 1);
  const pixels = new Uint8ClampedArray(64 * 64 * 4);
  pixels.set([1, 2, 3, 255], (63 * 64 + 63) * 4);
  assert.deepEqual(
    sampleMaterial({ forest: pixels }, "forest", -1, -1),
    [1, 2, 3],
  );
});
test("every family spawns only at night in opened home territory, capped and away from player", () => {
  for (const biome of Object.keys(ids)) {
    const f = fixture(biome);
    f.state.worldTime = 120;
    f.step(3);
    assert.equal(f.model.actors.length, 0);
    f.state.worldTime = 301;
    f.step(0.05);
    assert.equal(f.model.actors.length, 2);
    for (const e of f.model.actors) {
      assert.equal(e.family, BIOMES[biome].enemy);
      assert.equal(regionAt(e.x, e.y).id, f.region.id);
      assert.ok(Math.hypot(e.x - f.player.x, e.y - f.player.y) > 330);
    }
    f.state.worldTime = 0;
    f.step(0.05);
    assert.equal(f.model.actors.length, 0);
  }
});
test("patrol and pursuit never cross home border, even after player leaves and when navigation takes a detour", () => {
  const f = fixture("field");
  f.step(10);
  const e = f.model.actors[0];
  Object.assign(f.player, { x: e.x + 100, y: e.y });
  f.step(2);
  assert.equal(e.phase, "chase");
  f.player.x = f.region.x - 1;
  f.step(35);
  assert.ok(
    f.model.actors.every((e) => regionAt(e.x, e.y)?.id === f.region.id),
  );
  f.nav.findPath = () => [
    { x: f.region.x - 100, y: f.region.cy },
    { x: e.x + 60, y: e.y },
  ];
  e.path = [];
  e.repath = 0;
  f.step(3);
  assert.ok(e.path.length === 0);
});
test("a telegraphed local attack can be dodged, damages with shared player cooldown hook and never attacks buildings", () => {
  const f = fixture();
  f.step(4);
  const e = f.model.actors[0];
  Object.assign(f.player, { x: e.x + 30, y: e.y });
  f.step(0.1);
  assert.ok(e.attack);
  f.player.x += 150;
  f.step(1.2);
  assert.equal(f.damage.length, 0);
  Object.assign(f.player, { x: e.x + 30, y: e.y });
  f.step(4);
  assert.ok(f.damage.length > 0);
  assert.deepEqual(f.damage[0], [12, "resident"]);
  assert.equal(f.state.campHealth, 200);
});
test("defeated residents do not respawn until a new night or grant wave rewards", () => {
  const f = fixture();
  f.step(4);
  const e = f.model.actors[0];
  assert.ok(f.model.hit(e.id, 100));
  assert.equal(f.model.hit(e.id, 100), false);
  f.step(10);
  assert.ok(!f.model.actors.some((a) => a.id === e.id));
  assert.equal(f.state.coins, 0);
  f.state.worldTime = 0;
  f.step(0.05);
  f.state.calendarDay++;
  f.state.worldTime = 301;
  f.step(0.05);
  assert.equal(f.model.actors.length, 2);
  f.state.gameOver = true;
  const snap = JSON.stringify(f.model.actors);
  f.step(3);
  assert.equal(JSON.stringify(f.model.actors), snap);
});
test("regional mini-bosses withstand repeated axe hits and retain damage between scans", () => {
  for (const biome of Object.keys(ids)) {
    const f = fixture(biome);
    f.step(4);
    const e = f.model.actors[0];
    assert.equal(e.maxHP, 40);
    for (let i = 0; i < 4; i++) assert.ok(f.model.hit(e.id, 9, false));
    assert.equal(e.hp, 4);
    f.step(3);
    assert.ok(f.model.actors.includes(e));
    assert.equal(e.hp, 4);
    for (let i = 0; i < 3; i++) assert.ok(f.model.hit(e.id, 1, false));
    assert.equal(e.hp, 1);
    assert.ok(f.model.hit(e.id, 1, false));
    assert.ok(!f.model.actors.includes(e));
    assert.equal(
      f.events.filter(([type]) => type === "enemy-defeated").length,
      1,
    );
  }
});
test("local enemies are bounded separately from every-fifth-night camp waves; pause freezes the whole system", () => {
  const g = createSimulation({ regional: true });
  for (const r of REGIONS) {
    g.regions.unlocked.add(r.id);
    g.world.generate(r);
  }
  g.nav.rebuildObstacles();
  g.state.worldTime = 299.99;
  Object.assign(g.player, { x: 3500, y: 1800, autoTimer: 1000 });
  g.update(0.02);
  assert.ok(g.survival.monster?.invulnerable);
  assert.equal(g.survival.raiders.length, 0);
  assert.ok(
    g.survival.residents.length > 0 &&
      g.survival.residents.length <= BIOME_ENEMIES.max,
  );
  g.paused = true;
  const snap = JSON.stringify(g.survival.residents);
  g.update(60);
  assert.equal(JSON.stringify(g.survival.residents), snap);
  g.paused = false;
  g.state.worldTime = 599.99;
  g.update(0.02);
  assert.equal(g.survival.residents.length, 0);
});

test("player selection and guarded axe commands damage residents without contributing to a raid", () => {
  const g = createSimulation({ regional: true });
  const region = REGIONS.find((r) => r.id === "1:0");
  g.regions.unlocked.add(region.id);
  g.world.generate(region);
  g.nav.rebuildObstacles();
  Object.assign(g.player, { x: 3400, y: 1800, path: [], autoTimer: 1000 });
  g.state.worldTime = 299.99;
  g.update(0.02);
  g.update(3.2);
  const enemy = g.survival.residents.find((e) => e.regionId === region.id);
  assert.ok(enemy);
  Object.assign(g.player, g.nav.nearestGround(enemy.x + 40, enemy.y), {
    path: [],
  });
  assert.ok(g.selectEnemy(enemy.id));
  g.player.path = [];
  const coins = g.state.coins;
  g.state.axePower = 9; // Fully upgraded axe still needs five hits on a mini-boss.
  assert.ok(g.tryAttack(enemy.id));
  assert.equal(enemy.hp, 31);
  assert.equal(g.tryAttack(enemy.id), false);
  g.paused = true;
  assert.equal(g.tryAttack(enemy.id), false);
  g.paused = false;
  for (let i = 0; i < 12 && g.survival.residents.includes(enemy); i++) {
    g.update(0.2);
    g.tryAttack(enemy.id);
  }
  assert.ok(!g.survival.residents.includes(enemy));
  assert.equal(g.state.coins, coins);
  assert.equal(g.state.raidsWon, 0);
  assert.equal(g.survival.wave, null);
});
