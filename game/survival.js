import { CENTER } from "./config.js";
export const SURVIVAL = Object.freeze({
  monsterSpeed: 132,
  monsterDamage: 40,
  monsterWindup: 1.2,
  playerInvulnerability: 1.4,
  warningSeconds: 12,
  waveEvery: 5,
  maxRaiders: 8,
  raiderSpeed: 82,
  raiderDamage: 12,
  repairPerLog: 20,
});
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
// Engine-independent night director. At most one path search per update, bounded actors.
export function createSurvival({
  state,
  player,
  nav,
  accessible,
  emit,
  defeat,
}) {
  const raiders = [];
  let monster = null,
    pending = 0,
    sequence = 0,
    warningTimer = 0,
    pathCooldown = 0,
    hitCooldown = 0,
    pathCursor = 0;
  const safeRadius = () => (state.campLevel > 0 ? 310 : 210);
  const isSafe = (p) => distance(p, CENTER) < safeRadius();
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
  function nightStarted({ night }) {
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
    monster = null;
    raiders.length = 0;
    pending = 0;
    warningTimer = 0;
    hitCooldown = 0;
    state.health = state.maxHealth;
  }
  function hurtPlayer(amount) {
    if (hitCooldown > 0 || state.gameOver) return;
    state.health = Math.max(0, state.health - amount);
    hitCooldown = SURVIVAL.playerInvulnerability;
    emit("player-hurt", { health: state.health, damage: amount });
    if (!state.health) defeat("Смотритель или налётчики настигли вас.");
  }
  function hit(id, damage) {
    const target = raiders.find((r) => r.id === id);
    if (!target || target.hp <= 0) return false;
    target.hp = Math.max(0, target.hp - damage);
    emit("enemy-hit", { enemy: target, damage });
    if (!target.hp) {
      raiders.splice(raiders.indexOf(target), 1);
      emit("enemy-defeated", { id });
    }
    return true;
  }
  function update(dt) {
    if (dt <= 0 || state.gameOver) return;
    hitCooldown = Math.max(0, hitCooldown - dt);
    pathCooldown = Math.max(0, pathCooldown - dt);
    warningTimer = Math.max(0, warningTimer - dt);
    if (monster) monster.warning = warningTimer;
    if (pending && warningTimer <= 0) {
      for (let i = 0; i < pending; i++) {
        const p = spawnPoint(CENTER, 530, sequence + i * 1.7);
        if (p)
          raiders.push({
            ...p,
            id: `raider-${sequence++}`,
            kind: "raider",
            hp: 4 + Math.floor(state.calendarDay / 10),
            path: [],
            repath: 0,
            windup: 0,
            cooldown: 0,
            moving: false,
          });
      }
      pending = 0;
      emit("wave-started", { count: raiders.length });
    }
    const actors = [...raiders, ...(monster ? [monster] : [])];
    let pathCandidate = null;
    if (pathCooldown <= 0 && actors.length) {
      for (let i = 0; i < actors.length; i++) {
        const index = (pathCursor + i) % actors.length,
          a = actors[index];
        if (
          a.repath <= dt &&
          !(a.warning > 0) &&
          !(a.invulnerable && isSafe(player))
        ) {
          pathCandidate = a;
          pathCursor = (index + 1) % actors.length;
          break;
        }
      }
    }
    for (const actor of actors) {
      actor.cooldown = Math.max(0, actor.cooldown - dt);
      actor.repath -= dt;
      actor.moving = false;
      if (actor.warning > 0) continue;
      const watcher = actor.invulnerable;
      const playerTarget = watcher || distance(actor, player) < 180;
      const target = playerTarget ? player : CENTER;
      const blocked = watcher && isSafe(player);
      const inRange =
        !blocked &&
        distance(actor, target) < (playerTarget ? 64 : 75) &&
        nav.clearSegment(actor, target);
      // The fire is a solid nav obstacle. Raiders attack its perimeter instead.
      const atCamp = !playerTarget && distance(actor, CENTER) < 90;
      if (inRange || atCamp) {
        if (actor.cooldown > 0) {
          actor.windup = 0;
          continue;
        }
        actor.windup += dt;
        if (actor.windup >= (watcher ? SURVIVAL.monsterWindup : 0.9)) {
          actor.windup = 0;
          actor.cooldown = watcher ? 2 : 2.2;
          if (playerTarget) hurtPlayer(watcher ? SURVIVAL.monsterDamage : 20);
          else {
            state.campHealth = Math.max(
              0,
              state.campHealth - SURVIVAL.raiderDamage,
            );
            emit("camp-hurt", { health: state.campHealth });
            if (!state.campHealth) defeat("Налётчики разрушили лагерь.");
          }
        }
      } else {
        actor.windup = 0;
        if (blocked) {
          actor.path = [];
          continue;
        }
        if (actor === pathCandidate) {
          const goal = playerTarget
            ? target
            : {
                x:
                  CENTER.x +
                  ((actor.x - CENTER.x) /
                    Math.max(1, distance(actor, CENTER))) *
                    65,
                y:
                  CENTER.y +
                  ((actor.y - CENTER.y) /
                    Math.max(1, distance(actor, CENTER))) *
                    65,
              };
          actor.path = nav.findPath(actor, goal);
          actor.repath = 1.2;
          pathCooldown = 0.25;
        }
        const old = { x: actor.x, y: actor.y };
        actor.moving =
          nav.followPath(
            actor,
            dt,
            watcher ? SURVIVAL.monsterSpeed : SURVIVAL.raiderSpeed,
          ) > 0.01;
        if (watcher && isSafe(actor)) {
          Object.assign(actor, old);
          actor.path = [];
        }
      }
      if (state.gameOver) break;
    }
  }
  return {
    raiders,
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
