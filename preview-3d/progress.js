// Радиусы в единицах 3D-мира; строительство расходует брёвна, не монеты.
export const STAGES = [
  { name: "Костёр", cost: 10 },
  { name: "Палатка", cost: 20 },
  { name: "Забор", cost: 35 },
  { name: "Хижина", cost: 50 },
];
export const RADII = [24, 29, 34, 39, 44];
export const SAVE_KEY = "lumber-chopper-3d-v1";
export function defaults() {
  return {
    wood: 0,
    capacity: 20,
    coins: 0,
    cargoValue: 0,
    campLevel: 0,
    buildWood: 0,
    upgradeCost: 15,
  };
}
function validState(s) {
  return (
    s &&
    [
      "wood",
      "capacity",
      "coins",
      "cargoValue",
      "campLevel",
      "buildWood",
      "upgradeCost",
    ].every((k) => Number.isSafeInteger(s[k])) &&
    s.capacity >= 20 &&
    s.capacity <= 1000 &&
    s.wood >= 0 &&
    s.wood <= s.capacity &&
    s.coins >= 0 &&
    s.coins <= 1e12 &&
    s.cargoValue >= 0 &&
    s.cargoValue <= s.wood * 40 &&
    s.campLevel >= 0 &&
    s.campLevel <= 4 &&
    s.buildWood >= 0 &&
    s.buildWood < (STAGES[s.campLevel]?.cost || 1) &&
    s.upgradeCost > 0 &&
    s.upgradeCost <= 1e12
  );
}
export function loadProgress(storage) {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data.version !== 1 || !validState(data.state))
        throw Error("invalid save");
      return { ...data, source: "3d" };
    }
    const legacy = storage.getItem("lumber-chopper-v1");
    if (!legacy) return { state: defaults(), source: "new" };
    const old = JSON.parse(legacy);
    if (![1, 2, 3, 4].includes(old.version)) throw Error("legacy");
    const state = {
      wood: old.wood,
      capacity:
        old.version === 1 ? Math.min(1000, old.maxWood * 2) : old.maxWood,
      coins: old.coins,
      cargoValue: old.cargoValue,
      campLevel: old.campLevel ?? 0,
      buildWood: old.buildWood ?? 0,
      upgradeCost: old.upgradeCost ?? 15,
    };
    if (!validState(state)) throw Error("legacy state");
    return { state, source: "2d" };
  } catch {
    try {
      const raw = storage.getItem(SAVE_KEY);
      if (raw) storage.setItem(SAVE_KEY + "-backup", raw);
    } catch {}
    return {
      state: defaults(),
      source: "error",
      warning: "Не удалось прочитать сохранение. Запущена новая 3D-сессия.",
    };
  }
}
export function saveProgress(storage, state, player, trees) {
  storage.setItem(
    SAVE_KEY,
    JSON.stringify({
      version: 1,
      state: { ...state },
      position: { x: player.x, z: player.z },
      trees: trees
        .filter((t) => t.hp < t.maxHp)
        .map((t) => ({ id: t.id, hp: t.hp })),
    }),
  );
}
