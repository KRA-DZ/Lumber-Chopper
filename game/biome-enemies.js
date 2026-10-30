import { BIOMES } from "./biomes.js";
import { CENTER } from "./config.js";
import { NIGHT_START } from "./cycle.js";
import { regionAt } from "./regions.js";
export const BIOME_ENEMIES = Object.freeze({
  max: 6,
  perRegion: 2,
  sense: 280,
  damage: 12,
  hp: 40, // Regional mini-bosses: ten times the old health; waves have separate stats.
  speed: 80,
  windup: 1.1,
  range: 54,
  pathInterval: 0.35,
  streamRange: 1350,
  spawnDelay: 3,
});
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export function createBiomeEnemies({
  state,
  player,
  regions,
  nav,
  isSafe,
  hurtPlayer,
  emit = () => {},
}) {
  const actors = [],
    defeated = new Set();
  let observedNight = -1,
    scan = 0,
    pathBudget = 0,
    cursor = 0;
  const belongs = (p, id) => regionAt(p.x, p.y)?.id === id;
  function inside(p, region) {
    return (
      belongs(p, region.id) &&
      p.x > region.x + 25 &&
      p.x < region.x + region.width - 25 &&
      p.y > region.y + 25 &&
      p.y < region.y + region.height - 25 &&
      !isSafe(p)
    );
  }
  function destination(actor, point) {
    if (!inside(point, actor.region)) return false;
    // Search the existing navigator, reject any route that leaves home territory.
    const path = nav.findPath(actor, point);
    if (!path.length || path.some((p) => !inside(p, actor.region)))
      return false;
    let prev = actor;
    for (const point of path) {
      const steps = Math.max(1, Math.ceil(distance(prev, point) / 24));
      for (let i = 1; i <= steps; i++)
        if (
          !inside(
            {
              x: prev.x + ((point.x - prev.x) * i) / steps,
              y: prev.y + ((point.y - prev.y) * i) / steps,
            },
            actor.region,
          )
        )
          return false;
      prev = point;
    }
    actor.path = path;
    actor.pathVersion = nav.version;
    return true;
  }
  function sync() {
    const candidates = regions.all
      .filter(
        (r) =>
          regions.unlocked.has(r.id) &&
          r.id !== "0:0" &&
          Math.hypot(
            Math.max(r.x - player.x, 0, player.x - r.x - r.width),
            Math.max(r.y - player.y, 0, player.y - r.y - r.height),
          ) < BIOME_ENEMIES.streamRange,
      )
      .sort(
        (a, b) =>
          distance(a.cx ? { x: a.cx, y: a.cy } : a, player) -
          distance({ x: b.cx, y: b.cy }, player),
      );
    for (let i = actors.length - 1; i >= 0; i--)
      if (
        !candidates.includes(actors[i].region) ||
        distance(actors[i], player) > 2400
      )
        actors.splice(i, 1);
    for (const region of candidates) {
      for (
        let slot = 0;
        slot < BIOME_ENEMIES.perRegion && actors.length < BIOME_ENEMIES.max;
        slot++
      ) {
        const id = `resident:${observedNight}:${region.id}:${slot}`;
        if (defeated.has(id) || actors.some((a) => a.id === id)) continue;
        let p = null;
        for (let i = 0; i < 18; i++) {
          const angle = slot * Math.PI + i * 2.399,
            origin = belongs(player, region.id)
              ? player
              : { x: region.cx, y: region.cy };
          const candidate = nav.nearestGround(
            origin.x + Math.cos(angle) * (430 + i * 12),
            origin.y + Math.sin(angle) * (430 + i * 12),
          );
          if (
            inside(candidate, region) &&
            distance(candidate, player) > 330 &&
            distance(candidate, CENTER) > 600
          ) {
            p = candidate;
            break;
          }
        }
        if (!p) continue;
        actors.push({
          ...p,
          id,
          kind: "resident",
          region,
          regionId: region.id,
          biome: region.biome,
          family: BIOMES[region.biome].enemy,
          hp: BIOME_ENEMIES.hp,
          maxHP: BIOME_ENEMIES.hp,
          home: { ...p },
          path: [],
          repath: 0,
          cooldown: 0,
          windup: 0,
          warning: BIOME_ENEMIES.spawnDelay,
          moving: false,
          phase: "patrol",
          flash: 0,
          stun: 0,
          patrolIndex: 0,
        });
      }
    }
  }
  function dawn() {
    actors.length = 0;
    defeated.clear();
    observedNight = -1;
    scan = 0;
    pathBudget = 0;
  }
  function hit(id, damage, knockback = true) {
    const e = actors.find((a) => a.id === id);
    if (
      !e ||
      state.gameOver ||
      e.warning > 0 ||
      !Number.isFinite(damage) ||
      damage <= 0
    )
      return false;
    e.hp = Math.max(0, e.hp - damage);
    e.flash = 0.16;
    e.stun = 0.2;
    e.windup = 0;
    e.attack = null;
    e.path = [];
    e.repath = 0;
    if (knockback) {
      const old = { x: e.x, y: e.y },
        d = Math.max(1, distance(e, player));
      nav.moveBody(e, ((e.x - player.x) / d) * 10, ((e.y - player.y) / d) * 10);
      if (!inside(e, e.region)) Object.assign(e, old);
    }
    emit("enemy-hit", { enemy: e, damage });
    if (e.hp === 0) {
      defeated.add(e.id);
      actors.splice(actors.indexOf(e), 1);
      emit("enemy-defeated", { id, x: e.x, y: e.y });
    }
    return true;
  }
  function update(dt) {
    if (state.gameOver || dt <= 0) return;
    if (state.worldTime < NIGHT_START) {
      if (observedNight !== -1) dawn();
      return;
    }
    if (observedNight !== state.calendarDay) {
      dawn();
      observedNight = state.calendarDay;
    }
    scan -= dt;
    pathBudget = Math.max(0, pathBudget - dt);
    if (scan <= 0) {
      sync();
      scan = 2;
    }
    const first = cursor;
    for (let i = 0; i < actors.length; i++) {
      const e = actors[(first + i) % actors.length];
      e.moving = false;
      e.warning = Math.max(0, e.warning - dt);
      e.cooldown = Math.max(0, e.cooldown - dt);
      e.flash = Math.max(0, e.flash - dt);
      e.stun = Math.max(0, e.stun - dt);
      e.repath = Math.max(0, e.repath - dt);
      if (e.warning > 0 || e.stun > 0) continue;
      if (!nav.isWalkable(e.x, e.y)) {
        const p = nav.nearestGround(e.x, e.y);
        if (inside(p, e.region)) Object.assign(e, p);
        e.path = [];
      }
      const aware =
        belongs(player, e.regionId) &&
        !isSafe(player) &&
        distance(e, player) < BIOME_ENEMIES.sense &&
        nav.hasLineOfSight(e, player);
      if (e.attack) {
        if (!aware) {
          e.attack = null;
          e.windup = 0;
        } else {
          e.windup += dt;
          if (e.windup >= BIOME_ENEMIES.windup) {
            if (
              distance(player, e.attack) < BIOME_ENEMIES.range &&
              nav.clearSegment(e, player)
            )
              hurtPlayer(BIOME_ENEMIES.damage, "resident");
            e.attack = null;
            e.windup = 0;
            e.cooldown = 2.2;
            if (state.gameOver) return;
          }
          continue;
        }
      }
      if (
        aware &&
        distance(e, player) < BIOME_ENEMIES.range &&
        nav.clearSegment(e, player)
      ) {
        e.path = [];
        e.phase = "attack";
        if (e.cooldown <= 0) e.attack = { x: player.x, y: player.y };
        continue;
      }
      const goal = aware
        ? player
        : {
            x: e.home.x + Math.cos(e.patrolIndex * 2.399) * 130,
            y: e.home.y + Math.sin(e.patrolIndex * 2.399) * 130,
          };
      e.phase = aware ? "chase" : "patrol";
      if (!aware && !inside(goal, e.region)) {
        e.patrolIndex++;
        e.path = [];
        continue;
      }
      if (!aware && distance(e, goal) < 20) e.patrolIndex++;
      if (e.pathVersion !== nav.version) e.path = [];
      if (e.repath <= 0 && pathBudget <= 0 && inside(goal, e.region)) {
        destination(e, goal);
        e.repath = aware ? 1 : 3;
        pathBudget = BIOME_ENEMIES.pathInterval;
        cursor = (first + i + 1) % Math.max(1, actors.length);
      }
      const old = { x: e.x, y: e.y };
      e.moving = nav.followPath(e, dt, BIOME_ENEMIES.speed) > 0.01;
      if (!inside(e, e.region)) {
        Object.assign(e, old);
        e.path = [];
        e.moving = false;
      }
    }
  }
  return { actors, update, hit, dawn };
}
