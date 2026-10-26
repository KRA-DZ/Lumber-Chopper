import { CAMP, pixelHash } from "./pixel-art.js";

// Поляны заданы вручную, породы по-прежнему перемешаны по всему лесу.
export const FOREST_SITES = Object.freeze([
  {
    id: "old-wall",
    type: "ruins",
    name: "Старая лесная застава",
    x: 1240,
    y: 1330,
    clearing: 105,
  },
  {
    id: "broken-cart",
    type: "wagon",
    name: "Забытая повозка",
    x: 1790,
    y: 2050,
    clearing: 100,
  },
  {
    id: "moss-chest",
    type: "chest",
    name: "Заросший сундук",
    x: 970,
    y: 1940,
    clearing: 90,
  },
  {
    id: "quiet-camp",
    type: "camp",
    name: "Покинутая стоянка лесоруба",
    x: 1880,
    y: 790,
    clearing: 140,
  },
  {
    id: "stone-arch",
    type: "arch",
    name: "Старые каменные ворота",
    x: 630,
    y: 1400,
    clearing: 135,
  },
  {
    id: "lost-chest",
    type: "chest",
    name: "Сундук под папоротниками",
    x: 2390,
    y: 2200,
    clearing: 90,
  },
  {
    id: "spring",
    type: "spring",
    name: "Мшистый родник",
    x: 1000,
    y: 1120,
    clearing: 140,
  },
  {
    id: "fallen-oak",
    type: "log",
    name: "Поляна поваленного дуба",
    x: 2410,
    y: 1210,
    clearing: 140,
  },
  {
    id: "woodcutter-rest",
    type: "logging",
    name: "Старая делянка",
    x: 2270,
    y: 2450,
    clearing: 125,
  },
]);
export function inClearing(x, y, sites = FOREST_SITES) {
  return sites.some(
    (s) =>
      Math.hypot(x - s.x, y - s.y) < s.clearing ||
      (y > s.y &&
        ((x - s.x) / s.clearing) ** 2 +
          ((y - s.y - 45) / (s.clearing + 65)) ** 2 <
          1),
  );
}
// Широкие разрывы между группами; смещение не меняет размер ствола/коллизий.
export function groveOffset(angle, ring, index) {
  return (
    Math.sin(angle * 5 + ring * 0.65) * 58 + Math.sin(index * 17 + ring) * 92
  );
}

