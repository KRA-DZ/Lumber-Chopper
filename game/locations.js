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
    wall("secret-east", 96, -512, 96, -256),
    wall("secret-front-west", -192, -256, -112, -256),
    wall("secret-door", -112, -256, 16, -256, "fortress-secret"),
    wall("secret-front-east", 16, -256, 96, -256),
  ],
  rooms: [
    { name: "Двор", ...point(-160, -192), width: 320, height: 576 },
    { name: "Караульная", ...point(-544, -480), width: 320, height: 512 },
    { name: "Склад", ...point(-544, 96), width: 320, height: 320 },
    { name: "Архив", ...point(224, -480), width: 320, height: 320 },
    { name: "Тайник дозора", ...point(-160, -480), width: 224, height: 192 },
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
    {
      id: "fortress-hidden-latch",
      kind: "passage",
      name: "Кладка с тремя зарубками",
      description:
        "Три камня потемнели от копоти. На среднем видны зарубки. Порядок нажатия мог знать последний дозорный.",
      actionName: "Нажать отмеченные камни",
      openNotice: "Кладка отодвинулась. Открыт тайник последнего дозора.",
      passage: "fortress-secret",
      requiredClue: "fortress-last-watch",
      clueHint: "Нужно прочитать «Последний дозор» в восточном архиве",
      ...point(-48, -208),
      regionId: region.id,
    },
    {
      id: "fortress-watch-token",
      kind: "discovery",
      name: "Шкатулка последнего дозора",
      description:
        "Внутри потемневший медный жетон. На одной стороне — незамкнутый круг, на другой выцарапано: «Мы считали огни, а он считал нас». Эту личную находку можно сохранить в дневнике.",
      actionName: "Забрать жетон дозора",
      requiredPassage: "fortress-secret",
      key: "camp.crate",
      journal: {
        name: "Жетон последнего дозора",
        text: "Найден в тайнике Забытой крепости. Под копотью проступают незамкнутый круг и три черты — тот же знак, что на архивной печати. С обратной стороны: «Мы считали огни, а он считал нас». Дозорные следили за кострами по всему лесу. Почему отметки обрываются у центральной поляны? Жетон оставлен среди личных находок; его нельзя продать или потратить.",
      },
      ...point(-48, -416),
      regionId: region.id,
    },
    {
      id: "fortress-barricade",
      kind: "inspect",
      name: "Сломанная баррикада",
      description:
        "Доски расколоты, но обломки лежат с внешней стороны. Уходившие из крепости люди сами проломили последний заслон. В пазы забилась старая зола.",
      key: "camp.defense.barricade.broken",
      ...point(-144, 320),
      regionId: region.id,
    },
    {
      id: "fortress-last-fire",
      kind: "outpost",
      name: "Перевалочный костёр крепости",
      description:
        "Среди холодной золы остались недогоревшие поленья и следы поспешного ухода. Этот костёр можно восстановить как временный привал: принести брёвна, развести огонь и приготовить рыбу. Свет отпугивает Смотрителя в открытой части двора, но налёт пятой ночи не останавливает.",
      key: "unlitFire",
      ...point(64, 128),
      regionId: region.id,
    },
    {
      id: "fortress-abandoned-supplies",
      kind: "inspect",
      name: "Брошенные припасы",
      description:
        "Мешки и посуда остались на месте, ящики открыты. Люди ушли без еды. На доске ножом вырезано: «Не жди остальных. Неси огонь к поляне». Полезных припасов здесь уже нет.",
      key: "world.supplies",
      ...point(-464, 176),
      regionId: region.id,
    },
  ],
  dressing: [
    { id: "retreat-log", key: "world.firewood", ...point(-320, 352) },
    { id: "dropped-mug", key: "camp.dishes", ...point(-368, 192) },
    { id: "guard-crate", key: "camp.crate", ...point(-512, -192) },
    { id: "courtyard-tracks", key: "world.strangeTracks", ...point(128, 240) },
    { id: "archive-tracks", key: "world.strangeTracks", ...point(480, -16) },
    {
      id: "last-watch-tracks",
      key: "world.strangeTracks",
      ...point(320, -224),
    },
  ].map((p) => ({ ...p, regionId: region.id })),
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
      text: "«Мы заперли северные двери, но к утру следы были внутри. Он проверяет, горит ли огонь в середине леса. Я спрятал свой жетон в северной кладке двора. Найди три закопчённых камня с зарубками: нажми средний, затем крайние. Подними боковую решётку архива — до тайника вернёшься быстрее. А если услышишь шаги, беги к своему костру.»",
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
