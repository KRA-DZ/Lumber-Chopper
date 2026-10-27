import { CENTER } from "./config.js";

export const REGION_SIZE = 1920;
export const REGION_BOUNDS = Object.freeze({
  x: -3200,
  y: -3200,
  width: 9600,
  height: 9600,
});
const ORIGIN = CENTER.x - REGION_SIZE / 2;
const activities = {
  "0:0": ["Стартовый лагерь", "camp"],
  "1:0": ["Роща древнего дуба", "ancient"],
  "-1:0": ["Тихие воды", "pond"],
  "0:-1": ["Забытая крепость", "ruins"],
  "0:1": ["Сумеречная чаща", "mystery"],
  "1:-1": ["Каменные врата", "arch"],
  "-1:-1": ["Мшистые своды", "ruins"],
  "-1:1": ["Потерянный караван", "wagon"],
  "1:1": ["Старая стоянка", "camp-site"],
  "-2:-2": ["Северный дозор", "arch"],
  "-1:-2": ["Заросшая арка", "arch"],
  "0:-2": ["Погасшая башня", "ruins"],
  "1:-2": ["Старый тракт", "wagon"],
  "2:-2": ["Разлом корней", "forest"],
  "-2:-1": ["Каменоломня", "ruins"],
  "2:-1": ["Восточная застава", "arch"],
  "-2:0": ["Берёзовый привал", "camp-site"],
  "2:0": ["Корневая низина", "forest"],
  "-2:1": ["Потерянный обоз", "wagon"],
  "2:1": ["Долина следов", "arch"],
  "-2:2": ["Старая ограда", "ruins"],
  "-1:2": ["Поляна лесорубов", "camp-site"],
  "0:2": ["Чёрные руины", "ruins"],
  "1:2": ["Тропа каравана", "wagon"],
  "2:2": ["Последний дозор", "arch"],
};
export const REGIONS = Object.freeze(
  Array.from({ length: 25 }, (_, i) => {
    const gx = (i % 5) - 2,
      gy = Math.floor(i / 5) - 2,
      id = `${gx}:${gy}`;
    const [name, activity] = activities[id] || [
      `Дальний лес ${i + 1}`,
      i % 3 === 0 ? "ruins" : "forest",
    ];
    return Object.freeze({
      id,
      gx,
      gy,
      name,
      activity,
      x: ORIGIN + gx * REGION_SIZE,
      y: ORIGIN + gy * REGION_SIZE,
      width: REGION_SIZE,
      height: REGION_SIZE,
      cx: CENTER.x + gx * REGION_SIZE,
      cy: CENTER.y + gy * REGION_SIZE,
      cost: 12 * Math.max(1, Math.abs(gx) + Math.abs(gy)),
    });
  }),
);
const byId = new Map(REGIONS.map((r) => [r.id, r]));
export const regionAt = (x, y) =>
  byId.get(
    `${Math.floor((x - ORIGIN) / REGION_SIZE)}:${Math.floor((y - ORIGIN) / REGION_SIZE)}`,
  );

export function createRegions(state) {
  state.unlockedRegions = ["0:0"]; // One full 1920² tile at start; each opening adds the same area.
  state.regionWood = {}; // Logs paid into each border project; never coins, no refunds/duplicate charges.
  const unlocked = new Set(state.unlockedRegions);
  let revision = 0,
    frontierCache = null;
  const isOpen = (p) => {
    const r = regionAt(p.x, p.y);
    return !!r && unlocked.has(r.id);
  };
  function contains(x, y, r = 0) {
    if (!isOpen({ x, y })) return false;
    for (const [dx, dy] of [
      [-r, -r],
      [-r, r],
      [r, -r],
      [r, r],
    ])
      if (!isOpen({ x: x + dx, y: y + dy })) return false;
    return true;
  }
  function constrain(x, y, r = 10) {
    if (contains(x, y, r)) return { x, y };
    let best = { x: CENTER.x, y: CENTER.y + 120 },
      distance = Infinity;
    for (const id of unlocked) {
      const a = byId.get(id),
        p = {
          x: Math.max(a.x + r, Math.min(a.x + a.width - r, x)),
          y: Math.max(a.y + r, Math.min(a.y + a.height - r, y)),
        },
        d = Math.hypot(x - p.x, y - p.y);
      if (d < distance) {
        distance = d;
        best = p;
      }
    }
    return best;
  }
  function frontiers() {
    if (frontierCache) return frontierCache;
    frontierCache = [];
    for (const id of unlocked) {
      const from = byId.get(id);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const region = byId.get(`${from.gx + dx}:${from.gy + dy}`);
        if (!region || unlocked.has(region.id)) continue;
        frontierCache.push({
          id: `${id}>${region.id}`,
          region,
          from,
          dx,
          dy,
          x: from.cx + dx * (REGION_SIZE / 2 - 72),
          y: from.cy + dy * (REGION_SIZE / 2 - 72),
        });
      }
    }
    return frontierCache;
  }
  function deposit(id) {
    const region = byId.get(id);
    if (
      !region ||
      unlocked.has(id) ||
      !frontiers().some((g) => g.region.id === id)
    )
      return null;
    const paid = (state.regionWood[id] || 0) + 1;
    state.regionWood[id] = Math.min(region.cost, paid);
    if (paid < region.cost) return { region, opened: false };
    unlocked.add(id);
    state.unlockedRegions.push(id);
    revision++;
    frontierCache = null;
    return { region, opened: true };
  }
  return {
    all: REGIONS,
    bounds: REGION_BOUNDS,
    unlocked,
    isOpen,
    contains,
    constrain,
    frontiers,
    deposit,
    get revision() {
      return revision;
    },
  };
}
