import test from "node:test";
import assert from "node:assert/strict";
import { createSimulation } from "../game/simulation.js";
import { STORY } from "../game/story.js";
const create = (emit) =>
  createSimulation({ regional: true, survival: false, emit });
function open(g, id) {
  const gate = g.regions.frontiers().find((p) => p.region.id === id);
  Object.assign(g.player, { x: gate.x, y: gate.y, path: [] });
  while (g.state.wood) g.forestry.takeCargo();
  g.state.maxWood = 82;
  for (let i = 0; i < gate.region.cost; i++) g.forestry.addCargo(10);
  for (let i = 0; i <= gate.region.cost; i++) g.update(0.2);
}
function visit(g, id) {
  const s = g.exploration.get(id);
  Object.assign(g.player, g.nav.nearestGround(s.x, s.y + 42), {
    path: [],
    moving: false,
  });
  assert.ok(g.exploration.request(id));
  return s;
}
function read(g, id) {
  const p = g.world.clues.find((c) => c.id === id);
  Object.assign(g.player, g.nav.nearestGround(p.x, p.y + 32), { path: [] });
  assert.ok(g.readClue(id));
}
function dawn(g) {
  g.state.worldTime = 599.99;
  g.update(0.02);
}
function begin(g, topic = "story:ask-watcher") {
  dawn(g);
  g.state.campLevel = 1;
  g.nav.rebuildObstacles();
  read(g, "note");
  open(g, "0:1");
  read(g, "merchant-note");
  visit(g, "mysterious-merchant");
  assert.ok(g.exploration.perform("mysterious-merchant", topic));
}
function collect(g, skipNote = null) {
  open(g, "0:-1");
  if (skipNote !== "ruins-note") read(g, "ruins-note");
  visit(g, "chest:0:-1:0");
  g.state.exploration.items.key = 1;
  assert.ok(g.exploration.perform("chest:0:-1:0", "open-chest"));
  open(g, "-1:0");
  if (skipNote !== "pond-note") read(g, "pond-note");
  visit(g, "fishing");
  g.state.exploration.rod = true;
  assert.ok(g.exploration.perform("fishing", "fish"));
  for (let i = 0; i < 150 && g.exploration.fishing?.phase !== "bite"; i++)
    g.update(0.05);
  assert.ok(g.exploration.reel());
  open(g, "1:0");
  if (skipNote !== "oak-note") read(g, "oak-note");
  visit(g, "ancient-roots");
  for (let i = 0; i < 3; i++) g.forestry.addCargo(11);
  assert.ok(g.exploration.perform("ancient-roots", "offer-logs"));
}
function decode(g) {
  while (g.state.nightsSurvived < 3) dawn(g);
  visit(g, "mysterious-merchant");
  assert.ok(
    g.exploration.perform("mysterious-merchant", "story:show-evidence"),
  );
}

