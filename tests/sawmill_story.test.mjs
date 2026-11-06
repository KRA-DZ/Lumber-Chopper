import test from "node:test";
import assert from "node:assert/strict";
import { createSimulation } from "../game/simulation.js";
import { SAWMILL } from "../game/sawmill.js";

const DRIVE = "sawmill-hand-drive",
  TAG = "sawmill-shift-tag";
function create(emit) {
  const g = createSimulation({ regional: true, survival: false, emit });
  // Opening/funding the same two squares is covered by sawmill.test.mjs.
  for (const id of ["1:0", "1:1"]) {
    const r = g.regions.all.find((r) => r.id === id);
    g.state.campLevel = Math.max(g.state.campLevel, r.campRequired);
    for (let i = 0; i < r.cost; i++) g.regions.deposit(id);
    for (let i = 0; i < r.stoneCost; i++) g.regions.deposit(id,"stone");
    g.world.generate(r);
  }
  g.nav.rebuildObstacles();
  Object.assign(g.player, SAWMILL.entrance, { autoTimer: 10000 });
  return g;
}
function walk(g, p) {
  const goal = { x: p.x, y: p.y + 40 };
  g.setDestination(goal.x, goal.y);
  assert.ok(g.player.path.length, p.id);
  for (let i = 0; i < 900 && g.player.path.length; i++) g.update(0.05);
  assert.ok(Math.hypot(g.player.x - goal.x, g.player.y - goal.y) < 2, p.id);
}
function inspect(g, id) {
  const p = g.exploration.get(id);
  walk(g, p);
  assert.ok(g.exploration.request(id));
  assert.equal(g.exploration.context, id);
  return p;
}
function resources(g) {
  return JSON.stringify({
    coins: g.state.coins,
    cargo: g.state.cargo,
    bag: g.state.exploration.items,
    health: g.state.health,
    camp: g.state.campLevel,
    story: g.state.story,
  });
}
function openDrive(g) {
  const note = SAWMILL.clues.find((n) => n.id === "sawmill-last-shift");
  walk(g, note);
  assert.ok(g.readClue(note.id));
  inspect(g, DRIVE);
  assert.ok(g.exploration.perform(DRIVE, "open-passage"));
  g.exploration.close();
}

test("all three notes and environmental scenes are reachable with every debris shortcut intact", () => {
  const events = [],
    g = create((type, e) => events.push([type, e])),
    before = resources(g);
  assert.equal(
    new Set(g.world.clues.map((n) => n.id)).size,
    g.world.clues.length,
  );
  for (const n of SAWMILL.clues) {
    walk(g, n);
    assert.ok(g.readClue(n.id));
    assert.ok(g.readClue(n.id));
  }
  for (const p of SAWMILL.sites.filter((p) => p.kind === "inspect")) {
    inspect(g, p.id);
    assert.ok(p.description.length > 100);
    assert.deepEqual(g.exploration.offers(p.id), []);
    assert.equal(g.exploration.perform(p.id, "collect-discovery"), false);
    assert.equal(g.exploration.perform(p.id, "open-chest"), false);
  }
  inspect(g, DRIVE);
  assert.deepEqual(g.state.exploration.debrisHP, {});
  assert.equal(resources(g), before);
  assert.equal(
    events.filter(
      ([type, e]) => type === "clue-read" && e.id.startsWith("sawmill-"),
    ).length,
    3,
  );
  assert.match(g.exploration.regionSummary(SAWMILL.regionId), /Записки: 3\/3/);
  assert.deepEqual(
    g.exploration.regionDestination(
      g.regions.all.find((r) => r.id === SAWMILL.regionId),
    ),
    SAWMILL.entrance,
  );
});

