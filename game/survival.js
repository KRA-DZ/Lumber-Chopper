import { hasCampBuilding } from "./camp-projects.js";
import { industryLevel } from "./camp-industry-config.js";
import { createBiomeEnemies } from "./biome-enemies.js";
import { createMinions } from "./minions.js";
import { createRaiderAI, RAIDER_ROLES } from "./raiders.js";
import { createWatcher, WATCHER } from "./watcher.js";
import { CENTER, RAID_INTERVAL } from "./config.js";
export const SURVIVAL = Object.freeze({
  monsterSpeed: 190, // Near the starting hero's 200: little room to waste time while chased.
  monsterDamage: 40,
  monsterWindup: 0.06, // Contact strike tracks the hero until impact; cover/light still protect.
  playerInvulnerability: 1.4,
  warningSeconds: 12,
  waveEvery: RAID_INTERVAL,
  maxRaiders: 8,
  repairPerLog: 20,
});
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
// Engine-independent night director; each bounded enemy group shares a path-search budget.
export function createSurvival({
  state,
  player,
  nav,
  accessible,
  emit,
  defeat,
  defenses,
  regions = null,
  sanctuary = () => null,
  party = null,
}) {
  const raiders = [];
  let monster = null,
    pending = 0,
    sequence = 0,
    warningTimer = 0,
    pathCooldown = 0,
    hitCooldown = 0,
    pathCursor = 0,
    wave = null;
  const safeRadius = () => hasCampBuilding(state,"fire") && state.campFuel > 0 ? 310+industryLevel(state,"fire")*20 : 0;
  const safeZone = p => p.room ? { x: p.x, y: p.y, r: 100 } : safeRadius() > 0 && distance(p, CENTER) < safeRadius()
    ? { ...CENTER, r: safeRadius() } : sanctuary(p);
  const isSafe = p => !!safeZone(p);
  const residents = regions
    ? createBiomeEnemies({
        state,
        player,
        regions,
        nav,
        isSafe,
        hurtPlayer,
        emit,
        party,
      })
    : null;
  const minions = regions
    ? createMinions({
        state,
        player,
        regions,
        nav,
        isSafe,
        defenses,
        hurtPlayer,
        emit,
        party,
      })
    : null;
  function spawnPoint(around, radius, phase = 0) {
    for (let i = 0; i < 16; i++) {
      const a = phase + i * 2.399,
        p = nav.nearestGround(
          around.x + Math.cos(a) * radius,
          around.y + Math.sin(a) * radius,
        );
      if (
        accessible(p) &&
        distance(p, player) > 260 &&
        distance(p, CENTER) > safeRadius() + 60
      )
        return p;
    }
    return null;
  }
  const watcher = createWatcher({
    player,
    nav,
    accessible,
    isSafe,
    safeRadius,
    sanctuary: safeZone,
    emit,
    hurt: hurtPlayer,
    damage: SURVIVAL.monsterDamage,
    windupSeconds: SURVIVAL.monsterWindup,
  });
  function nightStarted({ night }) {
    watcher.reset();
    raiders.length = 0;
    warningTimer = SURVIVAL.warningSeconds;
    const p =
      spawnPoint(player, 460, night * 1.7) || spawnPoint(CENTER, 550, night);
    monster = p
      ? {
          ...p,
          id: "watcher",
          kind: "watcher",
          invulnerable: true,
          path: [],
          repath: 0,
          windup: 0,
          cooldown: 0,
          warning: SURVIVAL.warningSeconds,
          moving: false,
          phase: "waking",
          phaseTime: 0,
        }
      : null;
    wave =
      night % SURVIVAL.waveEvery === 0
        ? {
            night,
            status: "warning",
            spawned: 0,
            killed: 0,
            escaped: 0,
            reward: 0,
          }
        : null;
    pending =
      night % SURVIVAL.waveEvery === 0
        ? Math.min(SURVIVAL.maxRaiders, 2 + night / SURVIVAL.waveEvery)
        : 0;
    emit("night-warning", {
      night,
      wave: pending,
      seconds: SURVIVAL.warningSeconds,
    });
  }
  function dawn() {
    residents?.dawn();
    if (wave && ["warning", "active"].includes(wave.status)) {
      wave.status = "withdrawn";
      emit("wave-ended", { ...wave });
    }
    if (monster) emit("watcher-left", {});
    watcher.reset();
    monster = null;
    raiders.length = 0;
    pending = 0;
    warningTimer = 0;
    hitCooldown = 0;
    if (party) party.dawn(); else state.health = state.maxHealth;
  }
  function hurtPlayer(amount, source = "raider") {
    if (player.room) return;
    if (party) {
      if (source !== "watcher" || !isSafe(player)) party.hurt(amount, source);
      return;
    }
    if (
      hitCooldown > 0 ||
      state.gameOver ||
      (source === "watcher" && isSafe(player))
    )
      return;
    state.health = Math.max(0, state.health - amount);
    hitCooldown = SURVIVAL.playerInvulnerability;
    emit("player-hurt", { health: state.health, damage: amount, source });
    if (!state.health)
      defeat(
        source === "watcher"
          ? "Смотритель настиг вас. Не подпускайте его близко: ищите укрытие или свет лагеря."
          : source === "minion"
            ? "Малые монстры настигли вас. Уклоняйтесь от снарядов и чините забор в дни налёта."
            : source === "resident"
              ? "Ночной обитатель биома настиг вас. Вернитесь к свету или покиньте его территорию."
              : "Налётчики настигли вас.",
      );
  }
  function finishWave() {
    if (!wave || wave.status !== "active" || raiders.length) return;
    wave.status =
      wave.spawned > 0 && wave.killed === wave.spawned ? "won" : "escaped";
    const base = 40 + 20 * (wave.night / SURVIVAL.waveEvery);
    wave.reward = wave.spawned
      ? Math.floor((base * wave.killed) / wave.spawned)
      : 0;
    if (party) party.reward(wave.reward); else state.coins += wave.reward;
    if (wave.status === "won") state.raidsWon++;
    emit("wave-ended", { ...wave });
  }
  function escaped(actor) {
    const index = raiders.indexOf(actor);
    if (index < 0) return;
    raiders.splice(index, 1);
    if (wave) wave.escaped++;
    emit("enemy-escaped", { id: actor.id, coins: actor.stolen || 0 });
    finishWave();
  }
  function hit(id, damage, knockback = true) {
    if (minions?.actors.some((r) => r.id === id))
      return minions.hit(id, damage, knockback);
    if (residents?.actors.some((r) => r.id === id))
      return residents.hit(id, damage, knockback);
    const target = raiders.find((r) => r.id === id);
    if (!target || target.hp <= 0 || !Number.isFinite(damage) || damage <= 0)
      return false;
    target.hp = Math.max(0, target.hp - damage);
    target.flash = 0.16;
    if (knockback) {
      const d = Math.max(1, distance(player, target));
      nav.moveBody?.(
        target,
        ((target.x - player.x) / d) * 10,
        ((target.y - player.y) / d) * 10,
      );
      target.stun = 0.15;
      target.windup = 0;
      target.path = [];
      target.repath = 0;
    }
    emit("enemy-hit", { enemy: target, damage });
    if (!target.hp) {
      raiders.splice(raiders.indexOf(target), 1);
      if (wave) wave.killed++;
      if (target.stolen) {
        state.coins += target.stolen;
        emit("supplies-recovered", { enemy: target, coins: target.stolen });
      }
      emit("enemy-defeated", { id, kind: "raider", x: target.x, y: target.y });
      finishWave();
    }
    return true;
  }
  const raiderAI = createRaiderAI({
    state,
    player,
    nav,
    defenses,
    emit,
    hurtPlayer,
    defeat,
    hit,
    escaped,
  });
  function update(dt) {
    if (dt <= 0 || state.gameOver) return;
    residents?.update(dt);
    if (!state.gameOver) minions?.update(dt);
    if (state.gameOver) return;
    hitCooldown = Math.max(0, hitCooldown - dt);
    pathCooldown = Math.max(0, pathCooldown - dt);
    warningTimer = Math.max(0, warningTimer - dt);
    if (monster) monster.warning = warningTimer;
    if (pending && warningTimer <= 0) {
      for (let i = 0; i < pending; i++) {
        const p = spawnPoint(CENTER, 530, sequence + i * 1.7);
        if (p) {
          const role = ["attacker", "thief", "breaker"][i % 3];
          raiders.push({
            ...p,
            id: `raider-${sequence++}`,
            kind: "raider",
            role,
            home: { ...p },
            hp: RAIDER_ROLES[role].hp + Math.floor(state.calendarDay / 10),
            maxHP: RAIDER_ROLES[role].hp + Math.floor(state.calendarDay / 10),
            path: [],
            repath: 0,
            windup: 0,
            cooldown: 0,
            moving: false,
          });
        }
      }
      pending = 0;
      if (wave) {
        wave.spawned = raiders.length;
        wave.status = "active";
      }
      emit("wave-started", { count: raiders.length });
      finishWave();
    }
    if (monster) {
      party?.select(monster);
      watcher.tick(dt, monster, SURVIVAL.monsterSpeed);
    }
    if (state.gameOver) return;
    const actors = [...raiders, ...(monster ? [monster] : [])];
    let pathCandidate = null;
    if (pathCooldown <= 0 && actors.length) {
      for (let i = 0; i < actors.length; i++) {
        const index = (pathCursor + i) % actors.length,
          a = actors[index];
        if (a.repath <= dt && !(a.warning > 0) && (!a.invulnerable || a.goal)) {
          pathCandidate = a;
          pathCursor = (index + 1) % actors.length;
          break;
        }
      }
    }
    for (const actor of actors) {
      party?.select(actor);
      actor.cooldown = Math.max(0, actor.cooldown - dt);
      actor.repath -= dt;
      actor.moving = false;
      if (actor.warning > 0) continue;
      if (actor.invulnerable) {
        if (actor.goal) {
          // Refresh visible pursuit every step without spending the shared A* budget.
          if (nav.clearSegment(actor, actor.goal)) {
            actor.path = [{ ...actor.goal }];
          } else if (actor === pathCandidate) {
            actor.path = nav.findPath(actor, actor.goal);
            actor.repath = WATCHER.repathInterval;
            pathCooldown = 0.25;
          }
          const old = { x: actor.x, y: actor.y };
          actor.moving = nav.followPath(actor, dt, actor.speed) > 0.01;
          if (
            isSafe(actor) &&
            Math.hypot(actor.x - CENTER.x, actor.y - CENTER.y) <
              Math.hypot(old.x - CENTER.x, old.y - CENTER.y)
          ) {
            Object.assign(actor, old);
            actor.path = [];
          }
        }
        continue;
      }
      if (raiderAI.tick(actor, dt, actor === pathCandidate))
        pathCooldown = 0.25;
      if (state.gameOver) break;
    }
  }
  return {
    hear: watcher.hear,
    get wave() {
      return wave;
    },
    raiders,
    get residents() {
      return [...(residents?.actors || []), ...(minions?.actors || [])];
    },
    get regionalBosses() {
      return residents?.actors || [];
    },
    get minions() {
      return minions?.actors || [];
    },
    get projectiles() {
      return minions?.projectiles || [];
    },
    get minionHunt() {
      return minions?.hunt || false;
    },
    get monster() {
      return monster;
    },
    get pending() {
      return pending;
    },
    get hitCooldown() {
      return hitCooldown;
    },
    safeRadius,
    isSafe,
    nightStarted,
    dawn,
    update,
    hit,
  };
}
