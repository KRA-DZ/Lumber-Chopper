import { CENTER, DAY_SECONDS, STAGES, RAID_INTERVAL } from "./config.js";
import { NIGHT_START } from "./cycle.js";
import { upgradeOffer } from "../economy.js";

export function countdown(seconds) {
  const n = Math.max(0, Math.ceil(seconds - 1e-7));
  return `${Math.floor(n / 60)
    .toString()
    .padStart(2, "0")}:${(n % 60).toString().padStart(2, "0")}`;
}
// One source of truth for HUD, journal and tests. Durations are active-game seconds.
export function dayOverview(state) {
  const night = state.worldTime >= NIGHT_START,
    day = state.calendarDay + 1;
  const raidTonight = day % RAID_INTERVAL === 0;
  const raidActive = night && raidTonight;
  const nextRaid = raidActive
    ? day
    : Math.ceil(day / RAID_INTERVAL) * RAID_INTERVAL;
  return {
    night,
    day,
    raidTonight,
    raidActive,
    nextRaid,
    phase: state.worldTime / DAY_SECONDS,
    boundarySeconds: (night ? DAY_SECONDS : NIGHT_START) - state.worldTime,
    raidSeconds: raidActive
      ? 0
      : (nextRaid - day) * DAY_SECONDS + NIGHT_START - state.worldTime,
    sunsetSoon: !night && NIGHT_START - state.worldTime <= 60,
    sunsetUrgent: !night && NIGHT_START - state.worldTime <= 15,
  };
}
export function shopAdvice(state) {
  if (!state.carryLevel)
    return { id: "carry", text: "Сначала переноска: 2 → 4 бревна за рейс." };
  if (!state.axeLevel)
    return {
      id: "axe",
      text: "Для рубки и защиты: урон 1 → 2, автоматические удары чаще.",
    };
  return null;
}
export function firstDaysPlan(c) {
  const s = c.state;
  const noteIds = new Set(
    (c.world.clues || []).filter((n) => n.id !== "note").map((n) => n.id),
  );
  return [
    {
      day: 1,
      title: "Первые брёвна и безопасная ночь",
      goals: [
        ["Продать древесину", c.tutorial.sold],
        ["Купить переноску", s.carryLevel >= 1],
        ["Построить костёр", s.campLevel >= 1],
        ["Пережить ночь", s.nightsSurvived >= 1],
      ],
    },
    {
      day: 2,
      title: "Обустройте лагерь",
      goals: [
        ["Построить палатку", s.campLevel >= 2],
        ["Купить первый топор", s.axeLevel >= 1],
        ["Прочитать первое письмо", s.readClues.includes("first-dawn")],
      ],
    },
    {
      day: 3,
      title: "Исследуйте соседний участок",
      goals: [
        ["Открыть соседний регион", (s.unlockedRegions?.length || 1) > 1],
        [
          "Прочитать находку за пределами лагеря",
          s.readClues.some((id) => noteIds.has(id)),
        ],
      ],
    },
    {
      day: 4,
      title: "Подготовьтесь к пятому закату",
      goals: [
        ["Построить забор", s.campLevel >= 3],
        ["Вооружиться новым топором", s.axeLevel >= 1],
        [
          "Починить лагерь до полной прочности",
          s.campHealth === s.maxCampHealth,
        ],
      ],
    },
  ];
}
export function firstDaysGuide(c) {
  const s = c.state,
    t = c.tutorial,
    time = dayOverview(s),
    safe = c.survival?.isSafe(c.player) ?? false;
  const step = !t.cut
    ? 0
    : !t.sold
      ? 1
      : !s.carryLevel
        ? 2
        : s.campLevel < 1
          ? 3
          : !(t.sheltered || s.nightsSurvived)
            ? 4
            : !s.nightsSurvived
              ? 5
              : !s.claimedQuests.includes("warm-dawn")
                ? 6
                : 7;
  // Night safety takes precedence without consuming or skipping tutorial objectives.
  if (time.night && c.survival) {
    if (!safe && c.survival.monster?.phase === "windup")
      return {
        step,
        id: "dodge",
        title: "Готовится удар · выйдите из круга!",
        text: "Красный круг показывает место удара. Смотритель замер и не двигает эту область. Уходите в сторону или бегите к свету.",
        action: "camp",
        button: "К свету лагеря",
      };
    if (c.survival.pending || c.survival.raiders.length)
      return {
        step,
        id: "raid",
        title: `Ночь ${time.day} · защитите лагерь`,
        text: "Налётчики боятся топора, а Смотритель — света лагеря. Голубая площадка чинит базу брёвнами.",
        action: safe ? null : "camp",
        button: "К лагерю",
      };
    if (!safe)
      return {
        step,
        id: "return",
        title: "Опасность · вернитесь к свету",
        text:
          c.survival.monster?.phase === "search"
            ? "Смотритель ищет след. Стволы закрывают прямой обзор, но шаги рядом и рубка выдают вас. Возвращайтесь к свету."
            : "Смотритель неуязвим и медленнее героя. Бегите к свету лагеря. Кнопка только прокладывает путь — в дороге вы уязвимы.",
        action: "camp",
        button: "К свету лагеря",
      };
    if (step < 6)
      return {
        step,
        id: "shelter",
        title:
          step === 4
            ? "5/7 · Вы в круге света"
            : step === 5
              ? "6/7 · Переживите первую ночь"
              : "Вы в круге света",
        text: "Смотритель не атакует внутри круга. Можно дождаться утра или рискнуть в лесу. На рассвете придёт письмо; открытые меню останавливают время.",
        action: s.wood > 0 && s.campLevel < 1 ? "build" : null,
        button: "Вложить брёвна в костёр",
      };
  }
  if (time.sunsetSoon)
    return {
      step,
      id: "sunset",
      title: `До заката ${countdown(time.boundarySeconds)}${time.raidTonight ? " · сегодня налёт" : ""}`,
      text: safe
        ? "Вы уже у лагеря. Покупатели уходят в 18:00. Свет защищает от Смотрителя, а от налётчиков нужен топор."
        : "Завершите дела и возвращайтесь к свету. Кнопка прокладывает обычный путь, без телепортации.",
      action: !safe ? "camp" : s.wood > 0 && s.campLevel < 1 ? "build" : null,
      button: !safe ? "К свету лагеря" : "Достроить костёр",
    };
  const guide = (id, title, text, action = null, button = "") => ({
    id,
    step,
    title,
    text,
    action,
    button,
  });
  if (step === 0)
    return guide(
      "cut",
      "1/7 · Первые брёвна",
      "WASD / стрелки или касание земли — движение. Подойдите к дереву: герой рубит сам. Нажатия по дереву ускоряют рубку.",
      "trees",
      "К ближайшему дереву",
    );
  if (step === 1)
    return guide(
      "sell",
      "2/7 · Первая продажа",
      s.wood
        ? "Встаньте с брёвнами на золотую площадку. Покупатель забирает их по одному и платит монетами."
        : "Брёвна ждут у пня. Подберите их и отнесите на золотую площадку.",
      s.wood ? "sell" : "trees",
      s.wood ? "К продаже" : "За брёвнами",
    );
  if (step === 2) {
    const price = upgradeOffer(s, "carry").price,
      missing = Math.max(0, price - s.coins);
    return guide(
      "carry",
      "3/7 · Носите больше",
      missing
        ? `Первая переноска стоит ${price} монет. Нужно ещё ${missing}. Продайте древесину — получите 4 места вместо 2.`
        : "Монет хватает! Купите «Силу переноски» в лавке: вместимость вырастет с 2 до 4.",
      missing ? (s.wood ? "sell" : "trees") : "shop",
      missing
        ? s.wood
          ? "Продать брёвна"
          : "Добыть древесину"
        : "Купить переноску",
    );
  }
  if (step === 3) {
    const needed = STAGES[0].cost - s.buildWood,
      batch = Math.min(s.maxWood, needed),
      ready = s.wood >= batch;
    return guide(
      "fire",
      "4/7 · Расширьте круг света",
      `Костру ещё ${needed} брёвен. Для этого рейса: ${s.wood}/${batch}. Голубая площадка строит, золотая — продаёт. Остатки ждут у пней.`,
      ready ? "build" : "trees",
      ready
        ? "К строительству"
        : s.wood
          ? "Ещё брёвна"
          : "За дровами для костра",
    );
  }
  if (step === 4)
    return guide(
      "prepare",
      "5/7 · Подготовьтесь к ночи",
      `До заката ${countdown(time.boundarySeconds)}. Можно исследовать окрестности. Ночью Смотритель неуязвим — вернитесь в светлый круг лагеря.`,
      "camp",
      "Путь к лагерю",
    );
  if (step === 5)
    return guide(
      "dawn",
      "6/7 · Дождитесь рассвета",
      "Первая ночь ещё не закончилась. Держитесь света; время идёт только при закрытых меню.",
      "camp",
      "К лагерю",
    );
  if (step === 6)
    return guide(
      "letter",
      "7/7 · Письмо на рассвете",
      "Откройте дневник (J), прочитайте письмо и заберите 20 монет за «Первый тёплый рассвет».",
      "journal",
      "Прочитать письмо",
    );
  const plan = firstDaysPlan(c);
  const today = plan[Math.min(3, Math.max(1, s.calendarDay))];
  const goal = today.goals.find(([, done]) => !done);
  if (goal)
    return guide(
      "plan",
      `День ${today.day} · ${today.title}`,
      `${goal[0]}. Все цели можно выполнить заранее. Подробности — в дневнике.`,
      "journal",
      "План первых дней",
    );
  return guide(
    "free",
    "Лагерь готов к новым открытиям",
    `Исследуйте регионы и собирайте находки. ${time.raidActive ? "Сегодня налёт." : `Следующий налёт — ночь ${time.nextRaid}, через ${countdown(time.raidSeconds)}.`}`,
    "map",
    "Карта леса",
  );
}
// This command computes a destination only on demand, not every frame.
export function guideDestination(c, action) {
  if (action === "camp") return { x: CENTER.x, y: CENTER.y + 120 };
  if (action === "sell") return c.sale;
  if (action === "build") return c.build;
  if (action !== "trees") return null;
  if (c.state.wood < c.state.maxWood) {
    const piles = [...c.forestry.piles.values()]
      .filter((p) => c.accessible(p))
      .sort(
        (a, b) =>
          Math.hypot(a.x - c.player.x, a.y - c.player.y) -
          Math.hypot(b.x - c.player.x, b.y - c.player.y),
      );
    if (piles.length) return piles[0];
  }
  const tree = c.trees
    .filter((t) => t.hp > 0 && !t.workerOnly && c.treeAccessible(t))
    .sort(
      (a, b) =>
        Math.hypot(a.x - c.player.x, a.y - c.player.y) -
        Math.hypot(b.x - c.player.x, b.y - c.player.y),
    )[0];
  return tree ? { x: tree.x, y: tree.y + 42 } : null;
}
