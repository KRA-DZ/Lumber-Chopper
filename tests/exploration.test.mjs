import test from "node:test";
import assert from "node:assert/strict";
import { createSimulation } from "../game/simulation.js";
import { EXPLORATION, ITEMS } from "../game/exploration.js";
const create = (emit) =>
  createSimulation({ regional: true, survival: false, emit });
function open(g, id) {
  const gate = g.regions.frontiers().find((r) => r.region.id === id);
  assert.ok(gate);
  Object.assign(g.player, { x: gate.x, y: gate.y, path: [], autoTimer: 1000 });
  while (g.state.wood) g.forestry.takeCargo();
  g.state.maxWood = 82;
  for (let i = 0; i < gate.region.cost; i++) g.forestry.addCargo(10);
  for (let i = 0; i <= gate.region.cost; i++) g.update(0.2);
  assert.ok(g.regions.unlocked.has(id));
}
function visit(g, id) {
  const s = g.exploration.get(id);
  Object.assign(g.player, g.nav.nearestGround(s.x, s.y + 40), {
    path: [],
    autoTimer: 1000,
    moving: false,
  });
  assert.ok(g.exploration.request(id));
  assert.equal(g.exploration.context, id);
  return s;
}
function buy(g, id, amount) {
  g.state.coins = amount;
  visit(g, "mysterious-merchant");
  assert.ok(g.exploration.perform("mysterious-merchant", id));
}
function cast(g) {
  visit(g, "fishing");
  assert.ok(g.exploration.perform("fishing", "fish"));
  g.exploration.close();
}
function bite(g) {
  for (let i = 0; i < 150 && g.exploration.fishing?.phase !== "bite"; i++)
    g.update(0.05);
  assert.equal(g.exploration.fishing?.phase, "bite");
}

test("locked, unknown, remote, stale and forged activity transactions never pay out or consume items", () => {
  const g = create(),
    m = g.exploration,
    d = g.state.exploration;
  assert.equal(m.request("missing"), false);
  assert.equal(m.request("fishing"), false);
  assert.equal(m.perform("mysterious-merchant", "buy-key"), false);
  open(g, "0:1");
  g.state.coins = 200;
  assert.equal(m.perform("mysterious-merchant", "buy-key"), false);
  visit(g, "mysterious-merchant");
  assert.equal(m.perform("mysterious-merchant", "open-chest"), false);
  Object.assign(g.player, { x: 1600, y: 1720 });
  assert.equal(m.perform("mysterious-merchant", "buy-key"), false);
  assert.equal(g.state.coins, 200);
  assert.equal(d.items.key, 0);
  visit(g, "mysterious-merchant");
  m.close();
  assert.equal(m.perform("mysterious-merchant", "buy-key"), false);
  g.paused = true;
  assert.equal(m.request("mysterious-merchant"), false);
});

test("merchant has its own finite inventory purchases and atomic sales, while a paused inspection can transact", () => {
  const g = create();
  open(g, "0:1");
  const m = g.exploration,
    d = g.state.exploration;
  visit(g, "mysterious-merchant");
  g.state.coins = 49;
  assert.equal(m.perform(m.context, "buy-rod"), false);
  g.state.coins = 50;
  g.paused = true;
  assert.ok(m.perform(m.context, "buy-rod"));
  assert.ok(d.rod);
  assert.equal(g.state.coins, 0);
  g.state.coins = 1000;
  assert.equal(m.perform(m.context, "buy-rod"), false);
  for (let i = 0; i < 3; i++) assert.ok(m.perform(m.context, "buy-key"));
  assert.equal(d.items.key, 3);
  const coins = g.state.coins;
  assert.equal(m.perform(m.context, "buy-key"), false);
  assert.equal(g.state.coins, coins);
  assert.equal(m.perform(m.context, "buy-salve"), false);
  d.items.resin = 1;
  assert.ok(m.perform(m.context, "buy-salve"));
  assert.equal(d.items.resin, 0);
  assert.equal(d.items.salve, 1);
  d.items.fish = 2;
  assert.ok(m.perform(m.context, "sell-fish"));
  const after = g.state.coins;
  assert.equal(m.perform(m.context, "sell-fish"), false);
  assert.equal(g.state.coins, after);
  d.items.relic = 1;
  assert.ok(m.perform(m.context, "sell-relic"));
  assert.equal(g.state.coins, after + 40);
  g.state.gameOver = true;
  assert.equal(m.perform(m.context, "buy-key"), false);
});

