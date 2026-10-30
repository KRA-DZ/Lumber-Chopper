import { CENTER } from "./config.js";
import { CAMP, random, pixelHash } from "../pixel-art.js";
import { REGIONS, REGION_BOUNDS, REGION_SIZE, regionAt } from "./regions.js";

export function createRegionWorld(regions) {
  const trees = [],
    bins = new Map(),
    decorBins = new Map(),
    landmarks = [],
    trails = [];
  const ancientTree = {
    x: 3520,
    y: 1600,
    radius: 65,
    workerOnly: true,
    infinite: true,
    regionId: "1:0",
  };
  const merchant = { x: 1670, y: 3430, regionId: "0:1" };
  const pond = { x: -320, y: 1600, rx: 235, ry: 165 };
  const pondOutline = Array.from({ length: 40 }, (_, i) => {
    const a = (i / 40) * Math.PI * 2,
      f = 1 + 0.06 * Math.sin(a * 5);
    return {
      x: pond.x + Math.cos(a) * pond.rx * f,
      y: pond.y + Math.sin(a) * pond.ry * f,
    };
  });
  const streamOutline = [];
  for (const r of REGIONS) {
    const type =
      r.activity === "ruins"
        ? "ruins"
        : r.activity === "arch"
          ? "arch"
          : r.activity === "wagon"
            ? "wagon"
            : r.activity === "camp-site"
              ? "camp"
              : r.activity === "forest"
                ? "log"
                : null;
    if (type)
      landmarks.push({
        id: `site:${r.id}`,
        name: r.name,
        type,
        x: r.cx,
        y: r.cy,
        clearing: 230,
        regionId: r.id,
      });
    if (r.activity === "ruins")
      for (const [i, dx, dy] of [
        [0, -120, 105],
        [1, 155, 60],
      ])
        landmarks.push({
          id: `chest:${r.id}:${i}`,
          name: "Сундук крепости",
          type: "chest",
          x: r.cx + dx,
          y: r.cy + dy,
          clearing: 90,
          regionId: r.id,
        });
    // Wide, continuous cross-roads keep all four borders and their signs reachable.
    trails.push(
      [
        { x: r.x, y: r.cy },
        { x: r.x + REGION_SIZE, y: r.cy },
      ],
      [
        { x: r.cx, y: r.y },
        { x: r.cx, y: r.y + REGION_SIZE },
      ],
    );
  }
  const clues = [
    {
      id: "note",
      x: 1290,
      y: 1380,
      name: "Записка у лагеря",
      text: "«Карта не заканчивается у деревьев. Ищи указатели на краю поляны: за каждой границей — другой лес. Дуб на востоке помнит тех, кто пришёл раньше нас.»",
    },
    {
      id: "ruins-note",
      x: 1420,
      y: -130,
      name: "Дневник смотрителя",
      text: "«Сундуки крепости закрыты не замками. Мы убрали печати, но к утру они появились снова. Тот, кто торгует на юге, знает цену ключу.»",
    },
    {
      id: "pond-note",
      x: -160,
      y: 1800,
      name: "Письмо рыбака",
      text: "«На закате вода становится зеркалом. Только отражение на другом берегу продолжает двигаться. Удочки оставили в сарае — однажды мы вернёмся.»",
    },
    {
      id: "oak-note",
      x: 3380,
      y: 1780,
      name: "Зарубки у дуба",
      text: "«Одному этот ствол не одолеть. Наши работники брали древесину неделями, но наутро следы топоров исчезали. Корни уходят под весь лес.»",
    },
    {
      id: "merchant-note",
      x: 1490,
      y: 3590,
      name: "Обрывок договора",
      text: "«Он не просит назвать имя. Он его уже знает. Никогда не бери товар, которого нет на прилавке. На обратной стороне — след ладони и незамкнутый круг.»",
    },
    {
      id: "tracks",
      x: 3420,
      y: -240,
      name: "Следы у ворот",
      text: "«Отпечатки идут только в одну сторону. Между шагами слишком большое расстояние. За воротами кто-то считал наши костры.»",
    },
    {
      id: "mark",
      x: 3595,
      y: -320,
      name: "Знак на камне",
      text: "«Пять рядов, пять столбцов. В середине — огонь. Не все границы были поставлены людьми.»",
    },
  ];
  function inWater(x, y) {
    const dx = (x - pond.x) / pond.rx,
      dy = (y - pond.y) / pond.ry;
    return dx * dx + dy * dy < 1;
  }
  function waterCollision(x, y, r = 10) {
    return (
      ((x - pond.x) / (pond.rx + r)) ** 2 +
        ((y - pond.y) / (pond.ry + r)) ** 2 <
      1
    );
  }
  function segmentDistance(p, a, b) {
    const dx = b.x - a.x,
      dy = b.y - a.y,
      t = Math.max(
        0,
        Math.min(
          1,
          ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1),
        ),
      );
    return Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t);
  }
  function nearTrail(p, width = 50) {
    const r = regionAt(p.x, p.y);
    return (
      !!r && (Math.abs(p.x - r.cx) < width || Math.abs(p.y - r.cy) < width)
    );
  }
  function reserved(x, y, r) {
    return (
      nearTrail({ x, y }, 90) ||
      waterCollision(x, y, 75) ||
      (r.activity === "pond" &&
        Math.hypot(x - (pond.x + 225), y - (pond.y + 175)) < 250) ||
      (r.id === "0:0" && Math.hypot(x - CENTER.x, y - CENTER.y) < 520) ||
      Math.hypot(x - ancientTree.x, y - ancientTree.y) < 290 ||
      Math.hypot(x - merchant.x, y - merchant.y) < 220 ||
      landmarks.some(
        (p) => p.regionId === r.id && Math.hypot(x - p.x, y - p.y) < p.clearing,
      ) ||
      clues.some((p) => Math.hypot(x - p.x, y - p.y) < 95) ||
      (r.id === "0:0" && x > 1240 && x < 1535 && y > 1710 && y < 2220)
    );
  }
  function generate(region) {
    if (bins.has(region.id)) return;
    const rnd = random(pixelHash(region.gx, region.gy)),
      list = [],
      decor = [];
    const types = ["oak", "birch", "spruce", "dead"],
      hp = { oak: 4, birch: 3, spruce: 5, dead: 2 },
      values = { oak: 10, birch: 12, spruce: 15, dead: 8 };
    // Jittered cells preserve generous routes without rendering a huge prebuilt map.
    for (let gy = 0; gy < 12; gy++)
      for (let gx = 0; gx < 12; gx++) {
        const x = region.x + 80 + gx * 150 + (rnd() - 0.5) * 75,
          y = region.y + 80 + gy * 150 + (rnd() - 0.5) * 75;
        if (reserved(x, y, region)) continue;
        const index = (region.gy + 2) * 5 + region.gx + 2,
          legacyIndex = index * 200 + gy * 12 + gx,
          type = types[Math.floor(rnd() * 4)],
          size = legacyIndex % 3;
        const t = {
          id: `${region.id}/${gx}:${gy}`,
          regionId: region.id,
          legacyIndex,
          x,
          y,
          type,
          size,
          radius: 25,
          value: values[type],
          hp: hp[type] + (size === 2 ? 2 : 0),
          maxHp: hp[type] + (size === 2 ? 2 : 0),
          cutDay: null,
          shake: 0,
        };
        list.push(t);
        trees.push(t);
      }
    for (let i = 0; i < 85; i++) {
      const x = region.x + 40 + rnd() * (REGION_SIZE - 80),
        y = region.y + 40 + rnd() * (REGION_SIZE - 80);
      if (
        waterCollision(x, y, 20) ||
        nearTrail({ x, y }, 45) ||
        (region.id === "0:0" && Math.hypot(x - 1600, y - 1600) < 310)
      )
        continue;
      decor.push({
        type: ["fern", "mushroom", "rock", "flowers"][Math.floor(rnd() * 4)],
        variant: Math.floor(rnd() * 2),
        x,
        y,
      });
    }
    bins.set(region.id, list);
    decorBins.set(region.id, decor);
  }
  function treesNear(view) {
    const result = [];
    for (const r of REGIONS)
      if (
        bins.has(r.id) &&
        r.x < view.x + view.width &&
        r.x + r.width > view.x &&
        r.y < view.y + view.height &&
        r.y + r.height > view.y
      )
        result.push(...bins.get(r.id));
    return result;
  }
  generate(REGIONS.find((r) => r.id === "0:0"));
  return {
    regional: true,
    bounds: REGION_BOUNDS,
    regions,
    trees,
    landmarks,
    trails,
    ancientTree,
    merchant,
    pond,
    pondOutline,
    streamOutline,
    bridge: null,
    clues,
    inWater,
    waterCollision,
    nearTrail,
    segmentDistance,
    generate,
    treesNear,
    decorBins,
    biomeAt: (x, y) => regionAt(x, y)?.activity,
    campItems: [
      { type: "tools", x: 1640, y: 1645, min: 0 },
      { type: "bench", x: 1510, y: 1672, min: 1 },
      { type: "firewood", x: 1815, y: 1470, min: 1 },
      { type: "supplies", x: 1360, y: 1505, min: 2 },
      { type: "clothes", x: 1690, y: 1340, min: 3 },
    ],
  };
}