test("chapter begins only after a survived night; reading real camp clue advances after a fire exists", () => {
  const events = [],
    g = create((t, e) => events.push([t, e]));
  assert.equal(g.story.overview().phase, 0);
  assert.equal(g.story.pages().length, 0);
  assert.equal(g.readClue("note"), false);
  assert.equal(g.readClue("forged"), false);
  read(g, "note");
  assert.equal(g.story.overview().phase, 0);
  dawn(g);
  assert.equal(g.story.overview().phase, 1);
  g.state.campLevel = 1;
  g.story.sync();
  assert.equal(g.story.overview().phase, 2);
  g.story.sync();
  assert.equal(g.story.pages().filter((p) => p.id === "invitation").length, 1);
  assert.equal(
    events.filter(([t, e]) => t === "clue-read" && e.id === "note").length,
    1,
  );
});
test("world clues reject locked, remote, paused and occluded reading", () => {
  const g = create();
  assert.equal(g.readClue("ruins-note"), false);
  g.paused = true;
  assert.equal(g.readClue("note"), false);
  g.paused = false;
  assert.equal(g.state.readClues.length, 0);
  const c = g.world.clues.find((c) => c.id === "note");
  Object.assign(g.player, { x: c.x + 40, y: c.y, path: [] });
  const los = g.nav.hasLineOfSight;
  g.nav.hasLineOfSight = () => false;
  assert.equal(g.readClue(c.id), false);
  g.nav.hasLineOfSight = los;
});
test("dialogue needs the current merchant inspection and note; choice is recorded once and survives revisits", () => {
  const g = create();
  dawn(g);
  g.state.campLevel = 1;
  read(g, "note");
  open(g, "0:1");
  visit(g, "mysterious-merchant");
  assert.equal(
    g.exploration.perform("mysterious-merchant", "story:ask-watcher"),
    false,
  );
  read(g, "merchant-note");
  assert.equal(
    g.exploration.perform("mysterious-merchant", "story:ask-watcher"),
    false,
  );
  visit(g, "mysterious-merchant");
  g.paused = true;
  assert.ok(g.exploration.perform("mysterious-merchant", "story:ask-contract"));
  assert.equal(g.state.story.traderTopic, "contract");
  assert.equal(
    g.exploration.perform("mysterious-merchant", "story:ask-watcher"),
    false,
  );
  assert.equal(g.story.overview().phase, 3);
  assert.ok(g.story.conversation("mysterious-merchant").includes("Подписи"));
});
test("early evidence and sold economic goods cannot softlock chapter progress", () => {
  const g = create();
  collect(g);
  assert.equal(g.story.overview().phase, 0);
  assert.ok(g.story.evidence.every((e) => e.identified));
  open(g, "0:1");
  visit(g, "mysterious-merchant");
  assert.ok(g.exploration.perform("mysterious-merchant", "sell-fish"));
  assert.ok(g.exploration.perform("mysterious-merchant", "sell-relic"));
  while (g.state.exploration.items.resin) g.state.exploration.items.resin--; // Crafting may consume all resin; proof is a personal record.
  dawn(g);
  g.state.campLevel = 1;
  read(g, "note");
  read(g, "merchant-note");
  visit(g, "mysterious-merchant");
  assert.ok(g.exploration.perform("mysterious-merchant", "story:ask-watcher"));
  assert.equal(g.story.overview().phase, 4);
  assert.equal(
    g.exploration.perform("mysterious-merchant", "story:show-evidence"),
    false,
  );
  decode(g);
  assert.equal(g.story.overview().phase, 5);
  assert.equal(g.state.exploration.items.fish, 0);
  assert.equal(g.state.exploration.items.relic, 0);
});
test("all three proofs and their notes are needed; revisits never duplicate pages or quest items", () => {
  const g = create();
  begin(g);
  collect(g);
  assert.equal(g.story.overview().phase, 4);
  assert.equal(g.story.evidence.length, 3);
  const pages = g.story.pages().length;
  g.story.sync();
  g.story.sync();
  assert.equal(g.story.pages().length, pages);
  assert.equal(g.state.exploration.totalFishCaught, 1);
  // Identification depends on the note, not just possessing a tradable item.
  const h = create();
  h.state.exploration.items.relic = 10;
  h.story.sync();
  assert.equal(h.story.evidence.find((e) => e.id === "seal").found, false);
});
test("both final choices require fifth dawn, daytime, tent and camp inspection, then pay once without consuming supplies", () => {
  for (const action of ["story:sign-name", "story:leave-mark"]) {
    const events = [],
      g = create((t, e) => events.push([t, e]));
    begin(g);
    collect(g);
    decode(g);
    visit(g, "camp-kitchen");
    assert.equal(g.exploration.perform("camp-kitchen", action), false);
    while (g.state.nightsSurvived < 5) dawn(g);
    visit(g, "camp-kitchen");
    assert.equal(g.exploration.perform("camp-kitchen", action), false);
    g.state.campLevel = 2;
    g.nav.rebuildObstacles();
    g.state.worldTime = 450;
    assert.equal(g.exploration.perform("camp-kitchen", action), false);
    g.state.worldTime = 120;
    const coins = g.state.coins,
      items = { ...g.state.exploration.items };
    assert.ok(g.exploration.perform("camp-kitchen", action));
    assert.equal(g.state.coins, coins + STORY.reward);
    assert.deepEqual(g.state.exploration.items, items);
    assert.equal(g.story.overview().phase, 6);
    assert.equal(
      g.state.story.ending,
      action.endsWith("name") ? "named" : "marked",
    );
    assert.equal(g.exploration.perform("camp-kitchen", action), false);
    g.story.sync();
    dawn(g);
    assert.equal(g.state.coins, coins + STORY.reward);
    assert.equal(events.filter(([t]) => t === "story-completed").length, 1);
  }
});
test("forged site kinds, remote turn-ins and defeat cannot finish a chapter or grant rewards", () => {
  const g = create();
  begin(g);
  collect(g);
  decode(g);
  while (g.state.nightsSurvived < 5) dawn(g);
  g.state.campLevel = 2;
  const s = visit(g, "mysterious-merchant"),
    coins = g.state.coins;
  assert.equal(
    g.story.performAt({ ...s, kind: "kitchen" }, "story:sign-name"),
    false,
  );
  assert.equal(
    g.story.performAt(g.exploration.get("camp-kitchen"), "story:sign-name"),
    false,
  );
  visit(g, "camp-kitchen");
  g.state.gameOver = true;
  assert.equal(g.exploration.perform("camp-kitchen", "story:sign-name"), false);
  assert.equal(g.state.coins, coins);
});
test("story routes guide to a locked region's paid frontier and never unlock or teleport", () => {
  const g = create();
  const p = { x: g.player.x, y: g.player.y };
  assert.ok(g.navigateStory({ kind: "clue", id: "merchant-note" }));
  assert.deepEqual({ x: g.player.x, y: g.player.y }, p);
  assert.equal(g.state.unlockedRegions.length, 1);
  assert.equal(g.player.targetY, 2488);
  g.paused = true;
  assert.equal(g.navigateStory(), false);
  g.paused = false;
  assert.equal(g.navigateStory({ kind: "site", id: "invented" }), false);
});
test("story pages are explicitly read once, unknown pages are rejected, and a new run resets the chapter", () => {
  const g = create();
  dawn(g);
  assert.equal(g.story.unread, 1);
  assert.equal(g.story.readPage("invented"), false);
  assert.ok(g.story.readPage("invitation"));
  assert.equal(g.story.unread, 0);
  assert.ok(g.story.readPage("invitation"));
  const h = create();
  assert.equal(h.state.story.phase, 0);
  assert.equal(h.story.unread, 0);
  assert.equal(h.state.story.rewardClaimed, false);
});

test("each missing interpretation note keeps the chapter at three witnesses until it is read", () => {
  for (const id of ["ruins-note", "pond-note", "oak-note"]) {
    const g = create();
    begin(g);
    collect(g, id);
    assert.equal(g.story.overview().phase, 3, id);
    assert.ok(g.story.evidence.every((e) => e.found));
    read(g, id);
    assert.equal(g.story.overview().phase, 4, id);
  }
});