export function createWorldDressing({
  art,
  sprites,
  trees,
  center,
  ancientTree,
  nearTrail,
  inWater,
}) {
  const ground = [],
    plants = [],
    siteItems = [];
  const add = (list, type, x, y, extra = {}) =>
    list.push({ type, x, y, ...extra });
  for (const t of trees) {
    const n = pixelHash(t.legacyIndex, 47);
    if (n % 3 !== 0) add(ground, "moss", t.x + 10, t.y + 3);
    if (n % 4 === 0) add(ground, "roots", t.x, t.y + 4);
    if (n % 3 === 0) add(plants, "mushroom", t.x - 24, t.y + 14, { tree: t });
    if (n % 4 !== 1) continue;
    const x = t.x + (n % 2 ? 65 : -65),
      y = t.y + 24;
    if (
      nearTrail({ x, y }, 58) ||
      inWater(x, y) ||
      inClearing(x, y) ||
      Math.hypot(x - center.x, y - center.y) < 330 ||
      Math.hypot(x - ancientTree.x, y - ancientTree.y) < 200
    )
      continue;
    add(plants, n % 5 === 0 ? "berry" : "sapling", x, y, { variant: n % 2 });
  }
  // Низкие растения образуют небольшие группы, оставляя тропы свободными.
  for (let i = 0; i < 100; i++) {
    const n = pixelHash(i, 191),
      x = 250 + (n % 2700),
      y = 250 + ((n >>> 12) % 2700);
    if (
      Math.hypot(x - center.x, y - center.y) < 330 ||
      nearTrail({ x, y }, 64) ||
      inWater(x, y) ||
      inClearing(x, y) ||
      Math.hypot(x - ancientTree.x, y - ancientTree.y) < 210
    )
      continue;
    add(plants, "fern", x, y, { variant: i % 2 });
    if (i % 3 === 0) add(plants, "flowers", x + 16, y + 10, { variant: 1 });
  }
  for (const site of FOREST_SITES) {
    for (let i = 0; i < 5; i++) {
      const a = i * 2.399,
        r = site.clearing * 0.64;
      add(
        plants,
        i % 2 ? "fern" : "berry",
        site.x + Math.cos(a) * r,
        site.y + Math.sin(a) * r * 0.7,
        { variant: i % 2 },
      );
    }
    if (site.type === "camp" || site.type === "logging") {
      add(siteItems, "tools", site.x - 84, site.y + 24);
      add(siteItems, "firewood", site.x + 92, site.y + 18);
      add(siteItems, "bench", site.x - 2, site.y + 94);
      add(siteItems, "supplies", site.x + 82, site.y - 45);
      if (site.type === "logging") add(siteItems, "log", site.x, site.y - 22);
    }
  }
  const campItems = [
    { type: "tools", x: center.x + 70, y: center.y + 42, min: 1 },
    { type: "bench", x: center.x - 90, y: center.y + 72, min: 1 },
    {
      type: "firewood",
      x: CAMP.tent.x - 90,
      y: CAMP.tent.y + 25,
      min: 2,
      max: 3,
    },
    {
      type: "supplies",
      x: CAMP.tent.x + 96,
      y: CAMP.tent.y + 8,
      min: 2,
      max: 3,
    },
    { type: "clothes", x: 1535, y: 1390, min: 2 },
    { type: "firewood", x: CAMP.hut.x + 155, y: CAMP.hut.y + 25, min: 4 },
    { type: "supplies", x: CAMP.hut.x - 145, y: CAMP.hut.y + 24, min: 4 },
    { type: "berry", x: 1400, y: 1390, min: 3 },
    { type: "berry", x: 1800, y: 1420, min: 3 },
  ];
  const visible = (p, v) =>
    p.x > v.x - 130 &&
    p.x < v.x + v.width + 130 &&
    p.y > v.y - 30 &&
    p.y < v.y + v.height + 130;
  function getSprite(p, time) {
    if (p.type === "sapling") return sprites.saplings[p.variant || 0];
    if (p.type === "clothes")
      return sprites.clothes[Math.floor(time * 1.4) % 2];
    return sprites[p.type] || art.sprites.details[p.type][p.variant || 0];
  }
  function drawItem(ctx, p, time) {
    // Грибы возле пня становятся заметнее после рубки, без таймера роста/награды.
    if (p.tree && p.tree.hp > 0 && p.tree.legacyIndex % 2 === 0) return;
    art.draw(ctx, getSprite(p, time), p.x, p.y);
  }
  function drawGround(ctx, view, time) {
    for (const p of ground) if (visible(p, view)) drawItem(ctx, p, time);
  }
  function entities(view, time, level) {
    const list = [];
    for (const group of [plants, siteItems, campItems])
      for (const p of group)
        if (
          (p.min === undefined || (level >= p.min && level <= (p.max ?? 4))) &&
          visible(p, view)
        )
          list.push({ y: p.y, draw: (ctx) => drawItem(ctx, p, time) });
    return list;
  }
  function drawHouseLife(ctx, view, time, level, darkness) {
    if (level < 4) return;
    const chimney = { x: CAMP.hut.x + 66, y: CAMP.hut.y - 244 };
    if (visible(chimney, view))
      for (let i = 0; i < 5; i++) {
        const t = (time * 0.12 + i / 5) % 1;
        ctx.globalAlpha = (1 - t) * 0.22;
        art.draw(
          ctx,
          sprites.smoke,
          chimney.x + Math.sin(t * 6 + i) * 8 + t * 22,
          chimney.y - t * 60,
          t > 0.6 ? 2 : 1,
        );
      }
    ctx.globalAlpha = 1;
    if (darkness > 0.15) {
      ctx.globalAlpha = darkness * 0.45;
      ctx.fillStyle = "#ffd08a";
      for (const x of [CAMP.hut.x - 72, CAMP.hut.x + 54])
        ctx.fillRect(x, CAMP.hut.y - 76, 24, 34);
      ctx.globalAlpha = 1;
    }
  }
  return {
    ground,
    plants,
    siteItems,
    campItems,
    drawGround,
    entities,
    drawHouseLife,
  };
}
