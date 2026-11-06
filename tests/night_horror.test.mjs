import test from "node:test";
import { NIGHT_START } from "../game/cycle.js";
import assert from "node:assert/strict";
import {
  nightOpacity,
  nightLights,
  inCampLight,
  nightFireflies,
} from "../phaser/night-lighting.js";
import { SURVIVAL } from "../game/survival.js";
import { WATCHER } from "../game/watcher.js";
import { BIOME_ENEMIES } from "../game/biome-enemies.js";
import {
  RAIDER_ROLES,
  RAIDER_ATTACK_COOLDOWN,
  createRaiderAI,
} from "../game/raiders.js";
import { createInitialState } from "../game/config.js";

test("night has no residual ambient opacity leak while dusk approaches it smoothly", () => {
  assert.equal(nightOpacity({ worldTime: 120 }), 0);
  assert.equal(nightOpacity({ worldTime: 400 }), 0);
  assert.ok(nightOpacity({ worldTime: NIGHT_START - 5 }) > 0);
  assert.ok(nightOpacity({ worldTime: NIGHT_START - .1 }) > 0.99);
  for (const worldTime of [NIGHT_START, NIGHT_START + 1, 500, 599.9])
    assert.equal(nightOpacity({ worldTime }), 1);
  assert.equal(nightOpacity({ worldTime: 0 }), 0);
});
test("the personal lantern follows the player and retains every old radius upgrade", () => {
  const state = createInitialState(),
    p = { x: 2300, y: 1700 };
  state.campLevel = 1; state.campFuel = 60;
  for (let level = 0; level <= 4; level++) {
    state.lanternLevel = level;
    const lights = nightLights(state, p, 310);
    assert.equal(lights[0].kind, "player");
    assert.equal(lights[0].x, p.x);
    assert.equal(lights[0].y, p.y - 24);
    assert.equal(lights[0].r, 140 + level * 24);
    assert.equal(lights[1].r, 430);
    assert.ok(inCampLight(p.x, p.y - 24, lights));
    assert.ok(!inCampLight(5000, 5000, lights));
  }
  const before = nightLights(state, p, 310);
  p.x += 300;
  const after = nightLights(state, p, 310);
  assert.equal(after[0].x - before[0].x, 300);
  assert.deepEqual(after.slice(1), before.slice(1));
});
test("fireflies are bounded points in accessible darkness, not new light sources", () => {
  const view = { x: 2000, y: 2000, right: 4000, bottom: 3500 };
  const lights = nightLights(createInitialState(), { x: 1600, y: 1720 }, 210),
    before = JSON.stringify(lights);
  for (const light of [false, true]) {
    const dots = nightFireflies(24, view, () => true, lights, light);
    assert.ok(dots.length > 0 && dots.length <= (light ? 6 : 16));
    for (const p of dots) {
      assert.ok(!inCampLight(p.x, p.y, lights));
      assert.ok(
        p.x >= view.x &&
          p.x <= view.right &&
          p.y >= view.y &&
          p.y <= view.bottom,
      );
    }
  }
  assert.deepEqual(
    nightFireflies(24, view, () => false, lights),
    [],
  );
  assert.equal(JSON.stringify(lights), before);
});
test("all enemy windups and full attack cycles are at least twice as fast; pursuit remains bounded", () => {
  assert.ok(SURVIVAL.monsterWindup <= 1.2 / 2);
  assert.ok(WATCHER.recovery <= 2 / 2);
  assert.ok(
    SURVIVAL.monsterWindup + WATCHER.recovery + WATCHER.strikeSeconds <=
      (1.2 + 2 + 0.18) / 2,
  );
  assert.equal(SURVIVAL.monsterSpeed, 190);
  assert.ok(SURVIVAL.monsterSpeed < 200);
  assert.ok(BIOME_ENEMIES.windup <= 1.1 / 2);
  assert.ok(BIOME_ENEMIES.windup + BIOME_ENEMIES.cooldown <= (1.1 + 2.2) / 2);
  for (const [role, oldWindup] of Object.entries({
    attacker: 0.9,
    thief: 1.2,
    breaker: 1.3,
  })) {
    const r = RAIDER_ROLES[role];
    assert.ok(r.windup <= oldWindup / 2);
    assert.ok(r.windup + RAIDER_ATTACK_COOLDOWN <= (oldWindup + 2.2) / 2);
  }
  assert.equal(SURVIVAL.waveEvery, 5);
  assert.equal(SURVIVAL.maxRaiders, 8);
  assert.equal(BIOME_ENEMIES.hp, 120);
  assert.equal(BIOME_ENEMIES.max, 6);
});
test("raiders actually strike on the shorter cadence, with movement out of range cancelling the windup", () => {
  for (const role of ["attacker", "breaker"]) {
    const state = createInitialState(),
      player = { x: 2200, y: 1600 };
    const actor = {
      x: 2240,
      y: 1600,
      role,
      hp: 7,
      windup: 0,
      cooldown: 0,
      path: [],
      repath: 0,
    };
    const hits = [];
    let time = 0;
    const ai = createRaiderAI({
      state,
      player,
      nav: { clearSegment: () => true, followPath: () => 0 },
      emit: () => {},
      hurtPlayer: () => hits.push(time),
      defeat: () => {},
      hit: () => {},
      escaped: () => {},
    });
    for (let i = 0; i < 20; i++) {
      time += 0.01;
      ai.tick(actor, 0.01, false);
    }
    assert.equal(hits.length, 0);
    player.x = 2600;
    ai.tick(actor, 0.01, false);
    assert.equal(actor.windup, 0);
    player.x = 2200;
    for (let i = 0; i < 260 && hits.length < 2; i++) {
      time += 0.01;
      // Survival owns cooldown ticking; this fixture calls the role AI directly.
      actor.cooldown = Math.max(0, actor.cooldown - 0.01);
      ai.tick(actor, 0.01, false);
    }
    assert.equal(hits.length, 2);
    assert.ok(
      hits[1] - hits[0] <=
        RAIDER_ROLES[role].windup + RAIDER_ATTACK_COOLDOWN + 0.03,
    );
  }
});
