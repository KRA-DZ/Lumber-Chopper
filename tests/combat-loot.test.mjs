import { NIGHT_START } from "../game/cycle.js";
import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState } from "../game/config.js";
import {
  createCombatLoot,
  COMBAT_LOOT,
  affordableCombatUpgrades,
} from "../game/combat-loot.js";
import { buyUpgrade, upgradeOffer } from "../economy.js";
import { createSimulation } from "../game/simulation.js";
import { playFirstDay } from "./helpers/first-day.mjs";
function fixture() {
  const state = createInitialState(),
    player = { x: 1000, y: 1000 };
  let active = true,
    reachable = true;
  const loot = createCombatLoot({
    state,
    player,
    canAct: () => active,
    accessible: () => true,
    canReach: () => reachable,
  });
  const minion = (id, x = 0, y = 0) => ({
    id,
    x,
    y,
    kind: "minion",
    regionId: "1:0",
  });
  const boss = (id, regionId = "1:0") => ({
    id,
    kind: "boss",
    regionId,
    x: 0,
    y: 0,
  });
  return {
    state,
    player,
    loot,
    minion,
    boss,
    pause: () => (active = false),
    resume: () => (active = true),
    block: () => (reachable = false),
    unblock: () => (reachable = true),
  };
}
test("a defeated minion leaves a pile; nearby automatic pickup preserves the log stack exactly", () => {
  const f = fixture();
  f.state.cargo = [7, 9];
  f.state.wood = 2;
  f.state.cargoValue = 16;
  assert.ok(f.loot.drop(f.minion("small-0")));
  f.loot.update(0.2);
  assert.equal(f.state.coins, 0);
  Object.assign(f.player, { x: 0, y: 0 });
  f.loot.update(0.2);
  assert.equal(f.state.coins, COMBAT_LOOT.minionCoins);
  assert.equal(f.state.combatLoot.coinsCollected, COMBAT_LOOT.minionCoins);
  assert.equal(f.state.wood, 2);
  assert.equal(f.state.cargoValue, 16);
  assert.deepEqual(f.state.cargo, [7, 9]);
  assert.equal(f.loot.drop(f.minion("small-0")), false);
});
test("boss loot is guaranteed once per region/night, not once per replacement actor ID", () => {
  const f = fixture();
  assert.equal(f.loot.drop(f.boss("daytime")), false);
  f.state.worldTime = NIGHT_START + 30;
  assert.ok(f.loot.drop(f.boss("boss-1")));
  assert.equal(f.loot.drop(f.boss("boss-1")), false);
  assert.equal(f.loot.drop(f.boss("replacement")), false);
  Object.assign(f.player, { x: 0, y: 0 });
  f.loot.update(0.2);
  assert.equal(f.state.coins, COMBAT_LOOT.bossCoins);
  assert.equal(f.state.exploration.items.resin, 1);
  f.state.calendarDay++;
  f.loot.update(0.2);
  assert.ok(f.loot.drop(f.boss("next-night")));
  f.loot.update(0.2);
  assert.equal(f.state.coins, 2*COMBAT_LOOT.bossCoins);
});
test("day and dusk share the small-enemy budget, no drop rerolls, and only dawn renews it", () => {
  const f = fixture();
  for (let i = 0; i < 90; i++) f.loot.drop(f.minion(`small-${i}`));
  assert.equal(f.state.combatLoot.smallCoins, COMBAT_LOOT.minionDailyCoins);
  assert.equal(f.state.combatLoot.smallResin, 2);
  f.state.worldTime = NIGHT_START + 30;
  assert.equal(f.loot.drop(f.minion("dusk-new")), false);
  assert.equal(f.state.combatLoot.smallCoins, COMBAT_LOOT.minionDailyCoins);
  f.loot.update(COMBAT_LOOT.lifetime + 1);
  assert.equal(f.loot.piles.size, 0);
  assert.equal(f.loot.drop(f.minion("small-0")), false);
  f.state.calendarDay++;
  f.loot.drop(f.minion("next-day"));
  assert.equal(f.state.combatLoot.smallCoins, COMBAT_LOOT.minionCoins);
  assert.ok(f.state.combatLoot.smallResin <= 1);
  assert.ok(COMBAT_LOOT.minionDailyCoins < upgradeOffer(f.state, "axe").price);
});
test("a full resin bag still accepts coins and retains excess resin for later pickup", () => {
  const f = fixture();
  f.state.worldTime = NIGHT_START + 30;
  f.state.exploration.items.resin = 6;
  f.loot.drop(f.boss("full-bag"));
  Object.assign(f.player, { x: 0, y: 0 });
  f.loot.update(0.2);
  assert.equal(f.state.coins, COMBAT_LOOT.bossCoins);
  assert.equal(f.state.exploration.items.resin, 6);
  assert.equal(f.loot.piles.size, 1);
  assert.equal([...f.loot.piles.values()][0].coins, 0);
  f.state.exploration.items.resin--;
  f.loot.update(0.2);
  assert.equal(f.state.exploration.items.resin, 6);
  assert.equal(f.loot.piles.size, 0);
  assert.equal(f.state.coins, COMBAT_LOOT.bossCoins);
});
test("pause, zero-time, blocked pickup and active-time expiry cannot create or remotely collect rewards", () => {
  const f = fixture();
  f.loot.drop(f.minion("waiting"));
  Object.assign(f.player, { x: 0, y: 0 });
  f.pause();
  f.loot.update(1000);
  assert.equal(f.loot.drop(f.minion("paused")), false);
  assert.equal([...f.loot.piles.values()][0].age, 0);
  f.resume();
  f.loot.update(0);
  f.loot.update(NaN);
  assert.equal(f.state.coins, 0);
  f.block();
  f.loot.update(0.2);
  assert.equal(f.state.coins, 0);
  f.unblock();
  f.loot.update(0.2);
  assert.equal(f.state.coins, COMBAT_LOOT.minionCoins);
  f.pause();
  assert.equal(f.loot.drop(f.minion("defeated")), false);
});
test("piles remain bounded and earned combat coins enable a real shop purchase only once", () => {
  const f = fixture();
  f.state.worldTime = NIGHT_START + 30;
  for (let i = 0; i < 25; i++) f.loot.drop(f.boss(`b${i}`, `region-${i}`));
  assert.equal(f.loot.piles.size, COMBAT_LOOT.maxPiles);
  Object.assign(f.player, { x: 0, y: 0 });
  f.loot.update(0.2);
  assert.ok(affordableCombatUpgrades(f.state).some((o) => o.id === "carry"));
  assert.ok(buyUpgrade(f.state, "carry"));
  assert.equal(f.state.maxWood, 4);
  assert.equal(f.state.coins, COMBAT_LOOT.bossCoins-20);
  assert.equal(buyUpgrade(f.state, "carry"), false);
  assert.equal(f.state.combatLoot.coinsCollected, COMBAT_LOOT.bossCoins);
});