test("each actual ruin chest consumes one key and grants deterministic coins/relic once, including after leaving the region", () => {
  const events = [],
    g = create((t, e) => events.push([t, e]));
  open(g, "0:-1");
  const m = g.exploration,
    d = g.state.exploration,
    id = "chest:0:-1:0";
  visit(g, id);
  assert.equal(m.perform(id, "open-chest"), false);
  d.items.key = 2;
  const loot = m.chestLoot(id);
  assert.deepEqual(loot, { coins: 55, relic: 1 });
  assert.ok(m.perform(id, "open-chest"));
  assert.equal(g.state.coins, 55);
  assert.equal(d.items.key, 1);
  assert.equal(d.items.relic, 1);
  assert.equal(m.perform(id, "open-chest"), false);
  g.setDestination(1600, 1720);
  visit(g, id);
  assert.equal(m.perform(id, "open-chest"), false);
  assert.equal(
    events.filter(
      ([t, e]) => t === "activity-completed" && e.action === "open-chest",
    ).length,
    1,
  );
  visit(g, "chest:0:-1:1");
  d.items.relic = ITEMS.relic.limit;
  assert.equal(m.perform(m.context, "open-chest"), false);
  assert.equal(d.items.key, 1);
  assert.equal(m.regionSummary("0:-1"), "Сундуки: 1/2");
});

test("one chest in every ruin is discoverable through the same model, with finite unique loot", () => {
  const g = create();
  while (g.regions.unlocked.size < 25)
    open(g, g.regions.frontiers()[0].region.id);
  const chests = g.exploration.sites.filter((s) => s.kind === "chest");
  assert.equal(chests.length, 12);
  const ids = new Set();
  for (const s of chests) {
    assert.ok(g.exploration.available(s));
    assert.ok(g.exploration.chestLoot(s.id).coins >= 55);
    ids.add(s.id);
  }
  assert.equal(ids.size, 12);
});

test("ancient tree takes three real stack logs once per daytime, preserves remaining value and never becomes harvestable", () => {
  const g = create();
  open(g, "1:0");
  const m = g.exploration,
    d = g.state.exploration,
    id = "ancient-roots";
  visit(g, id);
  g.state.maxWood = 4;
  g.forestry.addCargo(11);
  g.forestry.addCargo(12);
  assert.equal(m.perform(id, "offer-logs"), false);
  g.forestry.addCargo(13);
  g.forestry.addCargo(14);
  assert.ok(m.perform(id, "offer-logs"));
  assert.equal(g.state.wood, 1);
  assert.equal(g.state.cargoValue, 11);
  assert.equal(d.items.resin, 1);
  for (let i = 0; i < 3; i++) g.forestry.addCargo(10);
  assert.equal(m.perform(id, "offer-logs"), false);
  g.state.calendarDay++;
  g.state.worldTime = 450;
  assert.equal(m.perform(id, "offer-logs"), false);
  g.state.worldTime = 120;
  assert.ok(m.perform(id, "offer-logs"));
  assert.equal(d.items.resin, 2);
  assert.ok(g.world.ancientTree.workerOnly && g.world.ancientTree.infinite);
  assert.equal(g.tryChop(g.world.ancientTree.id), false);
  d.items.resin = ITEMS.resin.limit;
  g.state.calendarDay++;
  assert.equal(m.perform(id, "offer-logs"), false);
});

test("fishing requires a rod and a timed reaction, keeps game time, pauses precisely and rejects repeat rewards", () => {
  const g = create();
  open(g, "-1:0");
  const m = g.exploration,
    d = g.state.exploration;
  visit(g, "fishing");
  assert.equal(m.perform("fishing", "fish"), false);
  d.rod = true;
  cast(g);
  const time = g.state.worldTime;
  g.update(1);
  assert.ok(g.state.worldTime >= time + 0.99);
  const remaining = m.fishing.timer;
  g.paused = true;
  g.update(10);
  assert.equal(m.fishing.timer, remaining);
  assert.equal(m.reel(), false);
  g.paused = false;
  assert.equal(m.reel(), false);
  assert.equal(m.fishing, null);
  assert.equal(d.items.fish, 0);
  cast(g);
  bite(g);
  assert.ok(m.reel());
  assert.equal(d.items.fish, 1);
  assert.equal(m.reel(), false);
  assert.equal(d.items.fish, 1);
  cast(g);
  bite(g);
  g.update(EXPLORATION.biteWindow + 0.1);
  assert.equal(m.fishing, null);
  assert.equal(d.items.fish, 1);
});

test("movement, explicit navigation, damage, sunset and defeat cancel fishing without giving a fish", () => {
  for (const reason of ["move", "navigate", "damage", "night", "defeat"]) {
    const g = create();
    open(g, "-1:0");
    const m = g.exploration;
    g.state.exploration.rod = true;
    cast(g);
    bite(g);
    if (reason === "move") g.keys.add("KeyD");
    if (reason === "navigate") g.setDestination(g.player.x + 30, g.player.y);
    if (reason === "damage") g.state.health -= 20;
    if (reason === "night") g.state.worldTime = 299.99;
    if (reason === "defeat") {
      g.state.gameOver = true;
      m.cancelAll();
    }
    g.update(0.05);
    assert.equal(m.fishing, null, reason);
    assert.equal(g.state.exploration.items.fish, 0);
  }
});

