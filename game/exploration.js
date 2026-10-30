import { CENTER, DAY_SECONDS } from "./config.js";

export const EXPLORATION = Object.freeze({
  range: 125,
  rodPrice: 50,
  keyPrice: 60,
  salvePrice: 30,
  salveHeal: 35,
  fishHeal: 20,
  fishValue: 12,
  relicValue: 40,
  offeringLogs: 3,
  fishPerDay: 4,
  biteWindow: 2.2,
});
export const ITEMS = Object.freeze({
  key: { name: "Ключ с печатью", limit: 3 },
  fish: { name: "Окунь", limit: 12 },
  resin: { name: "Древесная смола", limit: 6 },
  relic: { name: "Реликвия крепости", limit: 12 },
  salve: { name: "Лесная мазь", limit: 3 },
});
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export function createExploration({
  state,
  player,
  world,
  regions,
  nav,
  forestry,
  canAct,
  getStory = () => null,
  navigate,
  emit = () => {},
}) {
  const data = state.exploration,
    bag = data.items;
  const sites = [
    {
      id: "fishing",
      kind: "pond",
      name: "Старый причал",
      x: world.pond.x + 265,
      y: world.pond.y + 175,
      regionId: "-1:0",
    },
    {
      id: "ancient-roots",
      kind: "ancient",
      name: "Корни древнего дуба",
      x: world.ancientTree.x,
      y: world.ancientTree.y + 90,
      regionId: "1:0",
    },
    {
      id: "mysterious-merchant",
      kind: "merchant",
      name: "Загадочный торговец",
      x: world.merchant.x,
      y: world.merchant.y + 75,
      regionId: "0:1",
    },
    {
      id: "camp-kitchen",
      kind: "kitchen",
      name: "Костёр лагеря",
      x: CENTER.x,
      y: CENTER.y + 48,
      regionId: "0:0",
    },
    ...world.landmarks
      .filter((p) => p.type === "chest")
      .map((p) => ({ ...p, kind: "chest" })),
  ];
  const byId = new Map(sites.map((p) => [p.id, p]));
  let context = null,
    pending = null,
    fishing = null,
    revision = 0,
    routeTimer = 0;
  const get = (id) => byId.get(id);
  const available = (s) =>
    !!s && regions.isOpen(s) && (s.kind !== "kitchen" || state.campLevel > 0);
  const near = (s) =>
    available(s) &&
    distance(player, s) < EXPLORATION.range &&
    nav.hasLineOfSight(player, s);
  const isDay = () => state.worldTime < DAY_SECONDS / 2;
  const caughtToday = () =>
    data.fishDay === state.calendarDay ? data.fishToday : 0;
  function changed(type, event = {}) {
    revision++;
    emit(type, event);
  }
  function cancelFishing(reason = "Снасти убраны.") {
    if (!fishing) return;
    fishing = null;
    changed("fishing-ended", { reason });
  }
  function close() {
    context = null;
  }
  function cancelAll(reason) {
    context = pending = null;
    cancelFishing(reason);
  }
  function route(s) {
    navigate(s.x, s.y + (s.kind === "chest" ? 40 : 15));
    routeTimer = 1.2;
  }
  function ready(s) {
    pending = null;
    context = s.id;
    player.path = [];
    changed("site-ready", { site: s });
  }
  function request(id) {
    const s = get(id);
    if (!canAct() || !available(s)) return false;
    cancelAll();
    route(s);
    if (near(s)) ready(s);
    else pending = id;
    return true;
  }
  function nearest() {
    return sites
      .filter(near)
      .sort((a, b) => distance(player, a) - distance(player, b))[0];
  }
  function chestLoot(id) {
    const s = get(id);
    if (s?.kind !== "chest") return null;
    const r = regions.all.find((r) => r.id === s.regionId),
      index = Number(s.id.split(":").at(-1));
    return {
      coins: 40 + 15 * (Math.abs(r.gx) + Math.abs(r.gy)) + index * 10,
      relic: 1,
    };
  }
  // Quotes and commands share the same conditions; the DOM never edits inventory or money.
  function offers(id) {
    const s = get(id);
    if (!s) return [];
    const rows = [];
    const add = (action, name, description, reason = "") =>
      rows.push({ action, name, description, enabled: !reason, reason });
    if (s.kind === "merchant") {
      add(
        "buy-rod",
        `Удочка · ${EXPLORATION.rodPrice} монет`,
        "Открывает ловлю у западного причала. Удочка остаётся у вас.",
        data.rod
          ? "Удочка уже есть"
          : state.coins < EXPLORATION.rodPrice
            ? "Не хватает монет"
            : "",
      );
      add(
        "buy-key",
        `Ключ с печатью · ${EXPLORATION.keyPrice} монет`,
        "Открывает один сундук в руинах. До трёх ключей в сумке.",
        bag.key >= ITEMS.key.limit
          ? "Сумка ключей полна"
          : state.coins < EXPLORATION.keyPrice
            ? "Не хватает монет"
            : "",
      );
      add(
        "buy-salve",
        `Лесная мазь · ${EXPLORATION.salvePrice} монет + 1 смола`,
        `Восстанавливает ${EXPLORATION.salveHeal} HP. Используется из сумки; до трёх штук.`,
        bag.salve >= ITEMS.salve.limit
          ? "Мази достаточно"
          : bag.resin < 1
            ? "Нужна смола древнего дуба"
            : state.coins < EXPLORATION.salvePrice
              ? "Не хватает монет"
              : "",
      );
      add(
        "sell-fish",
        `Продать рыбу · ${bag.fish * EXPLORATION.fishValue} монет`,
        `${bag.fish} шт. по ${EXPLORATION.fishValue} монет.`,
        bag.fish ? "" : "Рыбы пока нет",
      );
      add(
        "sell-relic",
        `Продать реликвии · ${bag.relic * EXPLORATION.relicValue} монет`,
        `${bag.relic} шт. по ${EXPLORATION.relicValue} монет.`,
        bag.relic ? "" : "Реликвий пока нет",
      );
    } else if (s.kind === "chest") {
      const loot = chestLoot(id);
      add(
        "open-chest",
        "Снять печать · 1 ключ",
        `Внутри: ${loot.coins} монет и реликвия. Каждый сундук открывается один раз.`,
        data.openedChests.includes(id)
          ? "Уже открыт"
          : bag.key < 1
            ? "Ключ продаёт торговец на юге"
            : bag.relic >= ITEMS.relic.limit
              ? "Сначала освободите место для реликвии"
              : "",
      );
    } else if (s.kind === "pond") {
      add(
        "fish",
        "Забросить удочку",
        `Дождитесь поклёвки и нажмите «Подсечь», E или пробел за ${EXPLORATION.biteWindow} с. Сегодня поймано ${caughtToday()}/${EXPLORATION.fishPerDay}.`,
        !data.rod
          ? "Удочка продаётся у торговца на юге"
          : !isDay()
            ? "Ночью вода неспокойна. Вернитесь днём"
            : caughtToday() >= EXPLORATION.fishPerDay
              ? "Рыба затаилась до следующего дня"
              : bag.fish >= ITEMS.fish.limit
                ? "Сумка для рыбы полна"
                : "",
      );
    } else if (s.kind === "ancient") {
      add(
        "offer-logs",
        `Оставить ${EXPLORATION.offeringLogs} бревна у корней`,
        `Раз в игровой день дуб отдаёт одну смолу для мази. Рубить древний ствол герой не может.`,
        !isDay()
          ? "Корни затихли до рассвета"
          : data.offeringDay === state.calendarDay
            ? "Сегодня дар уже получен"
            : bag.resin >= ITEMS.resin.limit
              ? "Смолы достаточно"
              : state.cargo.length < EXPLORATION.offeringLogs
                ? "Нужно принести три бревна в стопке"
                : "",
      );
    } else if (s.kind === "kitchen") {
      add(
        "cook-fish",
        `Приготовить рыбу · +${EXPLORATION.fishHeal} HP`,
        "Тратит одну рыбу и восстанавливает здоровье героя. При полном здоровье рыба остаётся в сумке.",
        !bag.fish
          ? "Сначала поймайте рыбу"
          : state.health >= state.maxHealth
            ? "Здоровье полное"
            : "",
      );
    }
    return [...rows, ...(getStory()?.offers(s) || [])];
  }
  function perform(id, action) {
    const s = get(id),
      offer = offers(id).find((o) => o.action === action);
    // A paused inspection allows its quoted transaction, never remote or forged actions.
    if (state.gameOver || context !== id || !near(s) || !offer?.enabled)
      return false;
    if (action.startsWith("story:"))
      return getStory()?.performAt(s, action) || false;
    let event = { site: s, action };
    if (action === "buy-rod") {
      state.coins -= EXPLORATION.rodPrice;
      data.rod = true;
    } else if (action === "buy-key") {
      state.coins -= EXPLORATION.keyPrice;
      bag.key++;
    } else if (action === "buy-salve") {
      state.coins -= EXPLORATION.salvePrice;
      bag.resin--;
      bag.salve++;
    } else if (action === "sell-fish" || action === "sell-relic") {
      const item = action === "sell-fish" ? "fish" : "relic",
        coins =
          bag[item] *
          (item === "fish" ? EXPLORATION.fishValue : EXPLORATION.relicValue);
      state.coins += coins;
      event.coins = coins;
      bag[item] = 0;
    } else if (action === "open-chest") {
      const loot = chestLoot(id);
      bag.key--;
      bag.relic++;
      state.coins += loot.coins;
      data.openedChests.push(id);
      event.loot = loot;
    } else if (action === "offer-logs") {
      for (let i = 0; i < EXPLORATION.offeringLogs; i++) forestry.takeCargo();
      data.offeringDay = state.calendarDay;
      bag.resin++;
    } else if (action === "cook-fish") {
      bag.fish--;
      state.health = Math.min(
        state.maxHealth,
        state.health + EXPLORATION.fishHeal,
      );
    } else if (action === "fish") {
      data.casts++;
      pending = null;
      context = null;
      player.path = [];
      player.direction = "left";
      player.facing = -1;
      fishing = {
        siteId: id,
        phase: "waiting",
        timer: 4 + (data.casts % 3),
        health: state.health,
      };
    } else return false;
    changed("activity-completed", event);
    return true;
  }
  function useItem(id) {
    if (
      id !== "salve" ||
      state.gameOver ||
      !bag.salve ||
      state.health >= state.maxHealth
    )
      return false;
    bag.salve--;
    state.health = Math.min(
      state.maxHealth,
      state.health + EXPLORATION.salveHeal,
    );
    changed("item-used", { id, health: state.health });
    return true;
  }
  function reel() {
    if (!canAct() || !fishing) return false;
    if (
      !near(get(fishing.siteId)) ||
      !isDay() ||
      state.health < fishing.health
    ) {
      cancelFishing("Рыбалка прервана.");
      return false;
    }
    if (fishing.phase !== "bite") {
      cancelFishing("Слишком рано. Рыба ещё не клюнула.");
      return false;
    }
    if (bag.fish >= ITEMS.fish.limit) {
      cancelFishing("В сумке нет места.");
      return false;
    }
    if (data.fishDay !== state.calendarDay) {
      data.fishDay = state.calendarDay;
      data.fishToday = 0;
    }
    bag.fish++;
    data.fishToday++;
    data.totalFishCaught++;
    fishing = null;
    changed("fish-caught", { count: bag.fish });
    return true;
  }
  function update(dt) {
    if (!canAct() || !Number.isFinite(dt) || dt <= 0) return;
    routeTimer = Math.max(0, routeTimer - dt);
    if (pending) {
      const s = get(pending);
      if (!available(s)) pending = null;
      else if (near(s)) ready(s);
      else if (!player.path.length && routeTimer <= 0) {
        const id = pending;
        route(s);
        pending = id;
      }
    }
    if (!fishing) return;
    if (
      !near(get(fishing.siteId)) ||
      !isDay() ||
      player.moving ||
      state.health < fishing.health
    ) {
      cancelFishing("Снасти убраны: движение, опасность или наступление ночи.");
      return;
    }
    fishing.timer -= dt;
    if (fishing.timer <= 0) {
      if (fishing.phase === "waiting") {
        fishing.phase = "bite";
        fishing.timer = EXPLORATION.biteWindow;
        changed("fish-bite", {});
      } else cancelFishing("Рыба сорвалась. Попробуйте ещё раз.");
    }
  }
  function regionSummary(regionId) {
    const s = sites.filter((s) => s.regionId === regionId),
      chests = s.filter((s) => s.kind === "chest");
    if (chests.length)
      return `Сундуки: ${chests.filter((s) => !data.openedChests.includes(s.id)).length}/${chests.length}`;
    if (s.some((s) => s.kind === "pond"))
      return `Рыба сегодня: ${caughtToday()}/${EXPLORATION.fishPerDay}`;
    if (s.some((s) => s.kind === "ancient"))
      return data.offeringDay === state.calendarDay
        ? "Смола получена"
        : "Смола у корней";
    if (s.some((s) => s.kind === "merchant")) return "Ключи, удочка, мазь";
    return "Открыто";
  }
  function regionDestination(region) {
    const list = sites.filter(
      (s) => s.regionId === region.id && s.kind !== "kitchen",
    );
    return (
      list.find(
        (s) => s.kind !== "chest" || !data.openedChests.includes(s.id),
      ) ||
      list[0] || { x: region.cx, y: region.cy }
    );
  }
  return {
    sites,
    get,
    available,
    near,
    nearest,
    request,
    close,
    cancelAll,
    cancelFishing,
    offers,
    perform,
    useItem,
    reel,
    update,
    chestLoot,
    regionSummary,
    regionDestination,
    caughtToday,
    get context() {
      return context;
    },
    get pending() {
      return pending;
    },
    get fishing() {
      return fishing;
    },
    get revision() {
      return revision;
    },
  };
}
