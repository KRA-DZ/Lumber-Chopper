import { BIOMES } from "./biomes.js";
import { CENTER, RAID_INTERVAL } from "./config.js";
import { NIGHT_START } from "./cycle.js";
import { regionAt } from "./regions.js";

export const MINIONS = Object.freeze({
  max: 12,
  perRegion: 3,
  hp: 6,
  rangedHP: 4,
  speed: 118,
  rangedSpeed: 105,
  sense: 230,
  damage: 8,
  structureDamage: 6,
  windup: 0.34,
  cooldown: 0.8,
  range: 48,
  throwRange: 245,
  throwCooldown: 1.4,
  flight: 0.65,
  blastRadius: 24,
  projectileDamage: 6,
  maxProjectiles: 8,
  pathInterval: 0.2,
  streamRange: 1350,
  spawnDelay: 3,
});
export const minionHuntNight = (state) =>
  state.worldTime >= NIGHT_START &&
  (state.calendarDay + 1) % RAID_INTERVAL === 0;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Small day/night enemies. Their hunt never changes the raiders' reward counter.
export function createMinions({
  state,
  player,
  regions,
  nav,
  isSafe,
  defenses,
  hurtPlayer,
  emit = () => {},
  party = null,
  getNoise = () => null,
  encampment = null,
}) {
  const actors = [],
    projectiles = [],
    defeated = new Set();
  let epoch = -1,
    scan = 0,
    pathBudget = 0,
    cursor = 0,
    shotSequence = 0,
    wasHunt = false;
  const homeRegion = (p, e) => regionAt(p.x, p.y)?.id === e.regionId;
  const allowed = (p, e, global) =>
    regions.isOpen(p) && (global || homeRegion(p, e));
  function sync(hunt) {
    const camp=encampment?.site,guardSlots=camp&&regions.isOpen(camp)?encampment.guards():[],
      campNear=camp&&(party?.positions()||[player]).some(p=>distance(p,camp)<650),
      reserve=campNear?guardSlots.filter(g=>!actors.some(e=>e.id===g.id)).length:0;
    const candidates = regions.all
      .filter(
        (r) =>
          regions.unlocked.has(r.id) &&
          r.id !== "0:0" &&
          (party?.positions() || [player]).some(p => Math.hypot(
            Math.max(r.x - p.x, 0, p.x - r.x - r.width),
            Math.max(r.y - p.y, 0, p.y - r.y - r.height),
          ) < MINIONS.streamRange),
      )
      .sort(
        (a, b) =>
          Math.min(...(party?.positions() || [player]).map(p => distance({ x: a.cx, y: a.cy }, p))) -
          Math.min(...(party?.positions() || [player]).map(p => distance({ x: b.cx, y: b.cy }, p))),
      );
    if (!hunt)
      for (let i = actors.length - 1; i >= 0; i--)
        if (
          !candidates.includes(actors[i].region) ||
          (party?.positions() || [player]).every(p => distance(actors[i], p) > 2400)
        )
          actors.splice(i, 1);
    // A nearby objective has priority within the same global actor cap.
    while(reserve&&actors.length>MINIONS.max-reserve){
      const far=actors.filter(e=>!e.campGuard).sort((a,b)=>Math.min(...(party?.positions()||[player]).map(p=>distance(b,p)))-Math.min(...(party?.positions()||[player]).map(p=>distance(a,p))))[0];
      if(!far)break;actors.splice(actors.indexOf(far),1);
    }
    for (const region of candidates)
      for (
        let slot = 0;
        slot < MINIONS.perRegion && actors.length < MINIONS.max-reserve;
        slot++
      ) {
        const id = `minion:${epoch}:${region.id}:${slot}`;
        if (defeated.has(id) || actors.some((e) => e.id === id)) continue;
        const origin = (party?.positions() || [player]).find(p => regionAt(p.x, p.y)?.id === region.id) || { x: region.cx, y: region.cy };
        let point = null;
        for (let i = 0; i < 20; i++) {
          const angle = slot * 2.1 + i * 2.399;
          const p = nav.nearestGround(
            origin.x + Math.cos(angle) * (380 + i * 12),
            origin.y + Math.sin(angle) * (380 + i * 12),
          );
          if (
            (!camp||distance(p,camp)>camp.radius+40) &&
            regionAt(p.x, p.y)?.id === region.id &&
            !isSafe(p) &&
            (party?.positions() || [player]).every(other => distance(p, other) > 330) &&
            p.x > region.x + 25 &&
            p.x < region.x + region.width - 25 &&
            p.y > region.y + 25 &&
            p.y < region.y + region.height - 25
          ) {
            point = p;
            break;
          }
        }
        if (!point) continue;
        const ranged = slot === MINIONS.perRegion - 1,
          hp = ranged ? MINIONS.rangedHP : MINIONS.hp;
        actors.push({
          ...point,
          id,
          kind: "resident",
          tier: "minion",
          role: ranged ? "ranged" : "melee",
          region,
          regionId: region.id,
          family: BIOMES[region.biome].enemy,
          biome: region.biome,
          hp,
          maxHP: hp,
          home: { ...point },
          path: [],
          pathVersion: nav.version,
          warning: MINIONS.spawnDelay,
          repath: 0,
          cooldown: 0,
          windup: 0,
          flash: 0,
          stun: 0,
          slow: 0,
          attack: null,
          patrolIndex: slot,
          moving: false,
          phase: "patrol",
        });
      }
    if(campNear)for(const spec of guardSlots){
      if(actors.length>=MINIONS.max||actors.some(e=>e.id===spec.id))continue;
      const region=regions.all.find(r=>r.id===camp.regionId),point=nav.nearestGround(spec.x,spec.y);
      if(!regions.isOpen(point)||distance(point,spec)>100)continue;
      actors.push({...point,id:spec.id,kind:"resident",tier:"minion",campGuard:true,role:spec.role,region,regionId:region.id,
        family:BIOMES[region.biome].enemy,biome:region.biome,hp:spec.hp,maxHP:spec.maxHP,home:{x:spec.x,y:spec.y},path:[],pathVersion:nav.version,
        warning:MINIONS.spawnDelay,repath:0,cooldown:0,windup:0,flash:0,stun:0,slow:0,attack:null,patrolIndex:0,moving:false,phase:"patrol"});
    }
  }
  function hit(id, damage, knockback = true) {
    const e = actors.find((e) => e.id === id);
    if (
      !e ||
      state.gameOver ||
      e.warning > 0 ||
      !Number.isFinite(damage) ||
      damage <= 0
    )
      return false;
    const beforeHit={x:e.x,y:e.y},actualDamage=Math.min(e.hp,damage);
    e.hp = Math.max(0, e.hp - damage);
    e.flash = 0.16;
    e.stun = 0.1;
    e.attack = null;
    e.windup = 0;
    e.path = [];
    e.repath = 0;
    if (knockback) {
      const before = { x: e.x, y: e.y },
        d = Math.max(1, distance(e, player));
      nav.moveBody(e, ((e.x - player.x) / d) * 10, ((e.y - player.y) / d) * 10);
      if (!allowed(e, e, minionHuntNight(state))) Object.assign(e, before);
    }
    emit("enemy-hit", { enemy: e, damage, actualDamage, from:{x:player.x,y:player.y}, push:{x:e.x-beforeHit.x,y:e.y-beforeHit.y} });
    if (!e.hp) {
      defeated.add(id);
      actors.splice(actors.indexOf(e), 1);
      emit("enemy-defeated", {
        id,
        kind: "minion",
        regionId: e.regionId,
        x: e.x,
        y: e.y,
      });
    }
    return true;
  }
  function route(e, goal, global) {
    if (!allowed(goal, e, global)) {
      e.path = [];
      return;
    }
    const path = nav.findPath(e, goal);
    let from = e;
    for (const to of path) {
      const steps = Math.max(1, Math.ceil(distance(from, to) / 24));
      for (let i = 1; i <= steps; i++)
        if (
          !allowed(
            {
              x: from.x + ((to.x - from.x) * i) / steps,
              y: from.y + ((to.y - from.y) * i) / steps,
            },
            e,
            global,
          )
        ) {
          e.path = [];
          return;
        }
      from = to;
    }
    e.path = path;
    e.pathVersion = nav.version;
  }
  function barrier(e, hunt) {
    if (
      !hunt ||
      e.breachGoal ||
      distance(e, CENTER) < 220 ||
      distance(player, CENTER) > 430 ||
      nav.clearSegment(e, player)
    )
      return null;
    return (
      (defenses?.all() || [])
        .filter((s) => s.kind !== "trap" && s.hp > 0 && !s.open)
        .sort(
          (a, b) =>
            distance(e, a) +
            distance(a, player) * 0.25 -
            distance(e, b) -
            distance(b, player) * 0.25,
        )[0] || null
    );
  }
  function enterBreach(e, section) {
    const d = Math.max(1, distance(section, CENTER)),
      inward = Math.max(0, d - 90) / d;
    e.breachGoal = nav.nearestGround(
      CENTER.x + (section.x - CENTER.x) * inward,
      CENTER.y + (section.y - CENTER.y) * inward,
    );
    e.path = [];
    e.repath = 0;
  }
  function attack(e, kind, target) {
    if (e.cooldown > 0) return;
    if (!e.attack) {
      e.attack = { kind, x: target.x, y: target.y, id: target.id };
      e.windup = 0;
    }
  }
  function updateProjectiles(dt) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.age += dt;
      if (p.age < p.duration) continue;
      projectiles.splice(i, 1);
      if (party) party.blast(p, p.radius, MINIONS.projectileDamage);
      else if (distance(player, p) < p.radius && regions.isOpen(player))
        hurtPlayer(MINIONS.projectileDamage, "minion",{x:p.fromX,y:p.fromY});
      emit("minion-projectile-impact", { x: p.x, y: p.y, radius: p.radius });
      if (state.gameOver) return;
    }
  }
  function update(dt) {
    if (state.gameOver || !Number.isFinite(dt) || dt <= 0) return;
    // Night 1 and the following daytime share one roster; next dusk resurrects it.
    const nextEpoch =
        state.calendarDay + Number(state.worldTime >= NIGHT_START),
      hunt = minionHuntNight(state);
    if (nextEpoch !== epoch) {
      actors.length = projectiles.length = 0;
      defeated.clear();
      epoch = nextEpoch;
      scan = 0;
    }
    if (wasHunt && !hunt) {
      projectiles.length = 0;
      for (const e of actors) {
        e.attack = null;
        e.path = [];
        e.windup = 0;
        e.repath = 0;
        e.breachGoal = null;
        e.barrierId = null;
      }
    }
    wasHunt = hunt;
    scan -= dt;
    pathBudget = Math.max(0, pathBudget - dt);
    if (scan <= 0) {
      sync(hunt);
      scan = 2;
    }
    updateProjectiles(dt);
    if (state.gameOver) return;
    const order = actors.slice();
    const first = cursor % Math.max(1, order.length);
    for (let index = 0; index < order.length; index++) {
      const e = order[(first + index) % order.length];
      party?.select(e);
      if (!actors.includes(e)) continue;
      e.moving = false;
      for (const key of [
        "warning",
        "cooldown",
        "flash",
        "stun",
        "slow",
        "repath",
      ])
        e[key] = Math.max(0, e[key] - dt);
      if (e.warning > 0 || e.stun > 0) continue;
      for (const trap of defenses?.all() || [])
        if (trap.kind === "trap" && trap.hp > 0 && distance(e, trap) < 30) {
          defenses.damage(trap.id, 1);
          e.slow = 3;
          hit(e.id, 3, false);
          emit("trap-triggered", { trap, enemy: e });
          break;
        }
      if (!e.hp) continue;
      if (e.breachGoal && distance(e, e.breachGoal) < 20) e.breachGoal = null;
      if (!nav.isWalkable(e.x, e.y)) {
        const p = nav.nearestGround(e.x, e.y);
        if (allowed(p, e, hunt || !homeRegion(e, e))) Object.assign(e, p);
        e.path = [];
        e.repath = 0;
      }
      const aware =
        hunt ||
        ((!e.campGuard||distance(player,e.home)<300) && homeRegion(player, e) &&
          !isSafe(player) &&
          distance(e, player) < MINIONS.sense &&
          nav.hasLineOfSight(e, player));
      const noise=getNoise(),investigate=!e.campGuard&&!aware&&noise&&homeRegion(noise,e)&&distance(e,noise)<noise.radius&&!isSafe(noise);
      const retreat = !hunt && (!homeRegion(e, e) || isSafe(e) || e.campGuard&&distance(e,e.home)>300);
      const previousBarrier = defenses?.get(e.barrierId);
      if (hunt && previousBarrier?.hp === 0 && !e.breachGoal)
        enterBreach(e, previousBarrier);
      const ranged = e.role === "ranged",
        structure = aware && !ranged ? barrier(e, hunt) : null;
      e.barrierId = structure?.id || null;
      const inRange =
        !retreat &&
        aware &&
        (structure
          ? distance(e, structure) < 60
          : distance(e, player) <
              (ranged ? MINIONS.throwRange : MINIONS.range) &&
            ((ranged && hunt) ||
              (ranged
                ? nav.hasLineOfSight(e, player)
                : nav.clearSegment(e, player))));
      const kind = structure ? "structure" : ranged ? "throw" : "player";
      if (
        e.attack &&
        (!inRange ||
          e.attack.kind !== kind ||
          (structure && e.attack.id !== structure.id))
      ) {
        e.attack = null;
        e.windup = 0;
        e.path = [];
        e.repath = 0;
      }
      if (inRange) {
        e.path = [];
        e.phase = ranged ? "aim" : "attack";
        attack(e, kind, structure || player);
        if (e.attack) {
          e.windup += dt;
          if (e.windup >= MINIONS.windup) {
            const a = e.attack;
            if (a.kind === "structure") {
              const section = defenses.get(a.id);
              if (section?.hp > 0) {
                defenses.damage(a.id, MINIONS.structureDamage);
                if (defenses.get(a.id)?.hp === 0) {
                  enterBreach(e, section);
                }
              }
            } else if (a.kind === "throw") {
              if (projectiles.length < MINIONS.maxProjectiles)
                projectiles.push({
                  id: `shot:${shotSequence++}`,
                  x: a.x,
                  y: a.y,
                  fromX: e.x,
                  fromY: e.y - 25,
                  age: 0,
                  duration: MINIONS.flight,
                  radius: MINIONS.blastRadius,
                  biome: e.biome,
                });
            } else if (
              distance(player, a) < MINIONS.range &&
              nav.clearSegment(e, player)
            )
              hurtPlayer(MINIONS.damage, "minion",e);
            e.attack = null;
            e.windup = 0;
            e.cooldown = ranged ? MINIONS.throwCooldown : MINIONS.cooldown;
          }
        }
        if (state.gameOver) return;
        continue;
      }
      e.attack = null;
      e.windup = 0;
      let goal = retreat
        ? e.home
        : e.breachGoal ||
          (aware
            ? player
            : investigate ? noise : {
                x: e.home.x + Math.cos(e.patrolIndex * 2.399) * 110,
                y: e.home.y + Math.sin(e.patrolIndex * 2.399) * 110,
              });
      if (structure) {
        const d = Math.max(1, distance(e, structure));
        goal = {
          x: structure.x + ((e.x - structure.x) / d) * 38,
          y: structure.y + ((e.y - structure.y) / d) * 38,
        };
      }
      const global = hunt || retreat;
      e.phase = retreat ? "retreat" : aware ? "chase" : investigate ? "investigate" : "patrol";
      if(!!e.investigating!==!!investigate){e.investigating=!!investigate;e.path=[];e.repath=0;}
      if (!allowed(goal, e, global)) {
        e.patrolIndex++;
        e.path = [];
        continue;
      }
      if (!aware && distance(e, goal) < 20) e.patrolIndex++;
      if (e.pathVersion !== nav.version) {
        e.path = [];
        e.repath = 0;
      }
      if (e.repath <= 0) {
        if (nav.clearSegment(e, goal)) {
          e.path = [{ x: goal.x, y: goal.y }];
          e.pathVersion = nav.version;
          e.repath = aware ? 0.2 : 2;
        } else if (pathBudget <= 0) {
          route(e, goal, global);
          e.repath = aware ? 0.7 : 3;
          pathBudget = MINIONS.pathInterval;
          cursor = (first + index + 1) % Math.max(1, actors.length);
        }
      }
      const old = { x: e.x, y: e.y };
      e.moving =
        nav.followPath(
          e,
          dt,
          (ranged ? MINIONS.rangedSpeed : MINIONS.speed) *
            (e.slow > 0 ? 0.45 : 1),
        ) > 0.01;
      if (!allowed(e, e, global)) {
        Object.assign(e, old);
        e.path = [];
        e.moving = false;
      }
    }
  }
  return {
    actors,
    projectiles,
    hit,
    update,
    get hunt() {
      return minionHuntNight(state);
    },
  };
}
