import { hasCampBuilding } from "./camp-projects.js";
import { workerAppearance } from "./appearances.js";
import { NIGHT_START } from "./cycle.js";
import { createWorkerJobs, WORKER_ROLES, workerRole, workerSlots, WORKER_JOBS } from "./worker-jobs.js";
import { campStorageLimit, materialLimit } from "./camp-industry-config.js";

export const WORKERS = Object.freeze({
  max: 4,
  hirePrices: [150, 350, 750, 1250],
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
  waiting: "Ожидает",
  blocked: "Нет прохода",
  mining: "Добывает камень",
  repairing: "Чинит",
});

// Bounded NPC scheduler; specialists use the same path budget and real shared resources.
export function createWorkers({
  state,
  player,
  world,
  regions,
  nav,
  forestry,
  activeBuyer,
  sale,
  defenses = null,
  getSurvival,
  onIncome = null,
  playersAtSale = null,
  emit = () => {},
}) {
  const data = state.workforce,
    crew = data.crew;
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  let routeBudget = 0,
    routeTurn = 0,
    saleTimer = 0;
  const available = () => hasCampBuilding(state,"tent");
  const atDepot = () =>
    !player.room && !player.menuOpen && distance(player, WORKERS.depot) < 140 &&
    nav.hasLineOfSight(player, WORKERS.depot);
  const speed = () => 140 + data.level * 15;
  const capacity = () => 4 + data.level * 2;
  const chopSeconds = () => 2.5 - data.level * 0.4;
  const daytime = () => state.worldTime < WORKERS.recallTime;
  const slots=()=>Math.min(WORKERS.max,workerSlots(state));
  const jobs=createWorkerJobs({state,world,regions,nav,defenses,data,emit});
  const logStock=()=>data.logTarget==="store"?state.logStore:data.stock;
  const stockLimit=()=>data.logTarget==="store"?campStorageLimit(state):WORKERS.stockLimit;
  const canManage=()=>!state.gameOver&&state.health>0&&!player.menuOpen&&!player.room;
  function changed(type, event = {}) {
    emit(type, event);
  }
  function hireReason(role="lumberjack"){
    if(!WORKER_ROLES[role])return "Неизвестная профессия";
    if(!canManage())return "Игрок недоступен";
    if(!atDepot())return "Подойдите к складу работников";
    if(!available())return "Сначала постройте палатку";
    if(!daytime())return "Найм доступен утром и днём";
    if(crew.length>=slots())return "Нет мест: улучшите обустройство дома";
    if(state.coins<WORKERS.hirePrices[crew.length])return "Недостаточно монет";
    return "";
  }
  function hire(role="lumberjack") {
    const price = WORKERS.hirePrices[crew.length];
    if (
      hireReason(role)
    )
      return false;
    state.coins -= price;
    const id = crew.length,
      p = nav.nearestGround(1580 + id * 36, 1760);
    crew.push({
      id,
      name: ["Фома", "Марта", "Лука", "Егор"][id],
      role, pendingRole:null, stoneCargo:0, workTarget:null, workScan:0, workTimer:0, reason:"Готовится к работе",
      appearance: workerAppearance(id),
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
    changed("worker-hired", { id, price, role });
    return true;
  }
  function upgrade() {
    const price = WORKERS.upgradePrices[data.level];
    if (
      !canManage() ||
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
    if (!canManage() || typeof value !== "boolean" || !crew.length)
      return false;
    data.recalled = value;
    changed("workers-recalled", { recalled: value });
    return true;
  }
  function setAutoSell(value) {
    if (!canManage() || typeof value !== "boolean" || !crew.length)
      return false;
    data.autoSell = value;
    changed("worker-sales-changed");
    return true;
  }
  function setLogTarget(value){
    if(!canManage()||!["sell","store"].includes(value))return false;
    data.logTarget=value;changed("worker-destination-changed");return true;
  }
  function setRepairReserve(value){
    if(!canManage()||!Number.isInteger(value)||value<0||value>WORKER_JOBS.repairReserveMax)return false;
    data.repairReserve=value;changed("worker-reserve-changed");return true;
  }
  function assign(id,role){
    const w=crew.find(w=>w.id===id);
    if(!w||!canManage()||!atDepot()||!WORKER_ROLES[role])return false;
    w.pendingRole=role===workerRole(w)?null:role;
    w.path=[];w.routeKey="";w.repath=0;w.workTimer=0;
    changed("worker-assigned",{id,role});return true;
  }
  function transferStock(){
    if(!canManage()||!atDepot())return 0;
    let count=0;while(data.stock.length&&state.logStore.length<campStorageLimit(state)){state.logStore.push(data.stock.pop());count++;}
    if(count)changed("worker-stock-stored",{count});return count;
  }
  function withdraw() {
    if (
      state.gameOver || state.health <= 0 ||
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
    if(kind.startsWith("rock:")||kind.startsWith("repair:"))return jobs.goal(w,kind)||nav.nearestGround(1570+w.id*38,1760);
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
      if(!w.path.length&&(kind.startsWith("rock:")||kind.startsWith("repair:")))jobs.blocked(w);
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
    if (state.gameOver || !Number.isFinite(dt) || dt <= 0) return;
    saleTimer = Math.max(0, saleTimer - dt);
    routeBudget = Math.max(0, routeBudget - dt);
    // The player's own stack always gets first use of a waiting customer's order.
    const buyer = activeBuyer();
    if (
      data.autoSell &&
      data.logTarget!=="store" &&
      saleTimer <= 0 &&
      data.stock.length &&
      buyer &&
      !(playersAtSale ? playersAtSale() : state.wood > 0 && distance(player, sale) < sale.radius)
    ) {
      const value = data.stock.shift();
      buyer.load++;
      buyer.thanks = 1.5;
      if (onIncome) onIncome(value); else state.coins += value;
      data.earned += value;
      state.campMilestones.sold=true;
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
      w.workScan=Math.max(0,w.workScan-dt);
      w.moving = false;
      if (danger.some((e) => distance(w, e) < 320)) w.dangerUntil = w.clock + 8;
      const nightRepair=workerRole(w)==="repairer"&&hasCampBuilding(state,"fire")&&state.campFuel>0;
      const retiring =
        (!daytime()&&!nightRepair) || data.recalled || !available() || w.dangerUntil > w.clock || !!w.pendingRole;
      const specialist=!retiring&&workerRole(w)!=="lumberjack"?jobs.select(w,danger):null;
      const kind = retiring
        ? w.cargo.length||w.stoneCargo
          ? "depot"
          : "rest"
        : specialist?specialist.kind:!regions.isOpen(world.ancientTree)?"rest":w.cargo.length >= capacity() ||
            (w.job === "depot" && w.cargo.length > 0) ||
            logStock().length >= stockLimit()
          ? "depot"
          : "oak";
      w.reason=retiring?(w.pendingRole?"Возвращается для смены профессии":w.dangerUntil>w.clock?"Рядом враги":data.recalled?"Команда отозвана":!available()?"Нужна палатка":"Отдых до утра"):
        specialist?.reason||(!regions.isOpen(world.ancientTree)?"Откройте Дубовую рощу":logStock().length>=stockLimit()?"Склад брёвен заполнен":"Добывает брёвна");
      w.job = kind;
      const goal = route(w, kind);
      const arrived = distance(w, goal) < 10;
      if (!arrived) {
        w.phase = w.path.length
          ? kind === "oak" || kind.startsWith("rock:") || kind.startsWith("repair:")
            ? "outbound"
            : "delivery"
          : "blocked";
        if(w.phase==="blocked")w.reason="Нет прохода";
        move(w, dt);
        continue;
      }
      w.path = [];
      if(kind.startsWith("rock:")||kind.startsWith("repair:")){jobs.work(w,kind,dt);continue;}
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
          logStock().length >= stockLimit() ? "waiting" : "delivery";
        if (w.unloadTimer <= 0 && logStock().length < stockLimit()) {
          logStock().push(w.cargo.pop());
          data.delivered++;
          w.unloadTimer = 0.35;
          changed("worker-delivered", { worker: w });
        }
      } else if(kind==="depot"&&w.stoneCargo){
        w.phase="delivery";if(!jobs.unload(w)&&state.campIndustry.materials.stone>=materialLimit(state)){w.phase="waiting";w.reason="Общий запас камня заполнен";}
      } else {
        w.phase = retiring ? "resting" : "waiting";
        w.direction = "down";
        if(kind==="rest"&&w.pendingRole&&!w.cargo.length&&!w.stoneCargo){
          w.role=w.pendingRole;w.pendingRole=null;w.workTarget=null;w.workTimer=0;w.cutTimer=0;w.workScan=0;w.skipped=[];w.routeKey="";
        }
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
    setLogTarget,setRepairReserve,assign,transferStock,hireReason,slots,stoneCapacity:jobs.stoneCapacity,
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
      return crew.length<slots()?WORKERS.hirePrices[crew.length]??null:null;
    },
    get upgradePrice() {
      return WORKERS.upgradePrices[data.level] ?? null;
    },
  };
}
