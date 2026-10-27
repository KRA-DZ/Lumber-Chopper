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
export function createSimulation({ emit = () => {}, regional = false } = {}) {
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
    dayNumber = 0,
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
    findPath,
    clearSegment,
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
  function hitTree(tree) {
    if (paused || tree.workerOnly || !treeAccessible(tree) || tree.hp <= 0)
      return false;
    const damage = Math.min(tree.hp, gameState.axePower);
    tree.hp -= damage;
    tree.shake = 0.25;
    player.swing = 0.32;
    player.facing = tree.x < player.x ? -1 : 1;
    player.direction =
      Math.abs(tree.x - player.x) > Math.abs(tree.y - player.y)
        ? tree.x < player.x
          ? "left"
          : "right"
        : tree.y < player.y
          ? "up"
          : "down";
    emit("hit", { tree, damage });
    if (tree.hp === 0) {
      const count = forestry.fell(tree, dayNumber);
      tutorial.cut = true;
      rebuildObstacles();
      emit("fell", { tree, count });
      floatingText(tree.x, tree.y - 50, `+${count} бревна`);
      revision++;
    }
    return true;
  }
  // Очередь живёт весь торговый день; покупатель не уходит каждые несколько секунд.
  const BUYER_INTERVAL = 55,
    MAX_BUYERS = 5;
  let buyerSequence = 0,
    buyerSpawnTimer = 0;
  const buyers = [];
  const shopOpen = () => dayPhase() >= 0.06 && dayPhase() < 0.5; // 07:26–18:00 по часам мира.
  const buyerExit = { x: 1320, y: 2140 };
  function activeBuyer() {
    return shopOpen()
      ? buyers.find(
          (b) => b.phase === "waiting" && b.slot === 0 && b.load < b.capacity,
        )
      : null;
  }
  function spawnBuyer() {
    const b = {
      id: buyerSequence++,
      kind: buyerSequence % 2 === 1 ? "walker" : "cart",
      capacity: buyerSequence % 2 === 1 ? 5 : 15,
      x: buyerExit.x,
      y: buyerExit.y,
      phase: "arriving",
      load: 0,
      wait: 0,
      slot: -1,
      trip: buyerSequence,
      path: [],
      routeKey: "",
    };
    buyers.push(b);
    return b;
  }
  function updateBuyers(dt) {
    const open = shopOpen();
    buyerSpawnTimer -= dt;
    if (
      open &&
      buyerSpawnTimer <= 0 &&
      buyers.filter((b) => b.phase !== "leaving").length < MAX_BUYERS
    ) {
      spawnBuyer();
      buyerSpawnTimer = BUYER_INTERVAL;
    }
    for (const b of buyers)
      if (
        !open ||
        (b.slot === 0 && b.load >= b.capacity && (b.thanks || 0) <= 0)
      )
        b.phase = "leaving";
    const queue = buyers
      .filter((b) => b.phase !== "leaving")
      .sort((a, b) => a.id - b.id);
    queue.forEach((b, i) => (b.slot = i));
    for (let i = buyers.length - 1; i >= 0; i--) {
      const b = buyers[i],
        target =
          b.phase === "leaving"
            ? buyerExit
            : { x: 1420, y: 1775 + b.slot * 64 },
        key = `${b.phase === "leaving" ? "exit" : b.slot}:${nav.version}`;
      if (b.routeKey !== key) {
        const changedTarget = b.routeKey.split(":")[0] !== key.split(":")[0];
        if (
          changedTarget ||
          (!b.path.length && distance(b, target) > 5) ||
          b.path.some((p, i) => !clearSegment(i ? b.path[i - 1] : b, p))
        )
          b.path = findPath(b, target);
        b.routeKey = key;
      }
      const ox = b.x,
        oy = b.y,
        moved = followPath(b, dt, 64);
      b.moving = moved > 0.1;
      if (b.moving) {
        const dx = b.x - ox,
          dy = b.y - oy;
        b.direction =
          Math.abs(dx) > Math.abs(dy)
            ? dx < 0
              ? "left"
              : "right"
            : dy < 0
              ? "up"
              : "down";
      } else b.direction = "down";
      b.greetCooldown = Math.max(0, (b.greetCooldown || 0) - dt);
      b.actionTimer = Math.max(0, (b.actionTimer || 0) - dt);
      b.thanks = Math.max(0, (b.thanks || 0) - dt);
      if (!b.moving && distance(b, player) < 130 && b.greetCooldown <= 0) {
        b.action = "greet";
        b.actionTimer = 2.5;
        b.greetCooldown = 16;
      } else if (!b.moving && b.actionTimer <= 0)
        b.action = ["idle", "look", "shift", "yawn"][
          Math.floor((elapsed + b.id * 4) / 5) % 4
        ];
      if (distance(b, target) < 5) {
        if (b.phase === "leaving") {
          buyers.splice(i, 1);
          continue;
        }
        b.phase = b.slot === 0 ? "waiting" : "queued";
        b.wait += dt;
      }
    }
  }
  function updatePlatforms(dt) {
    if (dt <= 0) return;
    transferTimer = Math.max(0, transferTimer - dt);
    if (transferTimer > 0 || gameState.wood === 0) return;
    const gate = regions?.frontiers().find((g) => distance(player, g) < 50);
    if (gate) {
      const result = regions.deposit(gate.region.id);
      if (result) {
        forestry.takeCargo();
        transferTimer = 0.18;
        visualEffects.transfer(
          "region",
          { x: player.x, y: player.y - 4 },
          { x: gate.x, y: gate.y - 25 },
        );
        if (result.opened) {
          world.generate(result.region);
          rebuildObstacles();
          emit("region-open", { region: result.region });
          showNotice(`Открыта новая территория: ${result.region.name}`, 8);
          player.celebration = 2;
        }
        updateUI();
        return;
      }
    }
    const building =
      distance(player, build) < build.radius &&
      gameState.campLevel < stages.length;
    const customer = activeBuyer();
    const selling = distance(player, sale) < sale.radius && customer;
    if (!building && !selling) return;
    const start = {
      x: player.x,
      y: player.y - 4 - Math.min(39, gameState.wood - 1) * 9,
    };
    const value = forestry.takeCargo();
    if (value === null) return;
    transferTimer = 0.18;
    if (building) {
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
  }
  function update(dt) {
    if (paused) return;
    elapsed += dt;
    player.celebration = Math.max(0, (player.celebration || 0) - dt);
    const nextTime = gameState.worldTime + dt;
    dayNumber += Math.floor(nextTime / DAY_SECONDS);
    gameState.worldTime = nextTime % DAY_SECONDS;
    if (forestry.updateGrowth(trees, dayNumber)) {
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

    updateBuyers(dt);
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
    if (
      dt > 0 &&
      nearest &&
      player.autoTimer <= 0 &&
      gameState.wood < gameState.maxWood
    ) {
      hitTree(nearest);
      player.autoTimer = gameState.autoInterval;
    }
    if (forestry.collect(dt, player)) updateUI();
  }

  return {
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
      return dayNumber;
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
      paused = Boolean(v);
      if (paused) clearKeys();
    },
  };
}