test("the drive requires its actual nearby instruction and inspection, opens once and never charges supplies", () => {
  const g = create(),
    before = resources(g);
  inspect(g, DRIVE);
  assert.equal(g.readClue("sawmill-last-shift"), false);
  assert.equal(g.exploration.perform(DRIVE, "open-passage"), false);
  assert.equal(g.exploration.offers(DRIVE)[0].enabled, false);
  assert.match(g.exploration.offers(DRIVE)[0].reason, /Памятку/);
  const ledger = SAWMILL.clues.find((n) => n.id === "sawmill-ledger");
  walk(g, ledger);
  assert.ok(g.readClue(ledger.id));
  inspect(g, DRIVE);
  assert.equal(g.exploration.perform(DRIVE, "open-passage"), false);
  const note = SAWMILL.clues.find((n) => n.id === "sawmill-last-shift");
  walk(g, note);
  assert.ok(g.readClue(note.id));
  assert.equal(
    g.exploration.perform(DRIVE, "open-passage"),
    false,
    "reading does not remotely operate the drive",
  );
  inspect(g, DRIVE);
  const version = g.nav.version;
  g.paused = true;
  assert.ok(g.exploration.perform(DRIVE, "open-passage"));
  assert.equal(g.exploration.perform(DRIVE, "open-passage"), false);
  assert.equal(g.nav.version, version + 1);
  assert.deepEqual(g.state.exploration.openedPassages, [
    "sawmill-machine-cache",
  ]);
  assert.equal(resources(g), before);
  assert.deepEqual(g.state.exploration.debrisHP, {});
});

test("the cache is unavailable before the drive opens, and its tag is a unique journal entry, not economic loot", () => {
  const g = create(),
    e = g.exploration,
    p = e.get(TAG);
  walk(g, p);
  assert.equal(e.available(p), false);
  assert.equal(e.request(TAG), false);
  assert.equal(e.perform(TAG, "collect-discovery"), false);
  assert.notEqual(e.nearest()?.id, TAG);
  openDrive(g);
  const before = resources(g);
  inspect(g, TAG);
  assert.equal(e.perform(TAG, "open-chest"), false);
  assert.equal(e.perform(TAG, "sell-relic"), false);
  g.state.gameOver = true;
  assert.equal(e.perform(TAG, "collect-discovery"), false);
  g.state.gameOver = false;
  g.paused = true;
  assert.ok(e.perform(TAG, "collect-discovery"));
  assert.equal(e.perform(TAG, "collect-discovery"), false);
  assert.equal(resources(g), before);
  assert.deepEqual(g.state.exploration.discoveries, [TAG]);
  const entries = e.discoveries();
  assert.equal(entries.length, 1);
  assert.equal(entries[0].name, "Бирка седьмой смены");
  entries[0].text = "UI cannot rewrite the model";
  assert.notEqual(e.discoveries()[0].text, entries[0].text);
  assert.equal(e.available(p), false);
  assert.notEqual(e.nearest()?.id, TAG);
  assert.match(e.regionSummary(SAWMILL.regionId), /Находки: 1\/1/);
});

test("notes obey range, solid obstacles, locked regions, pause and death", () => {
  const n = SAWMILL.clues[0],
    locked = createSimulation({ regional: true, survival: false });
  Object.assign(locked.player, { x: n.x, y: n.y + 40 });
  assert.equal(locked.readClue(n.id), false);
  const g = create();
  assert.equal(g.readClue(n.id), false);
  Object.assign(g.player, { x: n.x, y: n.y + 40, path: [] });
  g.paused = true;
  assert.equal(g.readClue(n.id), false);
  g.paused = false;
  g.state.gameOver = true;
  assert.equal(g.readClue(n.id), false);
  g.state.gameOver = false;
  g.trees.push({ id: "test-note-blocker", x: n.x, y: n.y + 23, hp: 4 });
  g.nav.rebuildObstacles();
  assert.equal(g.readClue(n.id), false);
  g.trees.pop();
  g.nav.rebuildObstacles();
  assert.ok(g.readClue(n.id));
  assert.deepEqual(g.state.readClues, [n.id]);
});

test("revisits retain the cache and personal entry; a fresh game resets the whole local story", () => {
  const g = create();
  openDrive(g);
  inspect(g, TAG);
  assert.ok(g.exploration.perform(TAG, "collect-discovery"));
  walk(g, SAWMILL.entrance);
  g.nav.rebuildObstacles();
  assert.equal(g.exploration.request(TAG), false);
  inspect(g, DRIVE);
  assert.equal(g.exploration.perform(DRIVE, "open-passage"), false);
  assert.equal(g.exploration.discoveries().length, 1);
  const fresh = create();
  assert.deepEqual(fresh.state.readClues, []);
  assert.deepEqual(fresh.state.exploration.openedPassages, []);
  assert.deepEqual(fresh.exploration.discoveries(), []);
  assert.equal(fresh.exploration.available(fresh.exploration.get(TAG)), false);
});
