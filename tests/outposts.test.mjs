import { NIGHT_START } from "../game/cycle.js";
import test from "node:test";
import assert from "node:assert/strict";
import { createSimulation } from "../game/simulation.js";
import { OUTPOST } from "../game/outposts.js";
import { nightLights } from "../phaser/night-lighting.js";
import { FORTRESS } from "../game/locations.js";

const ID = "fortress-last-fire";
function fixture(hazards = false, open = true) {
  const events = [], g = createSimulation({ regional: true, survival: hazards,
    emit: (type, event) => events.push({ type, event }) }), site = g.exploration.get(ID);
  if (open) {
    const r = g.regions.all.find(r => r.id === site.regionId);
    g.regions.unlocked.add(r.id); g.world.generate(r); g.nav.rebuildObstacles();
  }
  Object.assign(g.player, { x: site.x, y: site.y + 40, path: [], autoTimer: 10000 });
  return { g, site, events };
}
function light(g) {
  g.forestry.addCargo(10); g.forestry.addCargo(20);
  assert.ok(g.exploration.request(ID));
  assert.ok(g.exploration.perform(ID, "stoke-fire"));
}

test("two carried logs ignite the reachable fortress fire; refill consumes one, caps fuel and preserves money", () => {
  const { g, site } = fixture(), startCoins = g.state.coins;
  Object.assign(g.player, FORTRESS.entrance);
  g.setDestination(site.x, site.y + 40);
  assert.ok(g.player.path.length);
  for (let i = 0; i < 400 && g.player.path.length; i++) g.update(.05);
  assert.ok(Math.hypot(g.player.x - site.x, g.player.y - site.y - 40) < 2);
  assert.ok(g.exploration.request(ID));
  assert.equal(g.exploration.perform(ID, "stoke-fire"), false);
  g.forestry.addCargo(10);
  assert.equal(g.exploration.perform(ID, "stoke-fire"), false);
  assert.equal(g.state.wood, 1);
  g.forestry.addCargo(20);
  g.paused = true; // Inspection menu pauses simulation but permits its validated transaction.
  assert.ok(g.exploration.perform(ID, "stoke-fire"));
  assert.equal(g.outposts.remaining(ID), 120);
  assert.equal(g.state.wood, 0); assert.equal(g.state.cargoValue, 0);
  g.forestry.addCargo(15);
  assert.ok(g.exploration.perform(ID, "stoke-fire"));
  assert.equal(g.outposts.remaining(ID), OUTPOST.maxFuel);
  g.forestry.addCargo(12);
  assert.equal(g.exploration.perform(ID, "stoke-fire"), false);
  assert.equal(g.state.wood, 1); assert.equal(g.state.coins, startCoins);
  assert.ok(g.outposts.safeZone(site));
});

test("locked, remote, closed, forged and post-defeat activity commands never light a fire or consume logs", () => {
  const { g, site } = fixture(false, false);
  g.forestry.addCargo(10); g.forestry.addCargo(10);
  assert.equal(g.exploration.request(ID), false);
  assert.equal(g.exploration.perform(ID, "stoke-fire"), false);
  const r = g.regions.all.find(r => r.id === site.regionId);
  g.regions.unlocked.add(r.id); g.world.generate(r); g.nav.rebuildObstacles();
  assert.ok(g.exploration.request(ID));
  assert.equal(g.exploration.perform("camp-kitchen", "stoke-fire"), false);
  g.player.x += 500;
  assert.equal(g.exploration.perform(ID, "stoke-fire"), false);
  g.player.x = site.x; g.exploration.close();
  assert.equal(g.exploration.perform(ID, "stoke-fire"), false);
  assert.ok(g.exploration.request(ID));
  g.state.gameOver = true;
  assert.equal(g.exploration.perform(ID, "stoke-fire"), false);
  assert.equal(g.state.wood, 2); assert.equal(g.outposts.remaining(ID), 0);
});

