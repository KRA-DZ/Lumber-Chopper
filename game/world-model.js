import { CAMP } from "../pixel-art.js";
import { FOREST_SITES, inClearing, groveOffset } from "../world.js";
import { CENTER, WORLD } from "./config.js";
// Геометрия и генерация перенесены из рабочего Canvas-прототипа без изменения координат.
export function createWorldModel() {
  const landmarks = FOREST_SITES,
    trees = [];
  const treeTypes = {
    oak: { name: "Лиственное дерево", value: 10, hp: 4 },
    birch: { name: "Берёза", value: 12, hp: 3 },
    spruce: { name: "Ель", value: 15, hp: 5 },
    dead: { name: "Сухое дерево", value: 8, hp: 2 },
  };
  const ancientTree = {
    x: 2080,
    y: 1400,
    radius: 65,
    workerOnly: true,
    infinite: true,
  }; // Запас не иссякает; добыча зарезервирована для будущих работников.
  const pond = { x: 1150, y: 1740, rx: 150, ry: 105 };
  const streamX = (y) => 1160 + 65 * Math.sin((y - 1820) / 160);
  const bridge = { x: streamX(1950), y: 1950, width: 180, height: 64 };
  const trails = [
    [
      { x: 1600, y: 1720 },
      { x: 1890, y: 1740 },
      { x: 1990, y: 1540 },
      { x: 2080, y: 1490 },
    ],
    [
      { x: 1530, y: 1690 },
      { x: 1340, y: 1510 },
      { x: 1240, y: 1390 },
    ],
    [
      { x: 1500, y: 1680 },
      { x: 1370, y: 1880 },
      { x: bridge.x, y: 1950 },
      { x: 990, y: 1980 },
    ],
    [
      { x: 1640, y: 1730 },
      { x: 1810, y: 1850 },
      { x: 1790, y: 2110 },
    ],
    [
      { x: 1690, y: 1440 },
      { x: 1760, y: 1180 },
      { x: 1880, y: 860 },
    ],
    [
      { x: 1420, y: 1775 },
      { x: 1390, y: 1960 },
      { x: 1320, y: 2140 },
    ],
  ];
  const pondOutline = Array.from({ length: 32 }, (_, i) => {
    const a = (i / 32) * Math.PI * 2,
      f = 1 + 0.07 * Math.sin(a * 3) + 0.05 * Math.cos(a * 5);
    return {
      x: pond.x + Math.cos(a) * pond.rx * f,
      y: pond.y + Math.sin(a) * pond.ry * f,
    };
  });
  const streamOutline = [
    ...Array.from({ length: 41 }, (_, i) => {
      const y = 1810 + i * 20;
      return { x: streamX(y) - 27, y };
    }),
    ...Array.from({ length: 41 }, (_, i) => {
      const y = 2610 - i * 20;
      return { x: streamX(y) + 27, y };
    }),
  ];
  function pointInPolygon(x, y, points) {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const a = points[i],
        b = points[j];
      if (
        a.y > y !== b.y > y &&
        x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x
      )
        inside = !inside;
    }
    return inside;
  }
  function onBridge(x, y) {
    return (
      Math.abs(x - bridge.x) <= bridge.width / 2 &&
      Math.abs(y - bridge.y) <= bridge.height / 2
    );
  }
  function inWater(x, y) {
    return (
      !onBridge(x, y) &&
      (pointInPolygon(x, y, pondOutline) || pointInPolygon(x, y, streamOutline))
    );
  }
  function waterCollision(x, y, r) {
    if (
      x < pond.x - pond.rx - r - 20 ||
      x > pond.x + pond.rx + r + 110 ||
      y < pond.y - pond.ry - r - 20 ||
      y > 2620 + r
    )
      return false;
    for (let i = 0; i < 9; i++) {
      const a = (i / 8) * Math.PI * 2;
      if (
        inWater(
          x + (i === 8 ? 0 : Math.cos(a) * r),
          y + (i === 8 ? 0 : Math.sin(a) * r),
        )
      )
        return true;
    }
    return false;
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
  function nearTrail(p, width = 44) {
    return trails.some((path) =>
      path.some((b, i) => i > 0 && segmentDistance(p, path[i - 1], b) < width),
    );
  }
  function spawnTrees() {
    // Стабильные id позволяют сравнивать деревья и пни при отладке одной сессии.
    let legacyIndex = 0;
    const types = Object.keys(treeTypes);
    for (let ring = 0; ring < 10; ring++) {
      const r = 350 + ring * 112,
        count = Math.floor((2 * Math.PI * r) / 145);
      for (let i = 0; i < count; i++, legacyIndex++) {
        const angle =
            (i / count) * Math.PI * 2 +
            ring * 0.37 +
            Math.sin(i * 13 + ring) * 0.075,
          rr = r + groveOffset(angle, ring, i);
        const x = CENTER.x + Math.cos(angle) * rr,
          y = CENTER.y + Math.sin(angle) * rr;
        if (
          rr < 330 ||
          Math.hypot(x - CAMP.merchant.x, y - CAMP.merchant.y) < 145 ||
          (x > 1360 && x < 1525 && y > 1740 && y < 2145) ||
          waterCollision(x, y, 40) ||
          nearTrail({ x, y }, 48) ||
          trees.some((t) => Math.hypot(t.x - x, t.y - y) < 66)
        )
          continue;
        if (
          Math.hypot(x - ancientTree.x, y - ancientTree.y) < 205 ||
          inClearing(x, y)
        )
          continue; // Отдельная поляна великого дерева.
        let hash = Math.imul(legacyIndex + 73, 0x45d9f3b);
        hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
        hash ^= hash >>> 16;
        const type = types[(hash >>> 0) % types.length],
          spec = treeTypes[type];
        trees.push({
          id: `${ring}:${i}`,
          legacyIndex,
          ring,
          x,
          y,
          type,
          value: spec.value,
          radius: 25,
          size: legacyIndex % 3, // Увеличенный третий спрайт даёт 3 бревна, остальные — 2.
          cutDay: null,
          hp: spec.hp + (legacyIndex % 3 === 2 ? 2 : 0),
          maxHp: spec.hp + (legacyIndex % 3 === 2 ? 2 : 0),
          shake: 0,
        });
      }
    }
  }

  spawnTrees();
  return {
    trees,
    landmarks,
    ancientTree,
    pond,
    pondOutline,
    streamOutline,
    trails,
    bridge,
    inWater,
    waterCollision,
    nearTrail,
    segmentDistance,
  };
}
