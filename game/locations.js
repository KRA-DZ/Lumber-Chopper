import { REGIONS } from "./regions.js";

// Data-only layouts: navigation, generation and presentation share the same bases.
// First playable layout; final modular PNGs will be selected after route testing.
const region = REGIONS.find((r) => r.id === "0:-1");
const point = (x, y) => ({ x: region.cx + x, y: region.cy + y });
const wall = (id, x0, y0, x1, y1, passage = null) => ({
  id,
  a: point(x0, y0),
  b: point(x1, y1),
  r: 12,
  passage,
});
export const FORTRESS = {
  id: "forgotten-fortress",
  regionId: region.id,
  name: "Забытая крепость",
  bounds: { x: region.cx - 576, y: region.cy - 512, width: 1152, height: 960 },
  entrance: point(0, 544),
  walls: [
    wall("north", -576, -512, 576, -512),
    wall("west", -576, -512, -576, 448),
    wall("east", 576, -512, 576, 448),
    wall("south-west", -576, 448, -96, 448),
    wall("south-east", 96, 448, 576, 448),
    wall("west-upper", -192, -512, -192, -192),
    wall("west-lower", -192, -32, -192, 448),
    wall("west-room", -576, 64, -320, 64),
    wall("archive-top", 192, -512, 192, -384),
    wall("archive-shortcut", 192, -384, 192, -256, "fortress-shortcut"),
    wall("archive-middle", 192, -256, 192, 64),
    wall("archive-bottom", 192, 224, 192, 448),
    wall("archive-room-west", 192, -128, 384, -128),
    wall("archive-room-east", 512, -128, 576, -128),
    wall("archive-maze", 384, -128, 384, 256),
  ],
  rooms: [
    { name: "Двор", ...point(-160, -448), width: 320, height: 832 },
    { name: "Караульная", ...point(-544, -480), width: 320, height: 512 },
    { name: "Склад", ...point(-544, 96), width: 320, height: 320 },
    { name: "Архив", ...point(224, -480), width: 320, height: 320 },
  ],
  chests: [
    { id: "chest:0:-1:0", ...point(-432, -304), name: "Сундук караульной" },
    {
      id: "chest:0:-1:1",
      ...point(400, -384),
      name: "Сундук архива",
      requiredClue: "fortress-ledger",
    },
  ],
  sites: [
    {
      id: "fortress-winch",
      kind: "passage",
      name: "Лебёдка боковой решётки",
      description:
        "Механизм доступен из архива. Поднимите решётку, чтобы открыть короткий путь во двор. Ключ и брёвна не нужны.",
      passage: "fortress-shortcut",
      ...point(272, -320),
      regionId: region.id,
    },
  ],
  clues: [
    {
      id: "fortress-entry",
      ...point(-112, 352),
      name: "План караульного",
      text: "«Караульная — в западном крыле, вход выше по двору. В архив можно попасть через восточные коридоры: обойди длинную стену с юга и ищи северный проход. Боковая решётка поднимается только изнутри. Ключи от сундуков остались у торговца на юге леса.»",
    },
    {
      id: "ruins-note",
      ...point(-432, -432),
      name: "Дневник смотрителя",
      text: "«Сундуки крепости закрыты не замками. Мы убрали печати, но к утру они появились снова. Тот, кто торгует на юге, знает цену ключу. Копия архивного знака осталась в складской ведомости, в нижней западной комнате.»",
    },
    {
      id: "fortress-ledger",
      ...point(-432, 272),
      name: "Складская ведомость",
      text: "«На печати архива — незамкнутый круг и три черты. Запомни знак: без него ключ не повернётся. Ключ у южного торговца открывает сундук только один раз. В архиве хранится последняя запись дозора.»",
    },
    {
      id: "fortress-last-watch",
      ...point(480, -240),
      name: "Последний дозор",
      text: "«Мы заперли северные двери, но к утру следы были внутри. Тот, кто ходит ночью, не ищет сокровищ. Он проверяет, горит ли огонь в середине леса. Если услышишь шаги — возвращайся к своему костру. Подними боковую решётку: обратный путь будет короче.»",
    },
  ].map((c) => ({ ...c, regionId: region.id })),
};

export function insideLocation(location, x, y, margin = 0) {
  const b = location.bounds;
  return (
    x >= b.x - margin &&
    x <= b.x + b.width + margin &&
    y >= b.y - margin &&
    y <= b.y + b.height + margin
  );
}

export function passageOpen(state, id) {
  return state.exploration.openedPassages.includes(id);
}