test("cold/full-health cooking refuses payment; a lit outpost cooks one fish using normal healing limits", () => {
  const { g } = fixture();
  g.state.exploration.items.fish = 2; g.state.health = 90;
  assert.ok(g.exploration.request(ID));
  assert.equal(g.exploration.perform(ID, "cook-fish"), false);
  assert.equal(g.state.exploration.items.fish, 2);
  light(g);
  assert.ok(g.exploration.perform(ID, "cook-fish"));
  assert.equal(g.state.health, 100); assert.equal(g.state.exploration.items.fish, 1);
  assert.equal(g.exploration.perform(ID, "cook-fish"), false);
  assert.equal(g.state.exploration.items.fish, 1);
});

test("fuel burns away from the ruins, freezes on pause, warns/expires once and resets on a new game", () => {
  const { g, events } = fixture(); light(g);
  Object.assign(g.player, { x: 1600, y: 1780 });
  g.paused = true; g.update(300);
  assert.equal(g.outposts.remaining(ID), 120);
  g.paused = false; g.update(101);
  assert.ok(g.outposts.remaining(ID) > 18.99 && g.outposts.remaining(ID) < 19.01);
  assert.equal(events.filter(e => e.type === "outpost-low-fuel").length, 1);
  g.update(21); g.update(1);
  assert.equal(g.outposts.remaining(ID), 0); assert.deepEqual(g.outposts.lights(), []);
  assert.equal(events.filter(e => e.type === "outpost-extinguished").length, 1);
  assert.deepEqual(fixture().g.state.exploration.outpostFuel, {});
});

test("light and local safety appear only while fuel burns; courtyard walls and radius limit protection", () => {
  const { g, site } = fixture();
  assert.equal(g.outposts.safeZone(site), null); light(g);
  assert.ok(g.outposts.safeZone({ x: site.x, y: site.y + 80 }));
  assert.equal(g.outposts.safeZone({ x: site.x + 132, y: site.y - 68 }), null);
  assert.equal(g.outposts.safeZone({ x: site.x, y: site.y + 151 }), null);
  assert.ok(nightLights(g.state, g.player, 210, g.outposts.lights()).some(l => l.kind === "outpost"));
  g.state.exploration.outpostFuel[ID] = 0.01;
  g.update(.05);
  assert.equal(g.outposts.safeZone(g.player), null);
  assert.ok(!nightLights(g.state, g.player, 210, g.outposts.lights()).some(l => l.kind === "outpost"));
});

test("outpost cancels a ready Watcher strike and repels him around the local fire; expiry restores danger immediately", () => {
  const { g, site } = fixture(true); light(g);
  g.state.worldTime = NIGHT_START - .01; g.update(.02); g.update(12.1);
  const m = g.survival.monster;
  const contact = () => Object.assign(m, { x: site.x, y: site.y - 50, warning: 0,
    phase: "windup", phaseTime: .055, windup: .055, path: [], repath: 0,
    attack: { x: g.player.x, y: g.player.y, radius: 54, duration: .06 } });
  contact(); g.update(.05);
  assert.equal(m.phase, "repelled"); assert.equal(g.state.health, 100);
  assert.ok(m.goal && m.goal.y < site.y && Math.abs(m.goal.x - site.x) < 1);
  g.state.exploration.outpostFuel[ID] = .01;
  contact(); g.update(.05);
  assert.equal(m.phase, "strike"); assert.equal(g.state.health, 60);
});

test("a fifth-night minion can still attack a player inside a lit outpost", () => {
  const { g } = fixture(true); light(g);
  g.state.calendarDay = 4; g.state.worldTime = NIGHT_START - .01; g.update(.02); g.update(3.1);
  assert.ok(g.survival.minionHunt);
  Object.assign(g.survival.monster, { warning: 1000 });
  for (const e of g.survival.regionalBosses) e.warning = 1000;
  const e = g.survival.minions.find(e => e.role === "melee");
  assert.ok(e);
  Object.assign(e, { x: g.player.x + 25, y: g.player.y, warning: 0, cooldown: 0,
    windup: 0, attack: null, path: [], repath: 0 });
  g.update(.5);
  assert.ok(g.survival.isSafe(g.player));
  assert.ok(g.state.health < 100);
});
