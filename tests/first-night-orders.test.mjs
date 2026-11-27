import test from "node:test";
import assert from "node:assert/strict";
import { NIGHT_START } from "../game/cycle.js";
import { FORD_SUPPLIES } from "../game/exploration.js";
import { createSimulation } from "../game/simulation.js";
import { createLocalCoop } from "../game/local-coop.js";
import { captureSession, restoreSession } from "../game/session-save.js";

test("the first-night supplies can be reached from camp and claimed once across save and co-op", () => {
  const game = createLocalCoop();
  const [a, b] = game.actors;
  assert.equal(a.exploration.request(FORD_SUPPLIES.id), false);
  a.state.worldTime = NIGHT_START - 59;
  assert.ok(a.exploration.request(FORD_SUPPLIES.id));
  for (let i = 0; i < 400 && !a.exploration.context; i++) game.update(.05);
  assert.equal(a.exploration.context, FORD_SUPPLIES.id);
  assert.ok(a.exploration.perform(FORD_SUPPLIES.id, "take-supplies"));
  assert.equal(a.state.coins, 35);
  assert.equal(b.exploration.available(FORD_SUPPLIES), false);
  assert.equal(a.exploration.perform(FORD_SUPPLIES.id, "take-supplies"), false);
  const resumed = restoreSession(captureSession(game));
  assert.equal(resumed.exploration.available(FORD_SUPPLIES), false);
});

test("an unclaimed cache expires at dawn", () => {
  const game = createSimulation({ regional:true });
  game.state.worldTime = NIGHT_START + 1;
  assert.ok(game.exploration.available(FORD_SUPPLIES));
  game.state.calendarDay = 1;
  assert.equal(game.exploration.available(FORD_SUPPLIES), false);
});

for (const [item, reward] of [["fish", 50], ["resin", 75]]) {
  test(`the ${item} order takes personal inventory only on delivery`, () => {
    const game = createLocalCoop();
    const [a, b] = game.actors;
    Object.assign(a.player,a.sale);
    Object.assign(b.player,b.sale);
    assert.ok(a.orders.accept(item));
    a.state.exploration.items[item] = 1;
    b.state.exploration.items[item] = 2;
    assert.equal(a.orders.deliver(), false);
    assert.equal(a.state.exploration.items[item], 1);
    assert.ok(b.orders.deliver());
    assert.equal(b.state.exploration.items[item], 0);
    assert.equal(a.state.exploration.items[item], 1);
    assert.equal(b.state.coins, reward);
    assert.equal(a.orders.deliver(), false);
  });
}
