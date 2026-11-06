import { NIGHT_START } from "../game/cycle.js";
import test from "node:test";
import assert from "node:assert/strict";
import { createSimulation } from "../game/simulation.js";

function fixture(logs = 4) {
  const g = createSimulation({ regional: true });
  g.state.campLevel = 3;
  g.state.maxWood = 82;
  g.nav.rebuildObstacles();
  const section = g.defenses.all().find((s) => s.kind === "fence");
  g.defenses.damage(section.id, 60);
  Object.assign(g.player, g.nav.nearestGround(section.x, section.y + 40), {
    path: [],
    autoTimer: 10000,
  });
  for (let i = 0; i < logs; i++) g.forestry.addCargo(7);
  return { g, section };
}

test("a completed hold consumes one exact cargo log, closes the real gap and exposes progress", () => {
  const { g, section } = fixture();
  const version = g.nav.version;
  assert.ok(g.setDefenseRepairHeld(true, section.id));
  g.update(0.59);
  assert.equal(g.state.wood, 4);
  assert.equal(g.defenses.get(section.id).hp, 0);
  assert.ok(g.defenseRepair.progress > 0.9);
  g.update(0.02);
  assert.equal(g.defenses.get(section.id).hp, 20);
  assert.equal(g.state.wood, 3);
  assert.equal(g.state.cargoValue, 21);
  assert.ok(g.nav.version > version);
  assert.ok(!g.nav.isWalkable(section.x, section.y));
  assert.ok(g.nav.isWalkable(g.player.x, g.player.y));
  g.setDefenseRepairHeld(false);
  g.update(2);
  assert.equal(g.state.wood, 3);
  assert.equal(g.defenseRepair.progress, 0);
});

test("release discards only unfinished work; full repair stops and never bills another section", () => {
  const { g, section } = fixture();
  g.setDefenseRepairHeld(true, section.id);
  g.update(0.4);
  g.setDefenseRepairHeld(false);
  g.setDefenseRepairHeld(true, section.id);
  g.update(0.3);
  assert.equal(g.state.wood, 4);
  g.update(1.51);
  assert.equal(g.defenses.get(section.id).hp, 60);
  assert.equal(g.state.wood, 1);
  assert.equal(g.defenseRepair, null);
  g.update(1);
  assert.equal(g.state.wood, 1);
});

test("repair cannot charge while paused, remote, moving, empty or defeated, including after a pause", () => {
  const { g, section } = fixture(1);
  assert.equal(g.setDefenseRepairHeld(true, "unknown"), false);
  assert.equal(g.setDefenseRepairHeld(true, "trap-left"), false);
  g.player.x = 1600;
  g.player.y = 1600;
  assert.equal(g.setDefenseRepairHeld(true, section.id), false);
  Object.assign(g.player, g.nav.nearestGround(section.x, section.y + 40));
  g.setDefenseRepairHeld(true, section.id);
  g.update(0.4);
  g.paused = true;
  assert.equal(g.setDefenseRepairHeld(true, section.id), false);
  g.update(10);
  assert.equal(g.state.wood, 1);
  g.paused = false;
  g.update(0.4);
  assert.equal(g.state.wood, 1);
  g.setDefenseRepairHeld(true, section.id);
  g.keys.add("KeyW");
  g.update(0.05);
  assert.equal(g.defenseRepair, null);
  g.clearKeys();
  Object.assign(g.player, g.nav.nearestGround(section.x, section.y + 40), {
    path: [],
  });
  g.setDefenseRepairHeld(true, section.id);
  g.update(0.61);
  assert.equal(g.state.wood, 0);
  g.update(4);
  assert.equal(g.defenses.get(section.id).hp, 20);
  g.state.gameOver = true;
  assert.equal(g.setDefenseRepairHeld(true, section.id), false);
});

test("zero time cannot repair; a ground destination cancels the manual target", () => {
  const { g, section } = fixture();
  g.setDefenseRepairHeld(true, section.id);
  g.update(0);
  g.update(NaN);
  g.update(-1);
  assert.equal(g.defenseRepair.progress, 0);
  assert.equal(g.state.wood, 4);
  g.setDestination(1600, 1700);
  assert.equal(g.defenseRepair, null);
});

test("a destroyed barricade is rebuilt by three completed holds without inventing partial HP", () => {
  const { g } = fixture(8);
  const section = g.defenses.get("barricade-left");
  Object.assign(g.player, g.nav.nearestGround(section.x, section.y + 44), {
    path: [],
  });
  for (let i = 0; i < 3; i++) {
    assert.ok(g.transferOneLog(section.id));
    g.update(0.31);
  }
  g.defenses.damage(section.id, 60);
  assert.ok(g.setDefenseRepairHeld(true, section.id));
  g.update(1.21);
  assert.equal(g.defenses.get(section.id).wood, 2);
  assert.equal(g.defenses.get(section.id).hp, 0);
  g.update(0.61);
  assert.equal(g.defenses.get(section.id).hp, 60);
  assert.equal(g.state.wood, 2);
  assert.equal(g.defenseRepair, null);
});

