import { NIGHT_START } from "../game/cycle.js";
import test from "node:test";
import assert from "node:assert/strict";
import { createLocalCoop } from "../game/local-coop.js";
import { STAGES } from "../game/config.js";
import { treeYield } from "../forestry.js";

const make = (hazards = false) => createLocalCoop({ survival: hazards });
const place = (a, p) => Object.assign(a.player, p, { path: [], autoTimer: 10000, moving: false });
function open(g, id) {
  const r = g.regions.all.find(r => r.id === id);
  g.regions.unlocked.add(id); g.world.generate(r); g.actors[0].nav.rebuildObstacles(); g.update(.01);
  return r;
}

test("two simultaneous controls move independent bodies while calendar, growth and buyers tick once", () => {
  const g = make(), [a, b] = g.actors, start = g.state.worldTime;
  a.keys.add("KeyD"); b.keys.add("ArrowLeft"); g.update(1);
  assert.ok(a.player.x > 1750 && b.player.x < 1450);
  assert.ok(Math.abs(g.state.worldTime - start - 1) < 1e-8);
  assert.equal(a.world, b.world); assert.equal(a.regions, b.regions);
  assert.equal(a.buyers, b.buyers); assert.equal(a.buyers.length, 1);
  assert.equal(a.forestry.piles, b.forestry.piles);
  assert.equal(a.state.appearance, "traveler"); assert.equal(b.state.appearance, "woodcutter");
});

test("money, carry, axe, run speed, lantern and inventory remain private even through the focused UI state", () => {
  const g = make(), [a, b] = g.actors;
  a.state.coins = 100; b.state.coins = 200;
  assert.ok(a.purchaseUpgrade("carry")); assert.equal(a.state.maxWood, 4); assert.equal(b.state.maxWood, 2);
  g.focus(1); const uiState = g.state;
  assert.ok(g.purchaseUpgrade("axe")); assert.equal(b.state.axeLevel, 1); assert.equal(a.state.axeLevel, 0);
  b.state.exploration.items.fish = 2; b.state.health = 70;
  assert.equal(a.state.exploration.items.fish, 0); assert.equal(a.state.health, 100);
  assert.equal(uiState.health, 70); g.focus(0); assert.equal(uiState.health, 100);
  const balance = a.state.coins; g.withActor(1, () => { g.state.coins += 7; });
  assert.equal(a.state.coins, balance); assert.equal(g.activeActor, 0);
});

test("one shared tree yields once; pickup splits its actual finite logs without duplication", () => {
  const g = make(), [a, b] = g.actors, tree = g.world.trees.find(t => t.hp > 0 && t.y > 1800);
  place(a, { x: tree.x - 25, y: tree.y + 40 }); place(b, { x: tree.x + 25, y: tree.y + 40 });
  a.state.axePower = 20;
  assert.ok(a.tryChop(tree.id)); assert.equal(b.tryChop(tree.id), false);
  g.update(.8);
  const remaining = [...a.forestry.piles.values()].reduce((sum, p) => sum + p.count, 0);
  assert.equal(a.state.wood + b.state.wood + remaining, treeYield(tree));
  assert.ok(a.state.wood > 0 && b.state.wood > 0);
});

test("both players build a common camp and open a common region using their own stacks", () => {
  const g = make(), cost = STAGES[0].cost;
  for (const a of g.actors) {
    a.state.maxWood = cost; for (let i = 0; i < cost / 2; i++) a.forestry.addCargo(10);
    place(a, g.build);
  }
  for (let i = 0; i < 400 && g.state.campLevel === 0; i++) g.update(.05);
  assert.equal(g.actors[0].state.campLevel, 1); assert.equal(g.actors[1].state.campLevel, 1);
  assert.equal(g.actors.reduce((n, a) => n + a.state.wood, 0), 0);
  const gate = g.regions.frontiers().find(g => g.region.id === "1:0");
  for (const a of g.actors) {
    a.state.maxWood = gate.region.cost / 2;
    for (let i = 0; i < gate.region.cost / 2; i++) a.forestry.addCargo(10);
    place(a, gate);
  }
  for (let i = 0; i < 100 && !g.regions.unlocked.has("1:0"); i++) g.update(.05);
  assert.ok(g.actors[1].regions.isOpen({ x: 3520, y: 1600 }));
  const tree = g.world.trees.find(t => t.regionId === "1:0");
  place(g.actors[1], { x: tree.x, y: tree.y + 40 });
  assert.ok(g.actors[1].tryChop(tree.id), "Player two indexes newly opened trees too");
});

test("a shared sale has one finite customer while proceeds go to each seller", () => {
  const g = make(); g.update(4);
  const buyer = g.buyers[0]; Object.assign(buyer, { x: 1375, y: 1670, phase: "waiting", slot: 0, path: [], load: 0 });
  for (const [i, a] of g.actors.entries()) {
    a.forestry.addCargo(10 + i * 10); place(a, g.sale);
    assert.ok(a.transferOneLog());
  }
  assert.equal(buyer.load, 2); assert.equal(g.actors[0].state.coins, 30); assert.equal(g.actors[1].state.coins, 30);
});

