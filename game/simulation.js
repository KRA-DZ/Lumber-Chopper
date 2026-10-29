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
  survival: hazards = regional,
} = {}) {
  const gameState = createInitialState(),
    regions = regional ? createRegions(gameState) : null,
    world = regional ? createRegionWorld(regions) : createWorldModel(),
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
  let elapsed = 0,
    notice = "",
    noticeTimer = 0,
    revision = 0,
    paused = false,
    transferTimer = 0;
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  function updateUI() {
    revision++;
  }
  function showNotice(text, duration = 4) {
    notice = text;
    noticeTimer = duration;
    revision++;
    emit("notice", { text });
  }
  const forestRadius = () => RADII[gameState.campLevel];
  const accessible = (p) =>
    regions ? regions.isOpen(p) : distance(p, CENTER) < forestRadius() - 20;
  const treeAccessible = (t) =>
    regions ? regions.isOpen(t) : distance(t, CENTER) < forestRadius() - 45;
  const tutorial = { cut: false, sold: false };
  const dayPhase = () => gameState.worldTime / DAY_SECONDS;
  const nightAmount = () =>
    Math.max(
      0,
      Math.min(1, (0.25 - Math.sin(dayPhase() * Math.PI * 2)) / 1.25),
    );
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
    onPickup: (pile, index) => {
      revision++;
      emit("pickup", { pile: { ...pile }, index });
    },
  });
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
    player.path = [];
    player.targetX = player.x;
    player.targetY = player.y;
  }
  const treeIds = new Map(trees.map((t) => [t.id, t]));
  function canAct() {
    return !paused && !gameState.gameOver;
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
      !tree ||
      tree.workerOnly ||
      !treeAccessible(tree) ||
      tree.hp <= 0 ||
      distance(player, tree) >= 72 ||
      player[timer] > 0 ||
      (mode === "auto" && gameState.wood >= gameState.maxWood)
    )
      return false;
    player[timer] =
      mode === "auto" ? gameState.autoInterval : gameState.clickInterval;
    const damage = Math.min(tree.hp, gameState.axePower);
    tree.hp -= damage;
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
  function purchaseUpgrade(id) {
    if (gameState.gameOver || !buyUpgrade(gameState, id)) return false;
    player.speed = gameState.runSpeed;
    revision++;
    emit("upgrade-purchased", { id });
    return true;
  }
  function defeat(reason) {
    if (gameState.gameOver) return;
    gameState.gameOver = true;
    gameState.defeatReason = reason;
    clearKeys();
    paused = true;
    emit("game-over", { reason, nightsSurvived: gameState.nightsSurvived });
  }
  const lore = createLore(gameState, (type, event) => {
    revision++;
    emit(type, event);
  });
  const survival = hazards
    ? createSurvival({
        state: gameState,
        player,
        nav,
        accessible,
        emit,
        defeat,
      })
    : null;
  const cycle = createCycleManager(gameState, (type, event) => {
    if (type === "night-started") {
      survival?.nightStarted(event);
      showNotice(
        event.night % 5 === 0 && survival
          ? `Ночь ${event.night}: налёт! Вернитесь к лагерю. Смотритель неуязвим.`
          : "Ночь. Смотритель ищет тех, кто покинул свет лагеря.",
        9,
      );
    } else {
      survival?.dawn();
      lore.onDawn();
      showNotice(`Рассвет. Пережито ночей: ${gameState.nightsSurvived}`, 6);
    }
    revision++;
    emit(type, event);
  });
  function tryAttack(id, mode = "active") {
    const enemy =
      survival?.raiders.find((e) => e.id === id) ||
      (survival?.monster?.id === id ? survival.monster : null);
    const timer = mode === "auto" ? "autoTimer" : "clickTimer";
    if (
      !canAct() ||
      !["auto", "active"].includes(mode) ||
      !enemy ||
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
    player.swing = 0.32;
    faceTarget(enemy);
    emit("attack", { enemy, damage: gameState.axePower });
    return survival.hit(id, gameState.axePower);
  }
  const buyerSystem = createBuyers({
    state: gameState,
    player,
    nav,
    getElapsed: () => elapsed,
  });
  const { buyers, activeBuyer } = buyerSystem;
  function transferOneLog(target = null) {
    if (!canAct() || transferTimer > 0 || !gameState.cargo.length) return false;
    const slotPosition = stackOffset(gameState.wood - 1, gameState.wood);
    const start = {
      x: player.x + slotPosition.x,
      y: player.y + slotPosition.y,
    };
    const gate = regions?.frontiers().find((g) => distance(player, g) < 50);
    if (gate && (!target || target === gate.region.id)) {
      const result = regions.deposit(gate.region.id);
      if (result) {
        forestry.takeCargo();
        transferTimer = 0.18;
        visualEffects.transfer("region", start, { x: gate.x, y: gate.y - 25 });
        if (result.opened) {
          world.generate(result.region);
          for (const t of trees) treeIds.set(t.id, t);
          rebuildObstacles();
          emit("region-open", { region: result.region });
          showNotice(`Открыта новая территория: ${result.region.name}`, 8);
          player.celebration = 2;
        }
        updateUI();
        return true;
      }
    }
    const repairing = hazards && gameState.campHealth < gameState.maxCampHealth;
    const building =
      distance(player, build) < build.radius &&
      (gameState.campLevel < stages.length || repairing) &&
      (!target || target === "build");
    const customer = activeBuyer();
    const selling =
      distance(player, sale) < sale.radius &&
      customer &&
      (!target || target === "sell");
    if (!building && !selling) return false;
    const value = forestry.takeCargo();
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
      const target = construction.target(gameState);
      visualEffects.transfer("build", start, target);
      gameState.buildWood++;
      floatingText(build.x, build.y - 35, "+1 в лагерь", "#b8e8e4");
      const stage = stages[gameState.campLevel];
      if (gameState.buildWood >= stage.cost) {
        gameState.buildWood = 0;
        const oldRadius = forestRadius();
        gameState.campLevel++;
        if (!regions) expansion.open(oldRadius, forestRadius());
        showNotice(
          regions
            ? `${stage.name}: готово! Новые регионы открываются у пограничных указателей.`
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
      gameState.coins += value;
      tutorial.sold = true;
      floatingText(sale.x, sale.y - 35, `+${value} монет`, "#ffe296");
    }
    if (
      nav.collisionKey !==
      constructionCollisionKey(gameState, construction.plan)
    )
      rebuildObstacles();
    updateUI();
    return true;
  }
  function updatePlatforms(dt) {
    if (dt <= 0) return;
    transferTimer = Math.max(0, transferTimer - dt);
    transferOneLog();
  }
  function updateStep(dt) {
    if (paused) return;
    elapsed += dt;
    player.celebration = Math.max(0, (player.celebration || 0) - dt);
    cycle.update(dt);
    if (forestry.updateGrowth(trees, cycle.dayNumber)) {
      rebuildObstacles();
      for (const body of [player, ...buyers])
        if (!isWalkable(body.x, body.y)) {
          const safe = nearestGround(body.x, body.y);
          body.x = safe.x;
          body.y = safe.y;
        }
    }
    player.autoTimer = Math.max(0, player.autoTimer - dt);
    player.clickTimer = Math.max(0, player.clickTimer - dt);
    player.swing = Math.max(0, player.swing - dt);
    const kx =
      Number(keys.has("KeyD") || keys.has("ArrowRight")) -
      Number(keys.has("KeyA") || keys.has("ArrowLeft"));
    const ky =
      Number(keys.has("KeyS") || keys.has("ArrowDown")) -
      Number(keys.has("KeyW") || keys.has("ArrowUp"));
    const keyboard = keys.size > 0,
      oldX = player.x,
      oldY = player.y;
    if (keyboard) {
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

    buyerSystem.update(dt);
    updatePlatforms(dt);

    for (const tree of trees) tree.shake = Math.max(0, tree.shake - dt);
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
    const enemy = survival?.raiders
      .filter((e) => distance(player, e) < 72)
      .sort((a, b) => distance(player, a) - distance(player, b))[0];
    if (dt > 0 && enemy && player.autoTimer <= 0) tryAttack(enemy.id, "auto");
    if (
      dt > 0 &&
      !enemy &&
      nearest &&
      player.autoTimer <= 0 &&
      gameState.wood < gameState.maxWood
    ) {
      tryChop(nearest.id, "auto");
    }
    if (forestry.collect(dt, player)) updateUI();
    survival?.update(dt);
  }

  // Substeps preserve timers and collision at low FPS and in deterministic tests.
  function update(dt) {
    if (dt === 0 && !paused) player.moving = false;
    if (!Number.isFinite(dt) || dt <= 0 || paused || gameState.gameOver) return;
    while (dt > 1e-9 && !paused && !gameState.gameOver) {
      const step = Math.min(dt, 0.05);
      updateStep(step);
      dt -= step;
    }
  }
  return {
    tryChop,
    tryAttack,
    purchaseUpgrade,
    transferOneLog,
    cycle,
    lore,
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
    hitTree,
    activeBuyer,
    forestRadius,
    treeAccessible,
    accessible,
    regions,
    tutorial,
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
    setDestination,
    clearKeys,
    get elapsed() {
      return elapsed;
    },
    get dayNumber() {
      return cycle.dayNumber;
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
}
