import { NIGHT_START } from "./cycle.js";

export const WORKERS = Object.freeze({
  max: 3,
  hirePrices: [150, 350, 750],
  upgradePrices: [200, 500],
  stockLimit: 30,
  logValue: 8,
  depot: Object.freeze({ x: 1710, y: 1780 }),
  recallTime: NIGHT_START - 60,
  saleInterval: 0.8,
  pathInterval: 0.3,
});
export const WORKER_PHASES = Object.freeze({
  outbound: "К дубу",
  cutting: "Рубит",
  delivery: "На склад",
  resting: "У костра",
  waiting: "Склад заполнен",
  blocked: "Нет прохода",
});

// Engine-independent, bounded NPC state machine. Only the ancient oak produces logs.
export function createWorkers({
  state,
  player,
  world,
  regions,
  nav,
  forestry,
  activeBuyer,
  sale,
  getSurvival,
  emit = () => {},
}) {
  const data = state.workforce,
    crew = data.crew;
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  let routeBudget = 0,
    routeTurn = 0,
    saleTimer = 0;
  const available = () =>
    state.campLevel >= 2 && regions.isOpen(world.ancientTree);
  const atDepot = () =>
    distance(player, WORKERS.depot) < 140 &&
    nav.hasLineOfSight(player, WORKERS.depot);
  const speed = () => 140 + data.level * 15;
  const capacity = () => 4 + data.level * 2;
  const chopSeconds = () => 2.5 - data.level * 0.4;
  const daytime = () => state.worldTime < WORKERS.recallTime;
  function changed(type, event = {}) {
    emit(type, event);
  }
  function hire() {
    const price = WORKERS.hirePrices[crew.length];
    if (
      state.gameOver ||
      !atDepot() ||
      !available() ||
      !daytime() ||
      price == null ||
      state.coins < price
    )
      return false;
    state.coins -= price;
    const id = crew.length,
      p = nav.nearestGround(1580 + id * 36, 1760);
    crew.push({
      id,
      name: ["Фома", "Марта", "Лука"][id],
      ...p,
      phase: "resting",
      path: [],
      pathVersion: nav.version,
      routeKey: "",
      repath: 0,
      cargo: [],
      cutTimer: 0,
      unloadTimer: 0,
      swing: 0,
      moving: false,
      direction: "down",
      dangerUntil: 0,
      clock: 0,
    });
    changed("worker-hired", { id, price });
    return true;
  }
  function upgrade() {
    const price = WORKERS.upgradePrices[data.level];
    if (
      state.gameOver ||
      !atDepot() ||
      !available() ||
      !crew.length ||
      !daytime() ||
      price == null ||
      state.coins < price
    )
      return false;
    state.coins -= price;
    data.level++;
    changed("workers-upgraded", { level: data.level, price });
    return true;
  }
  function setRecalled(value) {
    if (state.gameOver || typeof value !== "boolean" || !crew.length)
      return false;
    data.recalled = value;
    changed("workers-recalled", { recalled: value });
    return true;
  }
  function setAutoSell(value) {
    if (state.gameOver || typeof value !== "boolean" || !crew.length)
      return false;
    data.autoSell = value;
    changed("worker-sales-changed");
    return true;
  }
  function withdraw() {
    if (
      state.gameOver ||
      !atDepot() ||
      !data.stock.length ||
      state.wood >= state.maxWood
    )
      return false;
    const value = data.stock[data.stock.length - 1];
    if (!forestry.addCargo(value)) return false;
    data.stock.pop();
    changed("worker-stock-taken");
    return true;
  }
  function goalFor(w, kind) {
    if (kind === "oak")
      return nav.nearestGround(
        world.ancientTree.x - 78 + w.id * 64,
        world.ancientTree.y + 88,
      );
    if (kind === "depot")
      return nav.nearestGround(WORKERS.depot.x + w.id * 16, WORKERS.depot.y);
    return nav.nearestGround(1570 + w.id * 38, 1760);
  }
  function route(w, kind) {
    const key = `${kind}:${nav.version}`;
    if (w.routeKey !== key) {
      w.path = [];
      w.routeKey = key;
      w.goal = goalFor(w, kind);
      w.repath = 0;
    }
    if (
      distance(w, w.goal) >= 10 &&
      w.repath <= 0 &&
      (!w.path.length || w.pathVersion !== nav.version) &&
      routeBudget <= 0
    ) {
      w.path = nav.findPath(w, w.goal);
      w.pathVersion = nav.version;
      w.repath = w.path.length ? 1 : 3;
      routeBudget = WORKERS.pathInterval;
      routeTurn = (w.id + 1) % crew.length;
    }
    return w.goal;
  }
  function move(w, dt) {
    const x = w.x,
      y = w.y,
      moved = nav.followPath(w, dt, speed());
    w.moving = moved > 0.01;
    if (w.moving) {
      const dx = w.x - x,
        dy = w.y - y;
      w.direction =
        Math.abs(dx) > Math.abs(dy)
          ? dx < 0
            ? "left"
            : "right"
          : dy < 0
            ? "up"
            : "down";
    } else if (w.path.length) {
      w.path = [];
      w.repath = Math.max(w.repath, 1);
    }
  }
  function update(dt) {
    if (state.gameOver || dt <= 0) return;
    saleTimer = Math.max(0, saleTimer - dt);
    routeBudget = Math.max(0, routeBudget - dt);
    // The player's own stack always gets first use of a waiting customer's order.
    const buyer = activeBuyer();
    if (
      data.autoSell &&
      saleTimer <= 0 &&
      data.stock.length &&
      buyer &&
      !(state.wood > 0 && distance(player, sale) < sale.radius)
    ) {
      const value = data.stock.shift();
      buyer.load++;
      buyer.thanks = 1.5;
      state.coins += value;
      data.earned += value;
      saleTimer = WORKERS.saleInterval;
      changed("worker-log-sold", { buyer, value });
    }
    if (!crew.length) return;
    const threats = getSurvival(),
      danger = [
        ...(threats?.raiders || []),
        ...(threats?.residents || []),
        ...(threats?.monster ? [threats.monster] : []),
      ];
    // Rotate consideration, never more than one A* every 0.3 active seconds.
    const first = routeTurn;
    for (let i = 0; i < crew.length; i++) {
      const w = crew[(first + i) % crew.length];
      w.clock += dt;
      w.repath = Math.max(0, w.repath - dt);
      w.swing = Math.max(0, w.swing - dt);
      w.unloadTimer = Math.max(0, w.unloadTimer - dt);
      w.moving = false;
      if (danger.some((e) => distance(w, e) < 320)) w.dangerUntil = w.clock + 8;
      const retiring =
        !daytime() || data.recalled || !available() || w.dangerUntil > w.clock;
      const kind = retiring
        ? w.cargo.length
          ? "depot"
          : "rest"
        : w.cargo.length >= capacity() ||
            (w.job === "depot" && w.cargo.length > 0) ||
            data.stock.length >= WORKERS.stockLimit
          ? "depot"
          : "oak";
      w.job = kind;
      const goal = route(w, kind);
      const arrived = distance(w, goal) < 10;
      if (!arrived) {
        w.phase = w.path.length
          ? kind === "oak"
            ? "outbound"
            : "delivery"
          : "blocked";
        move(w, dt);
        continue;
      }
      w.path = [];
      if (kind === "oak" && distance(w, world.ancientTree) > 180) {
        // nearestGround may fall back to camp when a site has no valid footing.
        w.phase = "blocked";
        continue;
      }
      if (kind === "oak") {
        w.phase = "cutting";
        w.direction = "up";
        // Work accumulates only beside the oak and in daylight. No tree HP mutation.
        w.cutTimer += dt;
        if (w.cutTimer >= chopSeconds()) {
          w.cutTimer -= chopSeconds();
          w.cargo.push(WORKERS.logValue);
          w.swing = 0.3;
          changed("worker-chopped", { worker: w });
        }
      } else if (kind === "depot" && w.cargo.length) {
        w.phase =
          data.stock.length >= WORKERS.stockLimit ? "waiting" : "delivery";
        if (w.unloadTimer <= 0 && data.stock.length < WORKERS.stockLimit) {
          data.stock.push(w.cargo.pop());
          data.delivered++;
          w.unloadTimer = 0.35;
          changed("worker-delivered", { worker: w });
        }
      } else {
        w.phase = retiring ? "resting" : "waiting";
        w.direction = "down";
      }
    }
  }
  return {
    crew,
    hire,
    upgrade,
    withdraw,
    setRecalled,
    setAutoSell,
    update,
    available,
    atDepot,
    daytime,
    speed,
    capacity,
    chopSeconds,
    get data() {
      return data;
    },
    get hirePrice() {
      return WORKERS.hirePrices[crew.length] ?? null;
    },
    get upgradePrice() {
      return WORKERS.upgradePrices[data.level] ?? null;
    },
  };
}
