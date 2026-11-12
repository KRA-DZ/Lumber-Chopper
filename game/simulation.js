import {createForestTasks} from "./forest-tasks.js";
import {createBerries} from "./berries.js";
import { createCampCustom } from "./camp-custom.js";
import { createWorkers, WORKERS } from "./workers.js";
import { createStory } from "./story.js";
import { createExploration } from "./exploration.js";
import { createOutposts } from "./outposts.js";
import { shareWorldState } from "./coop-state.js";
import { createCampServices } from "./camp-services.js";
import { createMining } from "./mining.js";
import { createCampBuilder } from "./camp-projects.js";
import { createCampIndustry } from "./camp-industry.js";
import { createCampPreparation } from "./camp-preparation.js";
import { createBuyerOrders } from "./buyer-orders.js";
import { createClearing } from "./clearing.js";
import { firstDaysGuide, guideDestination } from "./first-days.js";
import { raidPlan } from "./raid-plans.js";
import { createWorldWorks } from "./world-works.js";
import { createSawmillProduction } from "./sawmill-production.js";
import { createDefenses } from "./defenses.js";
import { createDefenseRepair, DEFENSE_REPAIR } from "./defense-repair.js";
import { createRaidReports } from "./raid-report.js";
import { createCombatLoot } from "./combat-loot.js";
import { createBuyers } from "./buyers.js";
import { buyUpgrade } from "../economy.js";
import { createCycleManager } from "./cycle.js";
import { createLore } from "./lore.js";
import { createSurvival, SURVIVAL } from "./survival.js";
import { stackOffset } from "./stack-layout.js";
import { createRegions } from "./regions.js";
import { createRegionWorld } from "./region-world.js";
import {
  createInitialState,
  CENTER,
  RADII,
  STAGES,
  DAY_SECONDS,
} from "./config.js";
import { createWorldModel } from "./world-model.js";
import { createNavigation } from "./navigation.js";
import { createForestry } from "../forestry.js";
import {
  fencePlan,
  constructionTarget,
  constructionCollisionKey,
} from "../construction.js";
// Симуляция не зависит от Canvas, Phaser, DOM, кадров анимации или хранилища.
export function createSimulation({
  emit = () => {},
  regional = false,
  appearance = "traveler",
  survival: hazards = regional,
  shared = null,
  party = null,
} = {}) {
  const initialState = createInitialState({ appearance }),
    gameState = shared ? shareWorldState(initialState, shared.state) : initialState,
    regions = shared?.regions || (regional ? createRegions(gameState) : null),
    world = shared?.world || (regional ? createRegionWorld(regions,gameState) : createWorldModel()),
    { trees } = world;
  const stages = STAGES,
    keys = new Set(),
    sale = { x: 1420, y: 1690, radius: 53 },
    build = { x: 1780, y: 1690, radius: 53 };
  const player = {
    x: 1600,
    y: 1720,
    targetX: 1600,
    targetY: 1720,
    radius: 10,
    speed: gameState.runSpeed,
    autoTimer: 0,
    clickTimer: 0,
    swing: 0,
    moving: false,
    path: [],
    pathVersion: 0,
  };
  if (party && !shared) party.bind(gameState, player);
  let elapsed = 0,
    notice = "",
    noticeTimer = 0,
    revision = 0,
    paused = false,
    transferTimer = 0,
    sunsetWarning = null,
    defenseOrder = null,
    clearingOrder = null,
    selectedEnemyId = null,
    pursueEnemy = false,
    pursuitTimer = 0,
    defenseRouteTimer = 0,
    story = null,
    workers = null;
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  function updateUI() {
    story?.sync();
    revision++;
  }
  function showNotice(text, duration = 4) {
    notice = text;
    noticeTimer = duration;
    revision++;
    emit("notice", { text });
  }
  const forestRadius = () => RADII[Math.min(RADII.length-1,gameState.campLevel)];
  const accessible = (p) =>
    regions ? regions.isOpen(p) : distance(p, CENTER) < forestRadius() - 20;
  const treeAccessible = (t) =>
    regions ? regions.isOpen(t) : distance(t, CENTER) < forestRadius() - 45;
  const tutorial = {
    cut: false,
    sold: false,
    safeSeconds: 0,
    sheltered: false,
  };
  const dayPhase = () => gameState.worldTime / DAY_SECONDS;
  const nightAmount = () =>
    Math.max(
      0,
      Math.min(1, (0.25 - Math.sin(dayPhase() * Math.PI * 2)) / 1.25),
    );
  const raidReports = createRaidReports(gameState, () => defenses);
  const defenses = shared?.defenses || (hazards
    ? createDefenses(gameState, (event) => {
        const { section, topology } = event;
        raidReports.record("defense-changed", event);
        if (topology) {
          nav.rebuildObstacles();
          for (const body of [
            player,
            ...buyers,
            ...(workers?.crew || []),
            ...(survival?.raiders || []),
            ...(survival?.residents || []),
            ...(survival?.monster ? [survival.monster] : []),
          ]) {
            if ("repath" in body) {
              body.repath = 0;
              body.path = [];
            }
            if (!nav.isWalkable(body.x, body.y))
              Object.assign(body, nav.nearestGround(body.x, body.y));
          }
        }
        revision++;
        emit("defense-changed", event);
      })
    : null);
  if (defenses) world.defenses = defenses;
  const nav = createNavigation(world, gameState, player, showNotice);
  const {
    isWalkable,
    nearestGround,
    rebuildObstacles,
    moveBody,
    setDestination,
    followPath,
  } = nav;
  const construction = { plan: fencePlan(CENTER) };
  construction.target = (state) =>
    constructionTarget(state, CENTER, construction.plan);
  const forestry = createForestry(gameState, {
    sharedPiles: shared?.forestry.piles,
    onPickup: (pile, index) => {
      revision++;
      emit("pickup", { pile: { ...pile }, index });
    },
  });
  const outposts = createOutposts({
    state: gameState, world, regions, nav, forestry,
    shared: shared?.outposts,
    emit: (type, event) => {
      revision++;
      if ((party?.positions() || [player]).some(p => distance(p, event.site) < 500)) {
        if (type === "outpost-low-fuel") showNotice("Костёр привала догорает — осталось 20 секунд. Подбросьте бревно.", 6);
        if (type === "outpost-extinguished") showNotice("Костёр привала погас. Защита света исчезла.", 6);
      }
      emit(type, event);
    },
  });
  const clearing = regional
    ? createClearing({
        state: gameState,
        player,
        world,
        regions,
        nav,
        forestry,
        canAct,
      })
    : null;
  const sawmill=regional?createSawmillProduction({state:gameState,player,regions,nav,forestry,getWorkers:()=>workers,hear:(p,r)=>survival?.hear(p,r),emit}):null;
  const forestTasks=regional?createForestTasks({state:gameState,player,regions,nav,onIncome:v=>party?party.sale(v):gameState.coins+=v,emit}):null;
  const worldWorks=regional?createWorldWorks({state:gameState,player,regions,nav,forestry,emit:(type,e)=>{if(type==="world-work-completed"&&e.project.id==="lookout-tower")forestTasks.reveal();emit(type,e);},
    bodies:()=>[...(party?.actors.map(a=>a.player)||[player]),...(workers?.crew||[]),...buyers,
      ...(gameState.sawmill.cart.built?[gameState.sawmill.cart]:[]),
      ...(survival?.raiders||[]),...(survival?.residents||[]),...(survival?.monster?[survival.monster]:[])]}):null;
  const exploration = regional
    ? createExploration({
        state: gameState,
        player,
        world,
        regions,
        nav,
        forestry,
        canAct,
        getStory: () => story,
        worldWorks,
        sawmill,
        forestTasks,
        outposts,
        camp: { lit: () => camp.lit(), stoke: (quoted,material) => camp.stoke(quoted,material), maxFuel:()=>camp.maxFuel() },
        onSale: party ? value => party.sale(value) : null,
        navigate: navigateTo,
        emit: (type, event) => {
          story?.sync();
          revision++;
          emit(type, event);
        },
      })
    : null;
  const visualEffects = {
    transfer: (kind, start, target) =>
      emit("transfer", { kind, start, target }),
    complete: (target) => emit("complete", { target }),
  };
  const expansion = { open: (from, to) => emit("expansion", { from, to }) };
  function floatingText(x, y, text, color = "#fff4ce") {
    emit("text", { x, y, text, color });
  }
  function clearKeys() {
    keys.clear();
    if (player.room) player.room.target = null;
    defenseRepair?.cancel();
    clearingOrder = null;
    player.path = [];
    player.targetX = player.x;
    player.targetY = player.y;
  }
  const treeIds = new Map(trees.map((t) => [t.id, t]));
  function canAct() {
    return !paused && !gameState.gameOver && gameState.health > 0 && !player.room && !player.menuOpen;
  }
  const berries=regional?createBerries({state:gameState,player,world,regions,nav,canAct,navigate:setDestination,emit}):null;
  const custom=createCampCustom({state:gameState,player,nav,canAct});
  const camp = createCampServices({ state: gameState, player, forestry, canAct, nav, emit });
  const builder = createCampBuilder({ state: gameState, player, pad: build, forestry, canAct,
    players: () => party?.actors.map(a => a.player) || [player], emit });
  const mining = createMining({ state: gameState, player, world, nav, canAct, emit });
  const industry = createCampIndustry({state:gameState,player,forestry,defenses,emit});
  const preparation = createCampPreparation({state:gameState,player,defenses,nav,getSurvival:()=>survival,canUse:industry.canUse,emit});
  const orders = createBuyerOrders({state:gameState,player,site:sale,forestry,canAct,
    onIncome:value=>{gameState.campMilestones.sold=true;if(party)party.sale(value);else gameState.coins+=value;},emit});
  const defenseRepair = createDefenseRepair({
    canAct,
    get: (id) => defenses?.get(id),
    near: (section) => distance(player, section) < DEFENSE_REPAIR.range,
    hasCargo: () => gameState.cargo.length > 0,
    deposit: (id) => transferOneLog(id),
  });
  const combatLoot = createCombatLoot({
    shared: shared?.combatLoot,
    canTick: () => !paused && !gameState.gameOver,
    canDrop: () => !paused && !gameState.gameOver && (party || gameState.health > 0),
    state: gameState,
    player,
    canAct,
    accessible,
    canReach: (a, b) => nav.clearSegment(a, b),
    emit: (type, event) => {
      revision++;
      emit(type, event);
    },
  });
  function nearestDefenseRepair() {
    return (
      (defenses?.all() || [])
        .filter(
          (section) =>
            section.hp < section.maxHP &&
            section.kind !== "trap" &&
            (section.kind === "fence" ||
              Object.hasOwn(gameState.defenseHP, section.id)) &&
            distance(player, section) < DEFENSE_REPAIR.range,
        )
        .sort((a, b) => distance(player, a) - distance(player, b))[0] || null
    );
  }
  function setDefenseRepairHeld(held, id = null) {
    if (!held) {
      defenseRepair.release();
      return true;
    }
    const section = id ? defenses?.get(id) : nearestDefenseRepair();
    if (
      !section ||
      section.kind === "trap" ||
      (section.kind !== "fence" &&
        !Object.hasOwn(gameState.defenseHP, section.id)) ||
      !defenseRepair.start(section.id)
    )
      return false;
    exploration?.cancelAll();
    defenseOrder = selectedEnemyId = clearingOrder = null;
    pursueEnemy = false;
    player.path = [];
    return true;
  }
  function faceTarget(tree) {
    player.facing = tree.x < player.x ? -1 : 1;
    player.direction =
      Math.abs(tree.x - player.x) > Math.abs(tree.y - player.y)
        ? tree.x < player.x
          ? "left"
          : "right"
        : tree.y < player.y
          ? "up"
          : "down";
  }
  function tryChop(id, mode = "active") {
    const tree = treeIds.get(id),
      timer = mode === "auto" ? "autoTimer" : "clickTimer";
    if (
      !["auto", "active"].includes(mode) ||
      !canAct() ||
      exploration?.fishing ||
      !tree ||
      tree.workerOnly ||
      !treeAccessible(tree) ||
      tree.hp <= 0 ||
      distance(player, tree) >= 72 ||
      player[timer] > 0 ||
      (mode === "auto" && gameState.wood + gameState.boardCargo >= gameState.maxWood)
    )
      return false;
    player[timer] =
      mode === "auto" ? gameState.autoInterval : gameState.clickInterval;
    if (mode === "active") {
      clearingOrder = null;
      const approaching = exploration?.pending;
      exploration?.cancelAll();
      if (approaching) clearKeys();
    }
    const damage = Math.min(tree.hp, gameState.axePower);
    tree.hp -= damage;
    survival?.hear(player);
    tree.shake = 0.25;
    player.swing = 0.32;
    faceTarget(tree);
    emit("hit", { tree, damage });
    if (tree.hp === 0) {
      const count = forestry.fell(tree, cycle.dayNumber);
      tutorial.cut = true;
      rebuildObstacles();
      emit("fell", { tree, count });
      floatingText(tree.x, tree.y - 50, `+${count} бревна`);
      revision++;
    }
    return true;
  }
  // Compatibility name is guarded by exactly the same command as pointer input.
  const hitTree = (tree) => tryChop(tree?.id, "active");
  function orderClearing(id) {
    const d = clearing?.get(id);
    if (!canAct() || !clearing?.available(d)) return false;
    const goal = clearing.near(d) ? null : clearing.approach(d);
    if (!goal && !clearing.near(d)) return false;
    const changed = clearingOrder !== id;
    exploration?.cancelAll();
    clearKeys();
    defenseOrder = selectedEnemyId = null;
    pursueEnemy = false;
    clearingOrder = id;
    if (goal) setDestination(goal.x, goal.y);
    if (changed)
      showNotice(
        `${d.name}: рубим топором. Лишние брёвна останутся на земле.`,
        5,
      );
    return true;
  }
  function tryClear(id, mode = "active") {
    const timer = mode === "auto" ? "autoTimer" : "clickTimer";
    if (
      !["auto", "active"].includes(mode) ||
      !canAct() ||
      exploration?.fishing ||
      player[timer] > 0
    )
      return false;
    const result = clearing?.strike(id, gameState.axePower);
    if (!result) return false;
    if (mode === "active") {
      exploration?.cancelAll();
      clearKeys();
      defenseOrder = selectedEnemyId = null;
      pursueEnemy = false;
      clearingOrder = id;
    }
    player[timer] =
      mode === "auto" ? gameState.autoInterval : gameState.clickInterval;
    player.swing = 0.32;
    faceTarget(clearing.contact(result.debris));
    survival?.hear(player);
    emit("debris-hit", result);
    if (result.cleared) {
      clearingOrder = null;
      showNotice(
        `Проход расчищен: ${result.debris.name.toLowerCase()}. +${result.debris.logs} брёвен`,
        5,
      );
      emit("debris-cleared", result);
    }
    revision++;
    return true;
  }
  function purchaseUpgrade(id) {
    if (gameState.gameOver || gameState.health <= 0 || !buyUpgrade(gameState, id)) return false;
    player.speed = gameState.runSpeed;
    revision++;
    emit("upgrade-purchased", { id });
    return true;
  }
  function defeat(reason) {
    if (gameState.gameOver) return;
    gameState.sawmill.cart.owner=null;
    exploration?.cancelAll();
    gameState.gameOver = true;
    raidReports.finish(survival?.wave, false);
    gameState.defeatReason = reason;
    clearKeys();
    paused = true;
    emit("game-over", { reason, nightsSurvived: gameState.nightsSurvived });
  }
  const lore = createLore(gameState, (type, event) => {
    story?.sync();
    revision++;
    emit(type, event);
  });
  story = regional
    ? createStory({
        state: gameState,
        exploration,
        emit: (type, event) => {
          revision++;
          emit(type, event);
        },
      })
    : null;
  const survival = shared?.survival || (hazards
    ? createSurvival({
        state: party?.state || gameState,
        player: party?.player || player,
        party,
        nav,
        accessible,
        emit: (type, event) => {
          raidReports.record(type, event);
          forestTasks?.record(type,event);
          if (type === "enemy-defeated") { combatLoot.drop(event); gameState.runStats.kills++; if(event.kind==="boss")gameState.runStats.bosses++; }
          emit(type, event);
        },
        defeat,
        defenses,
        regions,
        sanctuary: p => outposts.safeZone(p),
        getNoise:()=>sawmill?.noise()||null,
        encampment:forestTasks?.encampment,
      })
    : null);
  const cycle = createCycleManager(gameState, (type, event) => {
    if (type === "sunset-warning") {
      sunsetWarning = { ...event, until: elapsed + 7 };
      showNotice(
        gameState.cycleSpeed===2.5?`До темноты ${Math.ceil(event.seconds/2.5)} секунд. Возвращайтесь к огню!` : event.seconds === 60
          ? event.raid
            ? `Через минуту налёт «${raidPlan(event.night).name}»! ${raidPlan(event.night).hint}`
            : "До заката одна минута. Закончите продажу и возвращайтесь к свету."
          : "До темноты 15 секунд. Вернитесь в светлый круг лагеря!",
        7,
      );
    } else if (type === "night-started") {
      sunsetWarning = null;
      raidReports.begin(event.night);
      survival?.nightStarted(event);
      showNotice(
        event.night % SURVIVAL.waveEvery === 0 && survival
          ? `Ночь ${event.night}: ${raidPlan(event.night).name}! Малые монстры идут за вами до лагеря. ${raidPlan(event.night).hint}`
          : "Ночь. Смотритель ищет тех, кто покинул свет лагеря.",
        9,
      );
    } else {
      survival?.dawn();
      const report = raidReports.finish(survival?.wave, true);
      lore.onDawn();
      story?.sync();
      const raidDay = event.day % SURVIVAL.waveEvery === 0;
      if (raidDay)
        sunsetWarning = { raid: true, morning: true, until: elapsed + 10 };
      showNotice(
        raidDay
          ? `Сегодня налёт с заката: ${raidPlan(event.day).name}. ${raidPlan(event.day).hint} Подготовка — Оборона (B).`
          : report
            ? `Пережита ночь ${report.night}. Награда: ${report.reward} монет. На восстановление: ${report.repairLogs} брёвен. Итоги — Оборона (B).`
            : `Рассвет. Пережито ночей: ${gameState.nightsSurvived}`,
        raidDay || report ? 10 : 6,
      );
    }
    revision++;
    emit(type, event);
  });
  function selectEnemy(id) {
    if (
      !canAct() ||
      ![...(survival?.raiders || []), ...(survival?.residents || [])].some(
        (e) => e.id === id,
      )
    )
      return false;
    exploration?.cancelAll();
    defenseRepair.cancel();
    clearingOrder = null;
    selectedEnemyId = id;
    defenseOrder = null;
    pursueEnemy = true;
    pursuitTimer = 0;
    return true;
  }
  function navigateTo(x, y) {
    defenseRepair.cancel();
    exploration?.cancelAll();
    clearingOrder = null;
    defenseOrder = null;
    selectedEnemyId = null;
    pursueEnemy = false;
    setDestination(x, y);
  }
  function routeDefense(section) {
    const d = Math.max(1, distance(player, section));
    const goal = nearestGround(
      section.x + ((player.x - section.x) / d) * 48,
      section.y + ((player.y - section.y) / d) * 48,
    );
    setDestination(goal.x, goal.y);
    defenseRouteTimer = 1.2;
  }
  function orderDefense(id) {
    const section = defenses?.get(id);
    if (!canAct() || !section || section.hp >= section.maxHP) return false;
    defenseRepair.cancel();
    exploration?.cancelAll();
    clearingOrder = null;
    selectedEnemyId = null;
    pursueEnemy = false;
    defenseOrder = id;
    routeDefense(section);
    showNotice(
      `${section.name}: принесите брёвна. Один взнос — одно бревно.`,
      5,
    );
    return true;
  }
  function tryAttack(id, mode = "active") {
    const enemy =
      [...(survival?.raiders || []), ...(survival?.residents || [])].find(
        (e) => e.id === id,
      ) || (survival?.monster?.id === id ? survival.monster : null);
    const timer = mode === "auto" ? "autoTimer" : "clickTimer";
    if (
      !canAct() ||
      !["auto", "active"].includes(mode) ||
      !enemy ||
      enemy.warning > 0 ||
      distance(player, enemy) >= 72 ||
      player[timer] > 0 ||
      !nav.clearSegment(player, enemy)
    )
      return false;
    player[timer] =
      mode === "auto" ? gameState.autoInterval : gameState.clickInterval;
    if (enemy.invulnerable) {
      showNotice("Смотритель неуязвим. Бегите к свету лагеря!", 4);
      return false;
    }
    if (mode === "active") clearingOrder = null;
    player.swing = 0.32;
    faceTarget(enemy);
    survival?.hear(player);
    emit("attack", { enemy, damage: gameState.axePower });
    party?.focus(core);
    return survival.hit(id, gameState.axePower);
  }
  const buyerSystem = shared?.buyerSystem || createBuyers({
    state: gameState,
    player,
    nav,
    getElapsed: () => elapsed,
  });
  const { buyers, activeBuyer } = buyerSystem;
  workers = regional
    ? createWorkers({
        state: gameState,
        player,
        world,
        regions,
        nav,
        forestry,
        activeBuyer,
        defenses,
        sale,
        mill:sawmill,
        onIncome: party ? value => party.sale(value) : null,
        playersAtSale: party ? () => party.actors.some(a => a.state.wood > 0 && distance(a.player, sale) < sale.radius) : null,
        getSurvival: () => survival,
        emit: (type, event) => {
          revision++;
          emit(type, event);
        },
      })
    : null;
  function transferOneLog(target = null) {
    if (!canAct() || transferTimer > 0) return false;
    builder.update();
    if (!canAct()) return false; // Opening the project picker pauses before any debit.
    const oldMaterialRadius=forestRadius(),materialTarget=construction.target(gameState),
      finished=(!target||target==="build")&&!defenseOrder&&!defenseRepair.target?builder.finishMaterials():null;
    if(finished){completeBuilding(finished,materialTarget,oldMaterialRadius);updateUI();builder.update();return true;}
    if(!target||target==="sell"){
      if(orders.current&&distance(player,sale)<sale.radius){
        const delivered=orders.deliver();if(delivered){transferTimer=.25;updateUI();}return delivered;
      }
    }
    const frontier = regions?.frontiers().find(g => distance(player, g) < 50 && (!target || target === g.region.id));
    if (frontier && !defenseOrder && !defenseRepair.target && (gameState.regionWood[frontier.region.id] || 0) >= frontier.region.cost && gameState.stone > 0) {
      const result = regions.deposit(frontier.region.id, "stone");
      if (!result) return false;
      gameState.stone--; transferTimer = .25;
      if (result.opened) openRegion(result.region);
      updateUI(); return true;
    }
    if (!gameState.cargo.length) return false;
    if (defenseRepair.target && target !== defenseRepair.target) return false;
    const slotPosition = stackOffset(gameState.wood - 1, gameState.wood);
    const start = {
      x: player.x + slotPosition.x,
      y: player.y + slotPosition.y,
    };
    const section = defenses?.get(target || defenseOrder);
    if (section && distance(player, section) < 78) {
      if (!defenses.deposit(section.id)) return false;
      forestry.takeCargo();
      transferTimer = 0.3;
      visualEffects.transfer("repair", start, {
        x: section.x,
        y: section.y - 16,
      });
      if (defenses.get(section.id).hp === section.maxHP) defenseOrder = null;
      updateUI();
      return true;
    }
    // An explicit repair order never spends cargo on a different nearby platform.
    if (defenseOrder || (target && defenses?.get(target))) return false;
    const gate = regions?.frontiers().find((g) => distance(player, g) < 50);
    if (gate && (!target || target === gate.region.id)) {
      const result = regions.deposit(gate.region.id);
      if (result) {
        forestry.takeCargo();
        transferTimer = 0.18;
        visualEffects.transfer("region", start, { x: gate.x, y: gate.y - 25 });
        if (result.opened) openRegion(result.region);
        updateUI();
        return true;
      }
    }
    const repairing = hazards && gameState.campHealth < gameState.maxCampHealth && (builder.canContribute() || !builder.choices.length);
    const building =
      distance(player, build) < build.radius &&
      (builder.canContribute() || repairing) &&
      (!target || target === "build");
    const customer = activeBuyer();
    const selling =
      distance(player, sale) < sale.radius &&
      customer &&
      (!target || target === "sell");
    if (!building && !selling) return false;
    const buildTarget = building && !repairing ? construction.target(gameState) : null,
      oldRadius = forestRadius(),
      contribution = building && !repairing ? builder.contribute() : null;
    const value = building && !repairing ? contribution?.value ?? null : forestry.takeCargo();
    if (value === null) return false;
    transferTimer = 0.18;
    if (building && repairing) {
      const restored = Math.min(
        SURVIVAL.repairPerLog,
        gameState.maxCampHealth - gameState.campHealth,
      );
      gameState.campHealth = Math.min(
        gameState.maxCampHealth,
        gameState.campHealth + SURVIVAL.repairPerLog,
      );
      visualEffects.transfer("repair", start, CENTER);
      emit("camp-repaired", { health: gameState.campHealth });
      floatingText(build.x, build.y - 35, `+${restored} прочности`, "#b8e8e4");
    } else if (building) {
      const target = buildTarget;
      visualEffects.transfer("build", start, target);
      floatingText(build.x, build.y - 35, "+1 в лагерь", "#b8e8e4");
      const stage = contribution.project;
      if (contribution.complete) completeBuilding(stage,target,oldRadius);
    } else {
      const displayLimit = customer.kind === "cart" ? 15 : 5;
      const slot = customer.load < displayLimit ? customer.load : -1;
      customer.load++;
      customer.thanks = 1.5;
      visualEffects.transfer("sell", start, {
        follow: customer,
        dx:
          customer.kind === "cart" ? (slot < 0 ? 44 : 30 + (slot % 2) * 24) : 0,
        dy:
          customer.kind === "cart"
            ? -28 - Math.floor(Math.min(14, customer.load - 1) / 2) * 9
            : -4 - Math.min(4, customer.load - 1) * 9,
        slot,
      });
      player.celebration = 1.4;
      if (party) party.sale(value);
      else gameState.coins += value;
      tutorial.sold = true;
      gameState.campMilestones.sold=true;
      floatingText(sale.x, sale.y - 35, `+${value} монет`, "#ffe296");
    }
    if (
      nav.collisionKey !==
      constructionCollisionKey(gameState, construction.plan)
    )
      rebuildObstacles();
    for (const body of workers?.crew || [])
      if (!isWalkable(body.x, body.y)) {
        Object.assign(body, nearestGround(body.x, body.y));
        body.path = [];
        body.repath = 0;
      }
    updateUI();
    if (contribution?.complete) builder.update();
    return true;
  }
  function completeBuilding(stage, target, oldRadius) {
    if (!regions) expansion.open(oldRadius, forestRadius());
    showNotice(
      regions
        ? `${stage.name}: готово!${stage.id === "fire" ? " Добавьте брёвна через E/Enter, чтобы разжечь огонь." : " Выберите следующий проект на платформе."}`
        : `Открыта новая территория! Радиус леса: ${forestRadius()}`,
      8,
    );
    player.celebration = 2.2;
    visualEffects.complete(target);
    rebuildObstacles();
    floatingText(
      CENTER.x,
      CENTER.y - 90,
      regions
        ? `${stage.name}: готово!`
        : `${stage.name}: готово! Лес расширен`,
    );
  }
  function updatePlatforms(dt) {
    if (dt <= 0) return;
    builder.update();
    if (!canAct()) return;
    transferTimer = Math.max(0, transferTimer - dt);
    if (defenseRepair.target) defenseRepair.update(dt);
    else transferOneLog();
  }
  function openRegion(region) {
    world.generate(region);
    for (const t of trees) treeIds.set(t.id, t);
    rebuildObstacles(); emit("region-open", { region });
    showNotice(`Открыта новая территория: ${region.name}`, 8); player.celebration = 2;
  }
  function updateStep(dt, actorOnly = false) {
    if (paused) return;
    if (shared) elapsed = shared.elapsed;
    else elapsed += dt;
    player.celebration = Math.max(0, (player.celebration || 0) - dt);
    if (!actorOnly) {
      cycle.update(dt);
      outposts.update(dt);
      camp.update(dt);
      mining.update();
      industry.update(dt);
      orders.update();
      for (const gate of defenses?.all().filter(d => d.kind === "gate" && d.hp > 0) || []) {
        const nearFriendly = [...(party?.positions() || [player]), ...buyers, ...(workers?.crew || [])]
          .some(p => !p.room && distance(p, gate) < (gate.open ? 140 : 85));
        if (gate.open !== nearFriendly) defenses.toggleGate(gate.id, nearFriendly);
      }
    }
    if (!actorOnly && forestry.updateGrowth(trees, cycle.dayNumber)) {
      rebuildObstacles();
      for (const body of [player, ...buyers, ...(workers?.crew || [])])
        if (!isWalkable(body.x, body.y)) {
          const safe = nearestGround(body.x, body.y);
          body.x = safe.x;
          body.y = safe.y;
        }
    }
    player.autoTimer = Math.max(0, player.autoTimer - dt);
    player.clickTimer = Math.max(0, player.clickTimer - dt);
    player.swing = Math.max(0, player.swing - dt);
    const alive = gameState.health > 0;
    player.speed=gameState.runSpeed*(sawmill?.speedMultiplier()||1);
    if (!alive) { keys.clear(); player.path = []; }
    if (player.room || player.menuOpen) {
      player.path=[];selectedEnemyId=null;pursueEnemy=false;defenseOrder=null;clearingOrder=null;defenseRepair.cancel();
    }
    if (player.room && !player.menuOpen) camp.moveRoom(dt, keys);
    const worldKeys = player.room || player.menuOpen ? new Set() : keys;
    const kx =
      Number(worldKeys.has("KeyD") || worldKeys.has("ArrowRight")) -
      Number(worldKeys.has("KeyA") || worldKeys.has("ArrowLeft"));
    const ky =
      Number(worldKeys.has("KeyS") || worldKeys.has("ArrowDown")) -
      Number(worldKeys.has("KeyW") || worldKeys.has("ArrowUp"));
    const keyboard = worldKeys.size > 0,
      oldX = player.x,
      oldY = player.y;
    if (keyboard) {
      berries?.cancel();
      defenseRepair.cancel();
      exploration?.cancelAll();
      clearingOrder = null;
      defenseOrder = null;
      pursueEnemy = false;
      player.path = [];
      const d = Math.hypot(kx, ky);
      if (d) {
        moveBody(
          player,
          (kx / d) * player.speed * dt,
          (ky / d) * player.speed * dt,
        );
        if (kx) player.facing = kx < 0 ? -1 : 1;
      }
      player.targetX = player.x;
      player.targetY = player.y;
    } else if (player.path.length) {
      if (player.pathVersion !== nav.version)
        setDestination(player.targetX, player.targetY);
      followPath(player, dt, player.speed);
      if (player.x !== oldX) player.facing = player.x < oldX ? -1 : 1;
    }
    player.moving = Math.hypot(player.x - oldX, player.y - oldY) > 0.01;
    if (player.moving) {
      const dx = player.x - oldX,
        dy = player.y - oldY;
      player.direction =
        Math.abs(dx) > Math.abs(dy)
          ? dx < 0
            ? "left"
            : "right"
          : dy < 0
            ? "up"
            : "down";
    }

    defenseRouteTimer = Math.max(0, defenseRouteTimer - dt);
    const work = defenses?.get(defenseOrder);
    if (
      work &&
      !keyboard &&
      !player.path.length &&
      distance(player, work) >= 78 &&
      defenseRouteTimer <= 0
    )
      routeDefense(work);
    const focused = [
      ...(survival?.raiders || []),
      ...(survival?.residents || []),
    ].find((e) => e.id === selectedEnemyId);
    if (selectedEnemyId && !focused) {
      selectedEnemyId = null;
      pursueEnemy = false;
    }
    pursuitTimer = Math.max(0, pursuitTimer - dt);
    if (focused && pursueEnemy && !keyboard && pursuitTimer <= 0) {
      if ((distance(player, focused) > 62 || !nav.clearSegment(player, focused)) && distance(player, focused) < 700) {
        setDestination(focused.x, focused.y);
        pursuitTimer = 0.6;
      } else player.path = [];
    }

    if (alive && !player.room && !player.menuOpen) exploration?.update(dt);
    if (paused) return; // Opening an inspection can pause synchronously at arrival.
    if (!actorOnly) buyerSystem.update(dt);
    if (canAct()) updatePlatforms(dt);
    if (paused) return;

    if (!actorOnly) for (const tree of trees) tree.shake = Math.max(0, tree.shake - dt);
    if (noticeTimer > 0) {
      noticeTimer -= dt;
      if (noticeTimer <= 0) {
        notice = "";
        updateUI();
      }
    }
    const nearest = (
      world.treesNear
        ? world.treesNear({
            x: player.x - 80,
            y: player.y - 80,
            width: 160,
            height: 160,
          })
        : trees
    )
      .filter((t) => treeAccessible(t) && t.hp > 0 && distance(player, t) < 72)
      .sort((a, b) => distance(player, a) - distance(player, b))[0];
    const reachable =
      [...(survival?.raiders || []), ...(survival?.residents || [])].filter(
        (e) => distance(player, e) < 72 && nav.clearSegment(player, e),
      ) || [];
    const enemy =
      reachable.find((e) => e.id === selectedEnemyId) ||
      reachable.sort((a, b) => distance(player, a) - distance(player, b))[0];
    if (dt > 0 && enemy && player.autoTimer <= 0) tryAttack(enemy.id, "auto");
    const clearingTarget = clearing?.get(clearingOrder);
    if (dt > 0 && !enemy && clearing?.near(clearingTarget))
      tryClear(clearingOrder, "auto");
    if (
      dt > 0 &&
      !enemy &&
      !clearingOrder &&
      nearest &&
      player.autoTimer <= 0 &&
      gameState.wood + gameState.boardCargo < gameState.maxWood
    ) {
      tryChop(nearest.id, "auto");
    }
    const rock = world.boulders?.find(r => (gameState.boulderHP[r.id] ?? r.maxHP) > 0 && distance(player, r) < 90);
    if (!enemy && !nearest && rock) mining.hit(rock.id, "auto");
    if (canAct() && forestry.collect(dt, player)) updateUI();
    sawmill?.freight.sync();
    camp.updateFuelPad(dt);
    berries?.update(dt);
    if (!actorOnly) survival?.update(dt);
    if (!actorOnly && !gameState.gameOver) preparation.update(dt);
    if (!actorOnly || alive) combatLoot.update(dt);
    if (!actorOnly && !gameState.gameOver) workers?.update(dt);
    if (!actorOnly && !gameState.gameOver) sawmill?.update(dt);
    if (
      !gameState.gameOver &&
      !tutorial.sheltered &&
      survival &&
      cycle.isNight
    ) {
      tutorial.safeSeconds = survival.isSafe(player)
        ? tutorial.safeSeconds + dt
        : 0;
      if (tutorial.safeSeconds >= 3) {
        tutorial.sheltered = true;
        revision++;
        emit("guide-progress", { id: "shelter" });
      }
    }
  }

  // Substeps preserve timers and collision at low FPS and in deterministic tests.
  function update(dt) {
    if (dt === 0 && !paused) player.moving = false;
    if (!Number.isFinite(dt) || dt <= 0 || paused || gameState.gameOver) return;
    while (dt > 1e-9 && !paused && !gameState.gameOver) {
      const step = Math.min(dt, 0.05);
      updateStep(step, Boolean(shared));
      dt -= step;
    }
  }
  const core = {
    sawmill,
    worldWorks,
    get guide() {
      return firstDaysGuide(core);
    },
    get sunsetWarning() {
      return sunsetWarning && elapsed < sunsetWarning.until
        ? sunsetWarning
        : null;
    },
    navigateGuide(action) {
      if (!canAct()) return false;
      const target = guideDestination(core, action);
      if (!target) {
        showNotice("Здесь пока нет доступной цели.");
        return false;
      }
      navigateTo(target.x, target.y);
      return true;
    },
    get selectedEnemyId() {
      return selectedEnemyId;
    },
    get defenseOrder() {
      return defenseOrder;
    },
    nearestDefenseRepair,
    setDefenseRepairHeld,
    get defenseRepair() {
      return defenseRepair.snapshot;
    },
    defenses,
    outposts,
    combatLoot,
    workers,
    navigateWorkers() {
      if (!workers || !canAct()) return false;
      navigateTo(WORKERS.depot.x, WORKERS.depot.y);
      return true;
    },
    selectEnemy,
    orderDefense,
    story,
    navigateStory(target = story?.overview().target) {
      if (!story || !canAct() || !target) return false;
      if (target.kind === "camp") return core.navigateGuide("camp");
      if (target.kind === "build") {
        navigateTo(build.x, build.y);
        return true;
      }
      const point =
        target.kind === "clue"
          ? world.clues.find((c) => c.id === target.id)
          : target.kind === "location"
            ? world.locations?.find((l) => l.id === target.id)?.entrance
            : exploration?.get(target.id);
      if (!point) return false;
      if (!accessible(point)) {
        const region = regions.all.find(
          (r) =>
            r.x <= point.x &&
            point.x < r.x + r.width &&
            r.y <= point.y &&
            point.y < r.y + r.height,
        );
        const gate = regions
          .frontiers()
          .find((g) => g.region.id === region?.id);
        if (!gate) {
          showNotice("Сначала откройте соседний регион на карте.");
          return false;
        }
        navigateTo(gate.x, gate.y);
        showNotice(
          `Откройте ${region.name}: ${region.cost} брёвен у указателя.`,
          6,
        );
        return true;
      }
      if (target.kind === "site") return exploration.request(point.id);
      navigateTo(point.x, point.y + (target.kind === "location" ? 0 : 32));
      return true;
    },
    readClue(id) {
      const clue = world.clues?.find((c) => c.id === id);
      if (
        !canAct() ||
        !clue ||
        !accessible(clue) ||
        distance(player, clue) >= 140 ||
        !nav.hasLineOfSight(player, clue)
      )
        return false;
      return lore.read(clue);
    },
    tryChop,
    tryClear,
    orderClearing,
    clearing,
    get clearingOrder() {
      return clearingOrder;
    },
    tryAttack,
    purchaseUpgrade,
    transferOneLog,
    cycle,
    lore,
    exploration,
    survival,
    showNotice,
    state: gameState,
    world,
    player,
    trees,
    keys,
    buyers,
    nav,
    forestry,
    sale,
    build,
    stages,
    update,
    buyerSystem,
    forestTasks, berries, custom, camp, mining, builder, industry, preparation, orders,
    defeat,
    refreshWorld() { for (const t of trees) treeIds.set(t.id, t); rebuildObstacles(); },
    stepActor(dt) { if (!paused && !gameState.gameOver && Number.isFinite(dt) && dt > 0) updateStep(dt, true); },
    hitTree,
    activeBuyer,
    forestRadius,
    treeAccessible,
    accessible,
    regions,
    tutorial,
    // Legacy three-step counter; the current seven-step HUD uses core.guide.
    get tutorialStep() {
      return !tutorial.cut
        ? 0
        : !tutorial.sold
          ? 1
          : gameState.carryLevel === 0
            ? 2
            : 3;
    },
    nightAmount,
    setDestination: navigateTo,
    clearKeys,
    get elapsed() {
      return elapsed;
    },
    get dayNumber() {
      return shared?.dayNumber ?? cycle.dayNumber;
    },
    get revision() {
      return revision;
    },
    get notice() {
      return notice;
    },
    get paused() {
      return paused;
    },
    set paused(v) {
      paused = Boolean(v) || gameState.gameOver;
      if (paused) clearKeys();
    },
  };
  return core;
}
