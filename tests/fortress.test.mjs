import test from "node:test";
import assert from "node:assert/strict";
import { createSimulation } from "../game/simulation.js";
import { FORTRESS, insideLocation } from "../game/locations.js";

function create() {
  const g = createSimulation({ regional: true, survival: false });
  const gate = g.regions.frontiers().find((p) => p.region.id === "0:-1");
  Object.assign(g.player, { x: gate.x, y: gate.y, path: [], autoTimer: 10000 });
  g.state.maxWood = 16;
  for (let i = 0; i < 12; i++) g.forestry.addCargo(10);
  for (let i = 0; i <= 12; i++) g.update(0.2);
  assert.ok(g.regions.unlocked.has("0:-1"));
  return g;
}
function walk(g, p) {
  g.setDestination(p.x, p.y);
  assert.ok(g.player.path.length, `No path to ${p.id || JSON.stringify(p)}`);
  for (let i = 0; i < 1600 && g.player.path.length; i++) g.update(0.05);
  assert.ok(Math.hypot(g.player.x - p.x, g.player.y - p.y) < 2);
}
function inspect(g, id) {
  const s = g.exploration.get(id);
  walk(g, { x: s.x, y: s.y + 40 });
  assert.ok(g.exploration.request(id));
  assert.equal(g.exploration.context, id);
  return s;
}

test("fortress reserves a large footprint, keeps all twelve chest IDs and leaves the starting region intact", () => {
  const g = create();
  assert.ok(FORTRESS.bounds.width >= 1100 && FORTRESS.bounds.height >= 900);
  assert.equal(
    g.exploration.sites.filter((s) => s.kind === "chest").length,
    12,
  );
  assert.equal(
    new Set(g.world.clues.map((p) => p.id)).size,
    g.world.clues.length,
  );
  for (const t of g.world.trees.filter((t) => t.regionId === "0:-1"))
    assert.ok(!insideLocation(FORTRESS, t.x, t.y, 72));
  for (const p of g.world.decorBins.get("0:-1"))
    assert.ok(!insideLocation(FORTRESS, p.x, p.y, 32));
  const fresh = createSimulation({ regional: true, survival: false });
  assert.deepEqual(
    g.world.decorBins.get("0:0"),
    fresh.world.decorBins.get("0:0"),
  );
  assert.deepEqual(
    g.world.trees.filter((t) => t.regionId === "0:0"),
    fresh.world.trees,
  );
});

test("actual walking reaches both chests, every note and the winch through open doors", () => {
  const g = create();
  Object.assign(g.player, FORTRESS.entrance);
  for (const c of FORTRESS.clues) {
    walk(g, { x: c.x, y: c.y + 32 });
    assert.ok(g.readClue(c.id), c.id);
  }
  for (const id of ["chest:0:-1:0", "chest:0:-1:1", "fortress-winch"])
    inspect(g, id);
});

test("solid walls block movement and sight; their doorways remain wide and walkable", () => {
  const g = create();
  const a = { x: 1744, y: -640 },
    b = { x: 1840, y: -640 };
  assert.ok(!g.nav.clearSegment(a, b));
  assert.ok(!g.nav.hasLineOfSight(a, b));
  const body = { ...a };
  g.nav.moveBody(body, 96, 0);
  assert.ok(body.x < 1792 - 12);
  // Main gate, western entrance and eastern entrance have generous clear bases.
  for (const p of [
    { x: 1600, y: 128 },
    { x: 1408, y: -432 },
    { x: 1792, y: -176 },
  ])
    for (const dy of [-30, 0, 30]) assert.ok(g.nav.isWalkable(p.x, p.y + dy));
  const c = FORTRESS.clues.find((c) => c.id === "ruins-note");
  Object.assign(g.player, { x: c.x, y: c.y - 120 });
  assert.ok(Math.hypot(g.player.x - c.x, g.player.y - c.y) < 140);
  assert.equal(g.readClue(c.id), false, "notes cannot be read through a wall");
});

test("archive seal needs a real nearby clue and key; loot remains finite and unchanged", () => {
  const g = create();
  Object.assign(g.player, FORTRESS.entrance);
  const id = "chest:0:-1:1";
  inspect(g, id);
  g.state.exploration.items.key = 1;
  assert.equal(g.exploration.perform(id, "open-chest"), false);
  assert.equal(g.state.exploration.items.key, 1);
  assert.equal(g.readClue("fortress-ledger"), false);
  g.exploration.close();
  const clue = g.world.clues.find((p) => p.id === "fortress-ledger");
  walk(g, { x: clue.x, y: clue.y + 32 });
  assert.ok(g.readClue(clue.id));
  inspect(g, id);
  const before = g.state.coins;
  g.paused = true; // A real paused inspection still allows its transaction.
  assert.ok(g.exploration.perform(id, "open-chest"));
  assert.equal(g.state.coins - before, 65);
  assert.equal(g.state.exploration.items.key, 0);
  assert.equal(g.state.exploration.items.relic, 1);
  assert.equal(g.exploration.perform(id, "open-chest"), false);
  g.paused = false;
  g.exploration.close();
  walk(g, FORTRESS.entrance);
  inspect(g, id);
  assert.equal(g.exploration.perform(id, "open-chest"), false);
});

test("shortcut opens only at the interior mechanism, shortens the route and never charges or rewards twice", () => {
  const g = create(),
    id = "fortress-winch",
    site = g.exploration.get(id);
  const a = { x: 1744, y: site.y },
    b = { x: 1840, y: site.y };
  Object.assign(g.player, a);
  assert.equal(g.exploration.perform(id, "open-passage"), false);
  assert.ok(!g.exploration.near(site));
  const length = (path, start) =>
    path.reduce(
      (sum, p, i) =>
        sum +
        Math.hypot(
          p.x - (path[i - 1] || start).x,
          p.y - (path[i - 1] || start).y,
        ),
      0,
    );
  const before = length(g.nav.findPath(a, b), a);
  inspect(g, id);
  const coins = g.state.coins,
    cargo = [...g.state.cargo],
    version = g.nav.version;
  g.paused = true;
  assert.ok(g.exploration.perform(id, "open-passage"));
  assert.ok(g.nav.version > version);
  assert.ok(g.nav.clearSegment(a, b));
  assert.ok(g.nav.hasLineOfSight(a, b));
  assert.ok(length(g.nav.findPath(a, b), a) < before / 3);
  assert.equal(g.exploration.perform(id, "open-passage"), false);
  assert.deepEqual(g.state.exploration.openedPassages, ["fortress-shortcut"]);
  assert.equal(g.state.coins, coins);
  assert.deepEqual(g.state.cargo, cargo);
  g.paused = false;
  g.exploration.close();
  walk(g, FORTRESS.entrance);
  inspect(g, id);
  assert.equal(g.exploration.perform(id, "open-passage"), false);
  const fresh = create();
  assert.deepEqual(fresh.state.exploration.openedPassages, []);
  assert.ok(!fresh.nav.clearSegment(a, b));
});
