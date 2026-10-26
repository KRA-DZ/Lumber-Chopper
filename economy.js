// Баланс лавки: первая переноска окупается одной продажей двух обычных брёвен.
export const AXE_TIERS = Object.freeze([
  {
    name: "Походный",
    rarity: "Обычный",
    power: 1,
    interval: 0.85,
    color: "#b4c9bf",
    edge: "#e6e5cb",
    cost: 0,
  },
  {
    name: "Лесоруб",
    rarity: "Необычный",
    power: 2,
    interval: 0.8,
    color: "#70b983",
    edge: "#c5e2ab",
    cost: 75,
  },
  {
    name: "Стальной",
    rarity: "Редкий",
    power: 3,
    interval: 0.74,
    color: "#70a9d2",
    edge: "#c5e3e8",
    cost: 240,
  },
  {
    name: "Рунический",
    rarity: "Эпический",
    power: 4,
    interval: 0.68,
    color: "#b38bd5",
    edge: "#ead4ee",
    cost: 750,
  },
  {
    name: "Солнечный",
    rarity: "Легендарный",
    power: 6,
    interval: 0.6,
    color: "#dcaf50",
    edge: "#ffeb9a",
    cost: 2400,
  },
  {
    name: "Багряный",
    rarity: "Мифический",
    power: 9,
    interval: 0.52,
    color: "#d66c63",
    edge: "#ffd6ab",
    cost: 7200,
  },
]);
const definitions = {
  carry: {
    name: "Сила переноски",
    level: "carryLevel",
    max: 40,
    base: 20,
    growth: 1.55,
  },
  axe: { name: "Новый топор", level: "axeLevel", max: AXE_TIERS.length - 1 },
  boots: {
    name: "Походная обувь",
    level: "bootsLevel",
    max: 5,
    base: 90,
    growth: 2,
  },
  pickup: {
    name: "Ловкий подбор",
    level: "pickupLevel",
    max: 5,
    base: 60,
    growth: 1.9,
  },
  lantern: {
    name: "Лесной фонарь",
    level: "lanternLevel",
    max: 4,
    base: 110,
    growth: 2.1,
  },
};
export function upgradeOffer(state, id) {
  const d = definitions[id];
  if (!d) return null;
  const level = state[d.level] || 0,
    maxed = level >= d.max;
  const price = maxed
    ? null
    : id === "axe"
      ? AXE_TIERS[level + 1].cost
      : Math.ceil(d.base * d.growth ** level);
  const descriptions = {
    carry: `Ноша ${2 + level * 2} → ${2 + (level + 1) * 2} брёвен`,
    axe: maxed
      ? "Лучший топор этой лавки"
      : `${AXE_TIERS[Math.min(level + 1, AXE_TIERS.length - 1)].name} · ${AXE_TIERS[Math.min(level + 1, AXE_TIERS.length - 1)].rarity}`,
    boots: `Скорость ${100 + level * 8}% → ${100 + (level + 1) * 8}%`,
    pickup: `Радиус подбора ${68 + level * 12} → ${68 + (level + 1) * 12}`,
    lantern: `Свет ночью ${140 + level * 24} → ${140 + (level + 1) * 24}`,
  };
  return {
    id,
    name: d.name,
    level,
    maxed,
    price,
    description: maxed ? "Все улучшения куплены" : descriptions[id],
    canBuy: !maxed && state.coins >= price,
    color:
      id === "axe"
        ? AXE_TIERS[Math.min(level + 1, AXE_TIERS.length - 1)].color
        : "#dbc17f",
  };
}
export function applyUpgrades(state) {
  state.maxWood = 2 + (state.carryLevel || 0) * 2;
  const axe = AXE_TIERS[state.axeLevel || 0];
  state.axePower = axe.power;
  state.autoInterval = axe.interval;
  state.pickupRadius = 68 + (state.pickupLevel || 0) * 12;
  state.runSpeed = 200 * (1 + (state.bootsLevel || 0) * 0.08);
}
export function buyUpgrade(state, id) {
  const offer = upgradeOffer(state, id);
  if (!offer?.canBuy) return false;
  state.coins -= offer.price;
  state[definitions[id].level] = (state[definitions[id].level] || 0) + 1;
  applyUpgrades(state);
  return true;
}
export const SHOP_IDS = Object.freeze(Object.keys(definitions));
