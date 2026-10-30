import { CENTER } from "./config.js";
import { DEFENSE } from "./defenses.js";
export const RAIDER_ROLES = Object.freeze({
  attacker: {
    name: "Налётчик",
    hp: 4,
    speed: 82,
    damage: 12,
    structureDamage: 10,
    windup: 0.9,
    color: 0xd9ac78,
  },
  thief: {
    name: "Вор",
    hp: 3,
    speed: 112,
    damage: 6,
    structureDamage: 6,
    windup: 1.2,
    color: 0xa8c6ae,
  },
  breaker: {
    name: "Громила",
    hp: 7,
    speed: 58,
    damage: 20,
    structureDamage: 24,
    windup: 1.3,
    color: 0xe8a18b,
  },
});
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export function createRaiderAI({
  state,
  player,
  nav,
  defenses,
  emit,
  hurtPlayer,
  defeat,
  hit,
  escaped,
}) {
  function tick(actor, dt, canSearch) {
    const role = RAIDER_ROLES[actor.role || "attacker"];
    actor.stun = Math.max(0, (actor.stun || 0) - dt);
    actor.slow = Math.max(0, (actor.slow || 0) - dt);
    actor.flash = Math.max(0, (actor.flash || 0) - dt);
    if (actor.stun > 0) return false;
    for (const trap of defenses?.all() || []) {
      if (trap.kind !== "trap" || trap.hp <= 0 || distance(actor, trap) > 30)
        continue;
      defenses.damage(trap.id, 1);
      actor.slow = DEFENSE.trapSlowSeconds;
      emit("trap-triggered", { trap, enemy: actor });
      hit(actor.id, DEFENSE.trapDamage, false);
      if (actor.hp <= 0) return false;
    }
    const fleeing = actor.fleeing;
    const playerTarget =
      !fleeing &&
      actor.role !== "thief" &&
      distance(actor, player) < 180 &&
      nav.clearSegment(actor, player);
    const structures = (defenses?.all() || []).filter(
      (s) => s.kind !== "trap" && s.hp > 0,
    );
    // Outside the enclosure, breakers breach the nearest section. Others strike only a nearby barrier.
    const barrier =
      !fleeing && !playerTarget && distance(actor, CENTER) > 190
        ? structures.sort((a, b) => distance(actor, a) - distance(actor, b))[0]
        : null;
    const centerDistance = Math.max(1, distance(actor, CENTER));
    const campApproach = {
      x: CENTER.x + ((actor.x - CENTER.x) / centerDistance) * 65,
      y: CENTER.y + ((actor.y - CENTER.y) / centerDistance) * 65,
    };
    const structure =
      barrier &&
      !nav.clearSegment(actor, campApproach) &&
      (actor.role === "breaker" || distance(actor, barrier) < 85)
        ? barrier
        : null;
    const target = fleeing
      ? actor.home
      : playerTarget
        ? player
        : structure || CENTER;
    const targetKey = fleeing
      ? "exit"
      : playerTarget
        ? "player"
        : structure?.id || "camp";
    if (actor.targetKey !== targetKey) {
      actor.targetKey = targetKey;
      actor.path = [];
      actor.repath = 0;
      actor.windup = 0;
    }
    if (
      fleeing &&
      distance(actor, actor.home) < 35 &&
      distance(actor, CENTER) > 450
    ) {
      escaped(actor);
      return false;
    }
    const atCamp =
      !fleeing && !playerTarget && !structure && distance(actor, CENTER) < 90;
    const inRange =
      !fleeing &&
      (atCamp ||
        (structure
          ? distance(actor, structure) < 56
          : distance(actor, target) < 64 && nav.clearSegment(actor, target)));
    if (inRange) {
      actor.path = [];
      if (actor.cooldown > 0) {
        actor.windup = 0;
        return false;
      }
      actor.windup += dt;
      if (actor.windup >= role.windup) {
        actor.windup = 0;
        actor.cooldown = 2.2;
        if (playerTarget) hurtPlayer(20);
        else if (structure) defenses.damage(structure.id, role.structureDamage);
        else if (actor.role === "thief") {
          actor.stolen = Math.min(15, state.coins);
          state.coins -= actor.stolen;
          actor.fleeing = true;
          actor.repath = 0;
          emit("supplies-stolen", { enemy: actor, coins: actor.stolen });
        } else {
          state.campHealth = Math.max(0, state.campHealth - role.damage);
          emit("camp-hurt", { health: state.campHealth, damage: role.damage });
          if (!state.campHealth) defeat("Налётчики разрушили лагерь.");
        }
      }
      return false;
    }
    actor.windup = 0;
    let searched = false;
    if (canSearch) {
      let goal = target;
      if (structure || target === CENTER) {
        const radius = structure ? 38 : 65,
          d = Math.max(1, distance(actor, target));
        goal = {
          x: target.x + ((actor.x - target.x) / d) * radius,
          y: target.y + ((actor.y - target.y) / d) * radius,
        };
      }
      actor.path = nav.findPath(actor, goal);
      actor.repath = 1.2;
      searched = true;
    }
    actor.moving =
      nav.followPath(actor, dt, role.speed * (actor.slow > 0 ? 0.45 : 1)) >
      0.01;
    return searched;
  }
  return { tick };
}
