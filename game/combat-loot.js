import { ITEMS } from "./exploration.js";
import { NIGHT_START } from "./cycle.js";
import { SHOP_IDS, upgradeOffer } from "../economy.js";

export const COMBAT_LOOT = Object.freeze({
  minionCoins: 2,
  minionDailyCoins: 24, // Day and its following night share this small-monster budget.
  minionDailyResin: 2,
  resinEvery: 6, // Deterministic 1-in-6 roll; streaming/reloading an actor cannot reroll it.
  bossCoins: 20, // Once per region/night; independent of the camp-wave reward.
  maxPiles: 24,
  lifetime: 180,
  pickupInterval: 0.15,
});
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function hash(text) {
  let n = 2166136261;
  for (const char of text) n = Math.imul(n ^ char.charCodeAt(0), 16777619);
  return n >>> 0;
}
export function affordableCombatUpgrades(state) {
  return state.combatLoot?.coinsCollected
    ? SHOP_IDS.map((id) => upgradeOffer(state, id)).filter(
        (offer) => offer.canBuy,
      )
    : [];
}

// One bounded pile per defeat; pickup never shares the log stack or grants wave rewards.
export function createCombatLoot({
  state,
  player,
  canAct,
  accessible,
  canReach,
  emit = () => {},
}) {
  const piles = new Map(),
    seen = new Set(),
    bosses = new Set(),
    data = state.combatLoot;
  let day = -1,
    sequence = 0,
    pickupTimer = 0,
    limitNotice = false;
  function syncDay() {
    if (day === state.calendarDay) return;
    day = state.calendarDay;
    seen.clear();
    bosses.clear();
    limitNotice = false;
    data.smallCoins = data.smallResin = 0;
  }
  function drop(source) {
    if (
      !canAct() ||
      !["minion", "boss"].includes(source.kind) ||
      typeof source.id !== "string" ||
      !Number.isFinite(source.x) ||
      !Number.isFinite(source.y) ||
      !accessible(source)
    )
      return false;
    syncDay();
    if (seen.has(source.id)) return false;
    const boss = source.kind === "boss",
      key = `${day}:${source.regionId}`;
    if (
      boss &&
      (!source.regionId || state.worldTime < NIGHT_START || bosses.has(key))
    )
      return false;
    seen.add(source.id);
    let coins, resin;
    if (boss) {
      bosses.add(key);
      coins = COMBAT_LOOT.bossCoins;
      resin = 1;
    } else {
      coins = Math.max(
        0,
        Math.min(
          COMBAT_LOOT.minionCoins,
          COMBAT_LOOT.minionDailyCoins - data.smallCoins,
        ),
      );
      resin =
        data.smallResin < COMBAT_LOOT.minionDailyResin &&
        hash(source.id) % COMBAT_LOOT.resinEvery === 0
          ? 1
          : 0;
      data.smallCoins += coins;
      data.smallResin += resin;
    }
    if (!coins && !resin) {
      if (
        !limitNotice &&
        data.smallCoins >= COMBAT_LOOT.minionDailyCoins &&
        data.smallResin >= COMBAT_LOOT.minionDailyResin
      ) {
        limitNotice = true;
        emit("combat-loot-limit", {});
      }
      return false;
    }
    if (piles.size >= COMBAT_LOOT.maxPiles)
      piles.delete(piles.keys().next().value);
    const pile = {
      id: `combat-loot-${sequence++}`,
      x: source.x,
      y: source.y,
      coins,
      resin,
      boss,
      age: 0,
    };
    piles.set(pile.id, pile);
    emit("combat-loot-dropped", { pile, boss });
    return true;
  }
  function update(dt) {
    if (!canAct() || !Number.isFinite(dt) || dt <= 0) return;
    syncDay();
    for (const [id, pile] of piles) {
      pile.age += dt;
      if (pile.age >= COMBAT_LOOT.lifetime) piles.delete(id);
    }
    pickupTimer = Math.max(0, pickupTimer - dt);
    if (pickupTimer > 0) return;
    for (const [id, pile] of piles) {
      if (
        distance(player, pile) > state.pickupRadius ||
        !canReach(player, pile)
      )
        continue;
      const coins = pile.coins,
        resin = Math.max(
          0,
          Math.min(
            pile.resin,
            ITEMS.resin.limit - state.exploration.items.resin,
          ),
        );
      if (!coins && !resin) continue;
      state.coins += coins;
      state.exploration.items.resin += resin;
      data.coinsCollected += coins;
      data.resinCollected += resin;
      pile.coins -= coins;
      pile.resin -= resin;
      if (!pile.coins && !pile.resin) piles.delete(id);
      pickupTimer = COMBAT_LOOT.pickupInterval;
      emit("combat-loot-collected", { x: pile.x, y: pile.y, coins, resin });
      break;
    }
  }
  return { piles, drop, update };
}