test("daily catch quota and bag limits reset only at dawn, while failed casts do not consume quota", () => {
  const g = create();
  open(g, "-1:0");
  const m = g.exploration,
    d = g.state.exploration;
  d.rod = true;
  for (let i = 0; i < 4; i++) {
    cast(g);
    bite(g);
    assert.ok(m.reel());
  }
  visit(g, "fishing");
  assert.equal(m.perform("fishing", "fish"), false);
  assert.equal(m.caughtToday(), 4);
  g.state.worldTime = 599.99;
  g.update(0.02);
  assert.equal(m.caughtToday(), 0);
  cast(g);
  bite(g);
  assert.ok(m.reel());
  assert.equal(d.items.fish, 5);
  d.items.fish = ITEMS.fish.limit;
  visit(g, "fishing");
  assert.equal(m.perform("fishing", "fish"), false);
});

test("fish cooking and salve heal within max HP and cannot consume items at full health or after defeat", () => {
  const g = create(),
    m = g.exploration,
    d = g.state.exploration;
  d.items.fish = 2;
  d.items.salve = 2;
  assert.equal(m.request("camp-kitchen"), false);
  g.state.campLevel = 1;
  g.nav.rebuildObstacles();
  visit(g, "camp-kitchen");
  assert.equal(m.perform(m.context, "cook-fish"), false);
  assert.equal(m.useItem("salve"), false);
  g.state.health = 65;
  assert.ok(m.perform(m.context, "cook-fish"));
  assert.equal(g.state.health, 85);
  assert.equal(d.items.fish, 1);
  assert.ok(m.useItem("salve"));
  assert.equal(g.state.health, 100);
  assert.equal(d.items.salve, 1);
  g.state.gameOver = true;
  g.state.health = 10;
  assert.equal(m.useItem("salve"), false);
  assert.equal(m.perform(m.context, "cook-fish"), false);
});

test("site approach resumes after pause, arrival emits once, manual navigation cancels and new sessions start empty", () => {
  const events = [],
    g = create((t, e) => events.push([t, e]));
  open(g, "0:1");
  const m = g.exploration,
    s = m.get("mysterious-merchant");
  Object.assign(g.player, g.nav.nearestGround(s.x, s.y + 300), { path: [] });
  assert.ok(m.request(s.id));
  assert.equal(m.pending, s.id);
  g.paused = true;
  g.update(3);
  assert.equal(m.context, null);
  g.paused = false;
  g.update(5);
  assert.equal(m.context, s.id);
  assert.equal(events.filter(([t]) => t === "site-ready").length, 1);
  g.update(3);
  assert.equal(events.filter(([t]) => t === "site-ready").length, 1);
  m.request(s.id);
  g.setDestination(1600, 1720);
  assert.equal(m.pending, null);
  assert.equal(m.context, null);
  const next = create();
  assert.equal(next.state.exploration.rod, false);
  assert.deepEqual(next.state.exploration.openedChests, []);
  assert.ok(Object.values(next.state.exploration.items).every((n) => n === 0));
});

test("all four regional activities can be reached from camp and one another using actual walking routes", () => {
  const g = create();
  for (const id of ["0:1", "-1:0", "1:0", "0:-1"]) open(g, id);
  Object.assign(g.player, { x: 1600, y: 1720, path: [] });
  g.state.worldTime = 120;
  for (const id of [
    "mysterious-merchant",
    "fishing",
    "ancient-roots",
    "chest:0:-1:0",
  ]) {
    assert.ok(g.exploration.request(id));
    for (let i = 0; i < 900 && g.exploration.context !== id; i++)
      g.update(0.05);
    assert.equal(g.exploration.context, id, id);
    const site = g.exploration.get(id);
    assert.ok(
      Math.hypot(g.player.x - site.x, g.player.y - site.y) < EXPLORATION.range,
    );
    assert.ok(g.nav.isWalkable(g.player.x, g.player.y));
    g.exploration.close();
  }
});
test("a merchant wall blocks a transaction despite being within interaction distance", () => {
  const g = create();
  open(g, "0:1");
  g.state.coins = 100;
  visit(g, "mysterious-merchant");
  Object.assign(g.player, { x: 1670, y: 3395, path: [] });
  assert.ok(
    Math.hypot(g.player.x - 1670, g.player.y - 3505) < EXPLORATION.range,
  );
  assert.equal(g.exploration.perform("mysterious-merchant", "buy-key"), false);
  assert.equal(g.state.coins, 100);
});

test("an explicit axe strike cancels a site approach; automatic incidental chopping keeps it", () => {
  const g = create();
  open(g, "0:1");
  const tree = g.trees.find((t) => t.regionId === "0:0" && t.hp > 1);
  Object.assign(g.player, {
    x: tree.x + 58,
    y: tree.y,
    path: [],
    autoTimer: 0,
  });
  assert.ok(g.exploration.request("mysterious-merchant"));
  assert.ok(g.tryChop(tree.id, "auto"));
  assert.equal(g.exploration.pending, "mysterious-merchant");
  assert.ok(g.tryChop(tree.id, "active"));
  assert.equal(g.exploration.pending, null);
  assert.equal(g.player.path.length, 0);
  assert.equal(g.player.targetX, g.player.x);
});
