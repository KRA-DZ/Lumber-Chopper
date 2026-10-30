import test from "node:test";
import assert from "node:assert/strict";
import { createSimulation } from "../game/simulation.js";
import { applyUpgrades } from "../economy.js";
import { createInitialState } from "../game/config.js";
import { createCycleManager } from "../game/cycle.js";
import {
  firstDaysPlan,
  dayOverview,
  countdown,
  shopAdvice,
} from "../game/first-days.js";
import { playFirstDay } from "./helpers/first-day.mjs";
const create = (emit) => createSimulation({ regional: true, emit });
test("timeline counts active seconds until dusk, dawn and exactly each fifth raid", () => {
  const s = createInitialState();
  let t = dayOverview(s);
  assert.equal(t.boundarySeconds, 180);
  assert.equal(t.raidSeconds, 2580);
  assert.equal(t.nextRaid, 5);
  s.worldTime = 285;
  assert.ok(dayOverview(s).sunsetUrgent);
  s.worldTime = 300;
  t = dayOverview(s);
  assert.ok(t.night);
  assert.equal(t.boundarySeconds, 300);
  s.calendarDay = 4;
  t = dayOverview(s);
  assert.ok(t.raidActive);
  assert.equal(t.raidSeconds, 0);
  s.calendarDay = 5;
  s.worldTime = 0;
  t = dayOverview(s);
  assert.equal(t.nextRaid, 10);
  assert.equal(t.raidSeconds, 2700);
  assert.equal(countdown(0.01), "00:01");
  assert.equal(countdown(60), "01:00");
  assert.equal(countdown(0), "00:00");
});
test("sunset warnings fire once per threshold, even over multiple days and zero-time updates", () => {
  const s = createInitialState(),
    events = [],
    clock = createCycleManager(s, (type, e) => events.push([type, e]));
  clock.update(120);
  assert.deepEqual(events, [
    ["sunset-warning", { night: 1, seconds: 60, raid: false }],
  ]);
  clock.update(0);
  clock.update(45);
  clock.update(15);
  clock.update(600);
  const warnings = events.filter(([t]) => t === "sunset-warning");
  assert.deepEqual(
    warnings.map(([, e]) => [e.night, e.seconds]),
    [
      [1, 60],
      [1, 15],
      [2, 60],
      [2, 15],
    ],
  );
  s.calendarDay = 4;
  s.worldTime = 239.99;
  clock.update(0.02);
  assert.equal(events.at(-1)[1].raid, true);
});
test("warning expiry and tutorial safety timers stop while paused", () => {
  const g = create();
  g.state.worldTime = 239.99;
  g.update(0.02);
  assert.ok(g.sunsetWarning);
  const until = g.sunsetWarning.until,
    time = g.state.worldTime;
  g.paused = true;
  g.update(90);
  assert.equal(g.sunsetWarning.until, until);
  assert.equal(g.state.worldTime, time);
  g.paused = false;
  g.update(8);
  assert.equal(g.sunsetWarning, null);
  g.state.worldTime = 299.99;
  g.update(0.02);
  g.paused = true;
  g.update(10);
  assert.equal(g.tutorial.sheltered, false);
  g.paused = false;
  g.update(3.1);
  assert.equal(g.tutorial.sheltered, true);
});
test("safety guidance takes priority without marking economic objectives complete", () => {
  const g = create();
  g.state.worldTime = 250;
  assert.equal(g.guide.id, "sunset");
  assert.equal(g.tutorialStep, 0);
  g.state.worldTime = 299.99;
  g.update(0.02);
  g.player.x = 2100;
  g.player.y = 1600;
  assert.equal(g.guide.id, "return");
  assert.equal(g.guide.action, "camp");
  assert.equal(g.tutorialStep, 0);
  const pos = { x: g.player.x, y: g.player.y };
  assert.ok(g.navigateGuide("camp"));
  assert.deepEqual({ x: g.player.x, y: g.player.y }, pos);
  assert.ok(g.player.path.length);
  g.paused = true;
  assert.equal(g.navigateGuide("camp"), false);
});
test("first-day budget earns carry, a fire and an axe by walking before dusk, then survives to the letter", () => {
  const g = create(),
    samples = playFirstDay(g);
  assert.ok(samples.returnSeconds < 180, JSON.stringify(samples));
  assert.equal(g.state.carryLevel, 1);
  assert.equal(g.state.axeLevel, 1);
  assert.equal(g.state.campLevel, 1);
  assert.equal(g.state.health, 100);
  assert.ok(g.state.coins >= 0);
  assert.equal(g.guide.id, "prepare");
  g.update(300 - g.state.worldTime + 0.02);
  g.update(3.1);
  assert.equal(g.tutorial.sheltered, true);
  g.update(600 - g.state.worldTime + 0.02);
  assert.equal(g.state.nightsSurvived, 1);
  assert.equal(g.state.health, 100);
  assert.equal(g.guide.id, "letter");
  g.lore.read({ id: "first-dawn" });
  assert.ok(g.lore.claim("warm-dawn"));
  assert.equal(g.guide.id, "plan");
});
test("daily plans remain optional, reflect actual accomplishments and pay no automatic rewards", () => {
  const g = create(),
    before = g.state.coins;
  g.state.calendarDay = 3;
  assert.equal(
    firstDaysPlan(g)[1].goals.every(([, done]) => done),
    false,
  );
  g.state.campLevel = 3;
  g.state.axeLevel = 1;
  g.state.unlockedRegions.push("1:0");
  g.lore.read({ id: "oak-note" });
  const plan = firstDaysPlan(g);
  assert.ok(plan[2].goals.every(([, done]) => done));
  assert.ok(plan[3].goals.every(([, done]) => done));
  assert.equal(g.state.coins, before);
  assert.equal(shopAdvice(createInitialState()).id, "carry");
  g.state.carryLevel = 1;
  g.state.axeLevel = 0;
  assert.equal(shopAdvice(g.state).id, "axe");
});

test("fire guidance gathers a useful load but accepts the last single log needed", () => {
  const g = create();
  g.tutorial.cut = true;
  g.tutorial.sold = true;
  g.state.carryLevel = 1;
  applyUpgrades(g.state);
  g.forestry.addCargo(10);
  assert.equal(g.guide.action, "trees");
  g.state.buildWood = 9;
  assert.equal(g.guide.action, "build");
});