test("outpost fuel and opened chests are shared; resources and healing are charged to the interacting player", () => {
  const g = make(), [a, b] = g.actors; open(g, "0:-1");
  const site = b.exploration.get("fortress-last-fire"); place(b, { x: site.x, y: site.y + 40 });
  b.forestry.addCargo(10); b.forestry.addCargo(10);
  b.state.exploration.items.fish = 1; b.state.health = 70;
  assert.ok(b.exploration.request(site.id)); assert.ok(b.exploration.perform(site.id, "stoke-fire"));
  assert.equal(a.outposts.remaining(site.id), 120); assert.ok(b.exploration.perform(site.id, "cook-fish"));
  assert.equal(b.state.health, 90); assert.equal(a.state.health, 100);
  assert.equal(a.state.exploration.openedChests, b.state.exploration.openedChests);
  g.paused = true; const fuel = a.outposts.remaining(site.id); g.update(5); assert.equal(a.outposts.remaining(site.id), fuel);
  g.paused = false; g.update(1); assert.ok(Math.abs(a.outposts.remaining(site.id) - fuel + 1) < 1e-8);
});

test("one downed player cannot move or self-heal; uninterrupted nearby help revives him and both deaths end the session", () => {
  const g = make(), [a, b] = g.actors;
  g.party.focus(a); g.party.hurt(100, "watcher");
  assert.equal(a.state.health, 0); assert.equal(g.state.gameOver, false);
  a.state.exploration.items.salve = 1;
  assert.equal(a.exploration.useItem("salve"), false);
  const x = a.player.x; a.keys.add("KeyA"); g.update(.1); assert.equal(a.player.x, x);
  g.assist(1, true); g.update(1); assert.equal(a.state.health, 0);
  g.paused = true; g.update(5); assert.equal(a.state.health, 0);
  g.paused = false; g.assist(1, true); g.update(3.1);
  assert.equal(a.state.health, 35); assert.equal(a.state.exploration.items.salve, 1);
  g.update(2.1); g.party.focus(a); g.party.hurt(100, "watcher");
  g.party.focus(b); g.party.hurt(100, "watcher"); assert.ok(g.state.gameOver && g.paused);
});

test("night enemies select and hurt the exposed second player while a sheltered first player stays healthy", () => {
  const g = make(true), [a, b] = g.actors;
  g.state.campLevel = 1; g.state.campFuel = 600;
  place(a, { x: 1600, y: 1780 }); place(b, { x: 2000, y: 2000 });
  g.state.worldTime = NIGHT_START - .01; g.update(.02); g.update(12.1);
  b.state.health = 100; b.player.hitCooldown = 0;
  for (const e of g.survival.residents) e.warning = 1000;
  const m = g.survival.monster;
  Object.assign(m, { x: b.player.x, y: b.player.y - 50, warning: 0, phase: "windup", phaseTime: .055,
    attack: { x: b.player.x, y: b.player.y, radius: 54, duration: .06 }, path: [], repath: 0 });
  g.update(.05);
  assert.equal(m.targetPlayerId, 1); assert.equal(b.state.health, 60); assert.equal(a.state.health, 100);
});

test("a living second player can earn combat loot while the host is down without duplicate rewards", () => {
  const g = make(true), [a, b] = g.actors;
  const forest = open(g, "1:0"); place(b, b.nav.nearestGround(forest.cx, forest.cy + 300));
  g.state.worldTime = NIGHT_START - .01; g.update(.02);
  const enemy = g.survival.minions.find(e => e.regionId === forest.id);
  assert.ok(enemy); enemy.warning = 0;
  place(b, enemy); b.state.axePower = 1000; b.player.clickTimer = 0;
  g.party.focus(a); g.party.hurt(100, "watcher");
  assert.ok(b.tryAttack(enemy.id)); assert.equal(b.tryAttack(enemy.id), false);
  assert.equal(a.combatLoot.piles, b.combatLoot.piles);
  const before = g.state.worldTime; g.update(.1);
  assert.equal(a.state.coins, 0); assert.equal(b.state.coins, 2);
  assert.equal(a.state.combatLoot.coinsCollected, 0); assert.equal(b.state.combatLoot.coinsCollected, 2);
  assert.equal(a.state.health, 0); assert.ok(!g.state.gameOver && g.state.worldTime > before);
});

test("separated players stream enemies near both regions with shared caps and no spawn closer than 330", () => {
  const g = make(true); const swamp = open(g, "0:1"), forest = open(g, "1:0");
  place(g.actors[0], g.nav.nearestGround(swamp.cx, swamp.cy + 400));
  place(g.actors[1], g.actors[1].nav.nearestGround(forest.cx, forest.cy + 400));
  g.state.worldTime = NIGHT_START - .01; g.update(.02);
  for (const r of [swamp, forest]) assert.ok(g.survival.minions.some(e => e.regionId === r.id));
  assert.ok(g.survival.minions.length <= 12 && g.survival.regionalBosses.length <= 6);
  for (const e of g.survival.residents) for (const a of g.actors)
    assert.ok(Math.hypot(e.x - a.player.x, e.y - a.player.y) > 329);
});