test("real harvesting funds the first axe, a neighbouring region, combat pickup and a fence before the fifth dusk", () => {
  const g = createSimulation({ regional: true });
  function tickUntil(condition, seconds = 90) {
    for (let i = 0; i < seconds * 20 && !condition() && !g.state.gameOver; i++)
      g.update(0.05);
    assert.ok(
      condition(),
      `Route timed out at ${g.elapsed}: ${g.state.defeatReason}`,
    );
  }
  function travel(action) {
    assert.ok(g.navigateGuide(action));
    tickUntil(() => !g.player.path.length);
  }
  function gather() {
    if (g.cycle.isNight) {
      travel("camp");
      tickUntil(() => !g.cycle.isNight, 310);
    }
    while (g.state.wood < g.state.maxWood) {
      const before = g.state.wood;
      travel("trees");
      tickUntil(() => g.state.wood > before, 20);
    }
  }
  const times = playFirstDay(g);
  assert.ok(times.axeSeconds < 180);
  assert.equal(g.state.axeLevel, 1);
  while (!g.regions.unlocked.has("1:0")) {
    gather();
    const gate = g.regions.frontiers().find((gate) => gate.region.id === "1:0");
    g.setDestination(gate.x, gate.y);
    tickUntil(() => !g.state.wood || g.regions.unlocked.has("1:0"));
  }
  g.update(6.5);
  const enemy = g.survival.minions.find((enemy) => enemy.role === "melee");
  assert.ok(enemy);
  g.setDestination(enemy.x, enemy.y);
  tickUntil(
    () => Math.hypot(enemy.x - g.player.x, enemy.y - g.player.y) < 550,
    45,
  );
  const coins = g.state.coins;
  g.selectEnemy(enemy.id);
  tickUntil(() => !g.survival.minions.some((e) => e.id === enemy.id), 60);
  const pile = [...g.combatLoot.piles.values()][0];
  if (pile) {
    g.setDestination(pile.x, pile.y);
    tickUntil(() => !g.combatLoot.piles.has(pile.id));
  }
  assert.equal(g.state.coins, coins + COMBAT_LOOT.minionCoins);
  assert.equal(g.state.combatLoot.coinsCollected, COMBAT_LOOT.minionCoins);
  gather();
  travel("sell");
  tickUntil(() => !g.state.wood, 310);
  assert.ok(g.purchaseUpgrade("carry"));
  while (g.state.campLevel < 3) {
    gather();
    travel("build");
    if(g.state.campLevel < 3 && !g.builder.project){
      assert.ok(g.builder.choose(g.state.campLevel===1?"tent":"fence"));
      g.setDestination(g.build.x+100,g.build.y);tickUntil(()=>!g.player.path.length);travel("build");
    }
    tickUntil(() => !g.state.wood || g.state.campLevel >= 3 || !g.builder.project);
  }
  assert.ok(g.state.calendarDay < 4);
  travel("camp");
  assert.equal(g.state.gameOver, false);
  assert.equal(g.state.campLevel, 3);
  assert.equal(g.state.campHealth, g.state.maxCampHealth);
  // Long unattended waits are no longer safe: later nights require earned fuel.
  assert.equal(g.survival.minionHunt, false);
});