test("raid day dawn announces preparation once without starting the hunt or changing wave timing", () => {
  const g = createSimulation({ regional: true });
  g.state.calendarDay = 3;
  g.state.worldTime = 599.99;
  g.update(0.02);
  assert.equal(g.sunsetWarning.morning, true);
  assert.equal(g.sunsetWarning.raid, true);
  assert.match(g.notice, /Метатели/);
  assert.equal(g.survival.minionHunt, false);
  assert.equal(g.survival.wave, null);
  g.paused = true;
  g.update(20);
  assert.equal(g.sunsetWarning.morning, true);
  g.paused = false;
  g.update(11);
  assert.equal(g.sunsetWarning, null);
  g.state.worldTime = NIGHT_START - .01;
  g.update(0.02);
  assert.equal(g.survival.minionHunt, true);
  assert.equal(g.survival.wave.status, "warning");
});

test("the dawn report covers damage after the paid wave, local kills, repaired breaches and never pays twice", () => {
  const { g, section } = fixture(3);
  g.transferOneLog(section.id);
  g.update(0.31);
  g.transferOneLog(section.id);
  g.update(0.31);
  g.transferOneLog(section.id);
  g.update(0.31);
  const region = g.regions.all.find((r) => r.id === "1:0");
  g.regions.unlocked.add(region.id);
  g.world.generate(region);
  g.nav.rebuildObstacles();
  g.state.calendarDay = 4;
  g.state.worldTime = NIGHT_START - .01;
  g.update(0.02);
  g.update(12.1);
  for (const enemy of [...g.survival.raiders])
    g.survival.hit(enemy.id, enemy.maxHP, false);
  assert.equal(g.survival.wave.status, "won");
  assert.equal(g.state.coins, 60);
  assert.equal(g.state.lastRaidReport, null);
  const small = g.survival.minions[0],
    boss = g.survival.regionalBosses[0];
  assert.ok(small && boss);
  g.survival.hit(small.id, small.maxHP, false);
  g.survival.hit(boss.id, boss.maxHP, false);
  g.defenses.damage(section.id, 999); // Effective damage is 60, not the requested 999.
  g.forestry.addCargo(7);
  Object.assign(g.player, g.nav.nearestGround(section.x, section.y + 40), {
    path: [],
  });
  g.setDefenseRepairHeld(true, section.id);
  g.update(0.61);
  g.setDefenseRepairHeld(false);
  g.state.worldTime = 599.99;
  g.update(0.02);
  const report = g.state.lastRaidReport;
  assert.equal(report.night, 5);
  assert.equal(report.survived, true);
  assert.equal(report.killed, 3);
  assert.equal(report.spawned, 3);
  assert.equal(report.minions, 1);
  assert.equal(report.bosses, 1);
  assert.equal(report.defenseDamage, 60);
  assert.equal(report.brokenSections, 1);
  assert.equal(report.damaged.length, 1);
  assert.equal(report.damaged[0].hp, 20);
  assert.equal(report.repairLogs, 2);
  assert.equal(report.reward, 60);
  assert.equal(g.state.coins, 60);
  assert.equal(g.state.raidsWon, 1);
  g.update(0.2);
  assert.equal(g.state.lastRaidReport, report);
  assert.equal(g.state.coins, 60);
  assert.equal(createSimulation({ regional: true }).state.lastRaidReport, null);
});

test("a withdrawn wave reports zero reward, and ordinary nights cannot replace the last raid report", () => {
  const { g } = fixture();
  g.state.calendarDay = 4;
  g.state.worldTime = NIGHT_START - .01;
  g.update(0.02);
  g.update(12.1);
  g.state.worldTime = 599.99;
  g.update(0.02);
  const report = g.state.lastRaidReport;
  assert.equal(report.status, "withdrawn");
  assert.equal(report.reward, 0);
  assert.equal(g.state.coins, 0);
  assert.equal(g.state.raidsWon, 0);
  g.state.worldTime = NIGHT_START - .01;
  g.update(0.02);
  g.state.worldTime = 599.99;
  g.update(0.02);
  assert.equal(g.state.lastRaidReport, report);
});

test("a lethal camp strike records effective HP damage and closes the report without a reward", () => {
  const { g } = fixture();
  g.state.calendarDay = 4;
  g.state.worldTime = NIGHT_START - .01;
  g.update(0.02);
  g.update(12.1);
  Object.assign(g.player, g.nav.nearestGround(1600, 1880), { path: [] });
  for (const enemy of g.survival.raiders) enemy.warning = 1000;
  const attacker = g.survival.raiders.find((e) => e.role === "attacker");
  Object.assign(attacker, {
    x: 1600,
    y: 1600,
    warning: 0,
    path: [],
    targetKey: "camp",
    windup: 0.39,
    cooldown: 0,
  });
  g.state.campHealth = 7;
  g.update(0.02);
  assert.equal(g.state.gameOver, true);
  assert.equal(g.state.lastRaidReport.survived, false);
  assert.equal(g.state.lastRaidReport.campDamage, 7);
  assert.equal(g.state.lastRaidReport.campHealth, 0);
  assert.equal(g.state.lastRaidReport.reward, 0);
  assert.equal(g.state.coins, 0);
});
