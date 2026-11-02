import { REGIONS } from "./regions.js";

// Gameplay layout first; the dedicated modular art set will be chosen later.
const region = REGIONS.find((r) => r.id === "1:1");
const point = (x, y) => ({ x: region.cx + x, y: region.cy + y });
const wall = (id, x0, y0, x1, y1) => ({
  id,
  a: point(x0, y0),
  b: point(x1, y1),
  r: 12,
  key: "log",
});
const debris = (id, name, x, maxHP, logs) => ({
  id,
  name,
  regionId: region.id,
  ...point(x, -176),
  a: point(x, -256),
  b: point(x, -96),
  r: 14,
  maxHP,
  logs,
  value: 8,
});
export const SAWMILL = {
  id: "abandoned-sawmill",
  regionId: region.id,
  name: "Заброшенная лесопилка",
  bounds: { ...point(-640, -512), width: 1280, height: 1024 },
  entrance: point(0, 608),
  clearGround: true,
  walls: [
    wall("north", -640, -512, 640, -512),
    wall("west", -640, -512, -640, 512),
    wall("east", 640, -512, 640, 512),
    wall("south-west", -640, 512, -112, 512),
    wall("south-east", 112, 512, 640, 512),
    wall("store-upper", -192, -512, -192, -256),
    wall("store-middle", -192, -96, -192, 224),
    wall("store-lower", -192, 384, -192, 512),
    wall("store-rack", -640, 64, -352, 64),
    wall("hall-upper", 224, -512, 224, -256),
    wall("hall-middle", 224, -96, 224, 256),
    wall("hall-lower", 224, 416, 224, 512),
    wall("machine-base", 384, -32, 640, -32),
  ],
  rooms: [
    { name: "Двор", ...point(-160, -480), width: 352, height: 960 },
    { name: "Склад древесины", ...point(-608, -480), width: 384, height: 960 },
    { name: "Машинный зал", ...point(256, -480), width: 352, height: 960 },
  ],
  // Starting axe: 6 / 24 hits, finite rewards of 3 / 6 logs worth 8 coins each.
  // Both rooms also have an always-open southern door: no upgrade is required.
  debris: [
    debris("sawmill-fallen-beams", "Упавшие балки", -192, 6, 3),
    debris("sawmill-heavy-collapse", "Тяжёлый завал", 224, 24, 6),
  ],
  sites: [],
  dressing: [
    { id: "wood-stack-a", key: "world.firewood", ...point(-496, -320) },
    { id: "wood-stack-b", key: "world.firewood", ...point(-368, -320) },
    { id: "store-crate", key: "camp.crate", ...point(-512, 256) },
    { id: "work-tools", key: "world.tools", ...point(448, -256) },
    { id: "work-bench", key: "world.bench", ...point(480, -192) },
    { id: "hall-crate", key: "camp.crate", ...point(512, 256) },
    { id: "yard-wood", key: "world.firewood", ...point(32, 192) },
  ],
};
