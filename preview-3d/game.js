import { createTrade } from "./trade.js";
import { DAY_SECONDS, clockText, shopOpen, nightAmount } from "./time.js";
import { character, log } from "./models.js";
import { RADII, STAGES, loadProgress, saveProgress } from "./progress.js";
import { createCampWorld, BUILD_PAD, ANCIENT } from "./camp-world.js";
export function createGame(world) {
  const { THREE, scene, trees, pond, campsite } = world,
    actor = character();
  scene.add(actor.root);
  actor.root.scale.setScalar(1.75);
  let storage;
  try {
    storage = window.localStorage;
  } catch {}
  const restored = loadProgress(storage),
    state = restored.state;
  const campWorld = createCampWorld(scene, campsite);
  const radius = () => RADII[state.campLevel];
  campWorld.apply(state.campLevel);
  for (const saved of restored.trees || []) {
    const t = trees.find((t) => t.id === saved.id);
    if (
      t &&
      Number.isInteger(saved.hp) &&
      saved.hp >= 0 &&
      saved.hp <= t.maxHp
    ) {
      t.hp = saved.hp;
      if (!t.hp) {
        t.canopy.visible = false;
        t.trunk.visible = false;
        t.stump.visible = true;
      }
    }
  }
  const player = {
    x: 0,
    z: 6,
    speed: 4.2,
    path: [],
    hit: 0,
    auto: 0,
    click: 0,
    moving: false,
  };
  const keys = new Set();
  const trade = createTrade(world, { pathTo, moveBody });
  let elapsed = 0,
    sellTimer = 0,
    saveTimer = 0,
    uiTimer = 0,
    noticeTimer = 0;
  let notice = restored.warning || "";
  const saveStatus = document.querySelector("#save-status");
  saveStatus.textContent =
    restored.source === "2d"
      ? "Прогресс перенесён из 2D. Теперь версии сохраняются отдельно."
      : restored.source === "3d"
        ? "3D-прогресс восстановлен · автосохранение включено"
        : "3D-прогресс сохраняется автоматически";
  actor.root.position.set(player.x, 0, player.z);
  const wood = document.querySelector("#wood"),
    coins = document.querySelector("#coins"),
    hint = document.querySelector("#hint");
  const onBridge = (x, z) =>
    Math.abs(x + 9.2) < 2.45 && Math.abs(z - 6.5) < 0.65;
  function walkable(x, z) {
    if (Math.hypot(x, z) > radius() - 0.35) return false;
    if (
      !onBridge(x, z) &&
      ((x - pond.x) / (pond.rx + 0.25)) ** 2 +
        ((z - pond.z) / (pond.rz + 0.25)) ** 2 <
        1
    )
      return false;
    if (campWorld.blocked(x, z, state.campLevel)) return false;
    if (Math.abs(x + 4.2) < 1.7 && Math.abs(z - 1.7) < 0.85) return false;

    return !trees.some(
      (t) => t.active && t.hp > 0 && Math.hypot(x - t.x, z - t.z) < 0.42,
    );
  }
  function line(a, b) {
    const d = Math.hypot(b.x - a.x, b.z - a.z),
      n = Math.max(1, Math.ceil(d / 0.2));
    for (let i = 1; i <= n; i++)
      if (!walkable(a.x + ((b.x - a.x) * i) / n, a.z + ((b.z - a.z) * i) / n))
        return false;
    return true;
  }
  function freePoint(x, z) {
    const d = Math.hypot(x, z),
      r = radius() - 0.5;
    if (d > r) {
      x = (x / d) * r;
      z = (z / d) * r;
    }
    if (walkable(x, z)) return { x, z };
    for (let r = 0.3; r < 5; r += 0.3)
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * Math.PI * 2,
          p = { x: x + Math.cos(a) * r, z: z + Math.sin(a) * r };
        if (walkable(p.x, p.z)) return p;
      }
    return { x: player.x, z: player.z };
  }
  function pathTo(goal, body = player) {
    const target = freePoint(goal.x, goal.z);
    if (line(body, target)) return [target];
    const cell = 0.8,
      N = 112,
      origin = -44.8;
    const pos = (id) => ({
      x: origin + ((id % N) + 0.5) * cell,
      z: origin + (Math.floor(id / N) + 0.5) * cell,
    });
    function nearest(p) {
      const cx = Math.floor((p.x - origin) / cell),
        cz = Math.floor((p.z - origin) / cell);
      for (let r = 0; r < 5; r++)
        for (let dz = -r; dz <= r; dz++)
          for (let dx = -r; dx <= r; dx++) {
            const x = cx + dx,
              z = cz + dz,
              id = z * N + x;
            if (x >= 0 && z >= 0 && x < N && z < N) {
              const pt = pos(id);
              if (walkable(pt.x, pt.z) && line(p, pt)) return id;
            }
          }
      return -1;
    }
    const start = nearest(body),
      end = nearest(target);
    if (start < 0 || end < 0) return [];
    const cost = new Float64Array(N * N);
    cost.fill(Infinity);
    const parent = new Int32Array(N * N);
    parent.fill(-1);
    const closed = new Set(),
      open = [start];
    cost[start] = 0;
    let found = false;
    while (open.length) {
      open.sort(
        (a, b) =>
          cost[b] +
          Math.hypot(
            (b % N) - (end % N),
            Math.floor(b / N) - Math.floor(end / N),
          ) -
          cost[a] -
          Math.hypot(
            (a % N) - (end % N),
            Math.floor(a / N) - Math.floor(end / N),
          ),
      );
      const id = open.pop();
      if (closed.has(id)) continue;
      if (id === end) {
        found = true;
        break;
      }
      closed.add(id);
      const p = pos(id),
        cx = id % N,
        cz = Math.floor(id / N);
      for (let dz = -1; dz <= 1; dz++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dz) continue;
          const x = cx + dx,
            z = cz + dz,
            next = z * N + x;
          if (x < 0 || z < 0 || x >= N || z >= N || closed.has(next)) continue;
          const q = pos(next);
          if (!walkable(q.x, q.z) || !line(p, q)) continue;
          const g = cost[id] + Math.hypot(dx, dz);
          if (g < cost[next]) {
            cost[next] = g;
            parent[next] = id;
            open.push(next);
          }
        }
    }
    if (!found) return [];
    const raw = [target];
    for (let id = end; id !== -1; id = parent[id]) {
      raw.push(pos(id));
      if (id === start) break;
    }
    raw.reverse();
    const result = [];
    let anchor = body,
      i = 0;
    while (i < raw.length) {
      let far = i;
      while (far + 1 < raw.length && line(anchor, raw[far + 1])) far++;
      result.push(raw[far]);
      anchor = raw[far];
      i = far + 1;
    }
    return result;
  }
  function goTo(x, z) {
    player.path = pathTo({ x, z });
    const last = player.path.at(-1);
    world.marker.visible = !!last;
    if (last) world.marker.position.set(last.x, 0.1, last.z);
  }
  function ui() {
    wood.textContent = `${state.wood} / ${state.capacity}`;
    coins.textContent = state.coins;
    document
      .querySelector("#light")
      .setAttribute("aria-pressed", String(nightAmount(state.worldTime) > 0.4));
    const current = trade.buyers.find(
      (b) => b.slot === 0 && b.phase === "waiting",
    );
    document.querySelector("#clock").textContent = clockText(state.worldTime);
    document.querySelector("#trade-status").textContent = !shopOpen(
      state.worldTime,
    )
      ? "Лавка закрыта до утра"
      : `Покупатели: ${trade.buyers.filter((b) => b.phase !== "leaving").length}/5${current ? " · Груз " + current.load + "/40" : " · ждём у прилавка"}`;
    const stage = STAGES[state.campLevel];
    document.querySelector("#camp-progress").textContent = stage
      ? `Лагерь ${state.campLevel}/4 · ${stage.name}: ${state.buildWood}/${stage.cost} брёвен`
      : "Лагерь 4/4 · Хижина построена";
    document.querySelector("#location").textContent =
      `Радиус леса: ${radius()} · До лагеря: ${Math.round(Math.hypot(player.x, player.z))}`;
    hint.textContent =
      notice ||
      (state.wood >= state.capacity
        ? "Рюкзак полон: золотая площадка — продажа, бирюзовая — строительство."
        : "Золотая площадка — продать брёвна · Бирюзовая — строить лагерь и расширять лес");
  }
  function hit(t) {
    if (
      !t.active ||
      t.workerOnly ||
      Math.hypot(t.x, t.z) > radius() - 1 ||
      t.hp <= 0 ||
      state.wood >= state.capacity
    )
      return false;
    t.hp--;
    t.shake = 0.23;
    player.hit = 0.32;
    if (!player.moving)
      actor.root.rotation.y = Math.atan2(t.x - player.x, t.z - player.z);
    if (t.hp === 0) {
      t.canopy.visible = false;
      t.trunk.visible = false;
      t.stump.visible = true;
      state.wood++;
      state.cargoValue += t.value || 10;
      syncCargo();
      ui();
      save();
    }
    return true;
  }
  function approach(t) {
    if (!t.active || Math.hypot(t.x, t.z) > radius() - 1) {
      notice = "Сначала улучшите лагерь, чтобы открыть это кольцо леса.";
      noticeTimer = 4;
      ui();
      return;
    }
    if (Math.hypot(t.x - player.x, t.z - player.z) < 2) {
      if (player.click <= 0) {
        hit(t);
        player.click = 0.2;
      }
      return;
    }
    const a = Math.atan2(player.z - t.z, player.x - t.x);
    goTo(t.x + Math.cos(a) * 1.4, t.z + Math.sin(a) * 1.4);
  }
  function moveBody(body, dx, dz) {
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.08));
    for (let i = 0; i < steps; i++) {
      const x = body.x + dx / steps,
        z = body.z + dz / steps;
      if (walkable(x, z)) {
        body.x = x;
        body.z = z;
      } else {
        if (walkable(x, body.z)) body.x = x;
        if (walkable(body.x, z)) body.z = z;
      }
    }
  }

  function move(dx, dz) {
    moveBody(player, dx, dz);
  }
  function step(dt) {
    elapsed += dt;
    state.worldTime = (state.worldTime + dt) % DAY_SECONDS;
    world.setDayTime(state.worldTime);
    trade.update(dt, state.worldTime, state.campLevel);
    player.auto = Math.max(0, player.auto - dt);
    player.click = Math.max(0, player.click - dt);
    player.hit = Math.max(0, player.hit - dt);
    sellTimer -= dt;
    const ox = player.x,
      oz = player.z;
    const h =
        Number(keys.has("KeyD") || keys.has("ArrowRight")) -
        Number(keys.has("KeyA") || keys.has("ArrowLeft")),
      v =
        Number(keys.has("KeyW") || keys.has("ArrowUp")) -
        Number(keys.has("KeyS") || keys.has("ArrowDown"));
    if (keys.size) {
      player.path = [];
      const right = new THREE.Vector3().setFromMatrixColumn(
        world.camera.matrixWorld,
        0,
      );
      right.y = 0;
      right.normalize();
      const forward = new THREE.Vector3(right.z, 0, -right.x);
      const dir = right.multiplyScalar(h).add(forward.multiplyScalar(v));
      if (dir.lengthSq()) {
        dir.normalize();
        move(dir.x * player.speed * dt, dir.z * player.speed * dt);
      }
    } else if (player.path.length) {
      const target = player.path[0],
        dx = target.x - player.x,
        dz = target.z - player.z,
        d = Math.hypot(dx, dz);
      if (d < 0.1) player.path.shift();
      else {
        const step = Math.min(player.speed * dt, d);
        move((dx / d) * step, (dz / d) * step);
      }
    }
    player.moving = Math.hypot(player.x - ox, player.z - oz) > 0.001;
    world.marker.visible = player.path.length > 0;
    if (player.moving)
      actor.root.rotation.y = Math.atan2(player.x - ox, player.z - oz);
    const near = trees
      .filter(
        (t) =>
          t.active &&
          t.hp > 0 &&
          Math.hypot(t.x - player.x, t.z - player.z) < 1.95,
      )
      .sort(
        (a, b) =>
          Math.hypot(a.x - player.x, a.z - player.z) -
          Math.hypot(b.x - player.x, b.z - player.z),
      )[0];
    if (dt > 0 && near && player.auto <= 0 && state.wood < state.capacity) {
      hit(near);
      player.auto = 0.7;
    }
    const building =
      Math.hypot(player.x - BUILD_PAD.x, player.z - BUILD_PAD.z) <
        BUILD_PAD.radius && state.campLevel < 4;
    const customer = trade.active(state.worldTime);
    const selling =
      customer && Math.hypot(player.x + 3.8, player.z - 4.4) < 1.35;
    if (dt > 0 && (building || selling) && state.wood > 0 && sellTimer <= 0) {
      const value =
        state.wood === 1
          ? state.cargoValue
          : Math.floor(state.cargoValue / state.wood);
      state.wood--;
      state.cargoValue -= value;
      sellTimer = 0.18;
      if (building) {
        state.buildWood++;
        const stage = STAGES[state.campLevel];
        if (state.buildWood >= stage.cost) {
          state.buildWood = 0;
          state.campLevel++;
          campWorld.apply(state.campLevel);
          notice = `${stage.name}: готово! Открыт новый круг леса.`;
          noticeTimer = 5;
          player.path = [];
        }
      } else {
        state.coins += value;
        trade.receive(customer);
      }
      syncCargo();
      ui();
      save();
    }
    saveTimer += dt;
    uiTimer += dt;
    if (saveTimer >= 5) {
      save();
      saveTimer = 0;
    }
    if (uiTimer >= 0.25) {
      ui();
      uiTimer = 0;
    }
    if (noticeTimer > 0) {
      noticeTimer -= dt;
      if (noticeTimer <= 0) {
        notice = "";
        ui();
      }
    }
    actor.root.position.set(
      player.x,
      onBridge(player.x, player.z) ? 0.27 : 0,
      player.z,
    );
    actor.body.position.y = player.moving
      ? Math.abs(Math.sin(elapsed * 10)) * 0.07
      : Math.sin(elapsed * 2) * 0.018;
    actor.legs.forEach(
      (leg, i) =>
        (leg.rotation.x = player.moving
          ? Math.sin(elapsed * 10 + i * Math.PI) * 0.5
          : 0),
    );
    actor.arm.rotation.x = player.moving ? Math.sin(elapsed * 10) * 0.3 : 0;
    actor.axe.rotation.x =
      player.hit > 0
        ? -1.2 + Math.sin((1 - player.hit / 0.32) * Math.PI) * 2.2
        : 0;
    actor.cargo.rotation.z = player.moving
      ? Math.sin(elapsed * 9) * Math.min(state.wood / 20, 1) * 0.12
      : 0;
    actor.cargo.children.forEach((l, i) => {
      l.position.x = player.moving
        ? Math.sin(elapsed * 9 - i * 0.13) * i * 0.014
        : 0;
    });
    const heroScreen = new THREE.Vector3(player.x, 2.4, player.z).project(
        world.camera,
      ),
      leafScreen = new THREE.Vector3();
    for (const t of trees) {
      t.root.visible =
        t.active &&
        Math.hypot(t.x, t.z) < radius() - 1 &&
        Math.hypot(t.x - player.x, t.z - player.z) < 35;
      const front = (t.x - player.x) * 25 + (t.z - player.z) * 29 > 0;
      let obscures = false;
      if (t.root.visible && front) {
        leafScreen.set(t.x, 3 * t.root.scale.y, t.z).project(world.camera);
        obscures =
          Math.abs(leafScreen.x - heroScreen.x) <
            (5 * t.root.scale.x) / (world.camera.right - world.camera.left) &&
          Math.abs(leafScreen.y - heroScreen.y) <
            (4.5 * t.root.scale.y) / (world.camera.top - world.camera.bottom);
      }
      for (const leaf of t.leaves) leaf.material.opacity = obscures ? 0.23 : 1;
      t.shake = Math.max(0, t.shake - dt);
      t.canopy.rotation.z = t.shake
        ? Math.sin(t.shake * 80) * 0.065
        : Math.sin(elapsed * 1.3 + t.id) * 0.012;
    }
    actor.animateFace(
      elapsed,
      player.hit > 0
        ? "focused"
        : state.wood >= state.capacity
          ? "surprised"
          : "happy",
    );
    if (!player.moving && player.hit <= 0) {
      const facing = Math.atan2(25, 29);
      actor.root.rotation.y +=
        Math.atan2(
          Math.sin(facing - actor.root.rotation.y),
          Math.cos(facing - actor.root.rotation.y),
        ) * Math.min(1, dt * 2);
    }
    campsite.flames.forEach((f, i) => {
      f.scale.y = 1 + Math.sin(elapsed * 9 + i) * 0.16;
      f.rotation.y = elapsed * (i + 1) * 0.5;
    });
    world.fireLight.intensity =
      state.campLevel >= 1 ? 12 + Math.sin(elapsed * 9) * 2 : 0;
    campWorld.merchant.rotation.y = Math.sin(elapsed * 0.6) * 0.15;
    campWorld.giant.canopy.rotation.z = Math.sin(elapsed * 0.7) * 0.012;
    world.ripples.forEach((r, i) => {
      const t = (elapsed * 0.2 + i * 0.17) % 1;
      r.scale.setScalar(0.5 + t * 1.8);
      r.material.opacity = (1 - t) * 0.4;
    });
  }
  function save() {
    try {
      saveProgress(storage, state, player, trees);
    } catch {
      notice =
        "Браузер запретил сохранение. Прогресс доступен только в этой вкладке.";
      saveStatus.textContent = notice;
    }
  }
  function syncCargo() {
    const count = Math.min(40, state.wood);
    while (actor.cargo.children.length > count) {
      const child = actor.cargo.children.at(-1);
      actor.cargo.remove(child);
      child.traverse((m) => m.geometry?.dispose());
    }
    while (actor.cargo.children.length < count)
      log(actor.cargo, 0, actor.cargo.children.length * 0.28, 0, 1.1);
  }
  function ancientNotice() {
    notice =
      "Великое дерево — бесконечный источник только для будущих работников.";
    noticeTimer = 5;
    goTo(ANCIENT.x, ANCIENT.z + 2.5);
    ui();
  }
  function toggleTime() {
    state.worldTime = shopOpen(state.worldTime) ? 900 : 240;
    step(0);
    save();
    ui();
  }
  function dispose() {
    keys.clear();
    save();
  }
  if (
    restored.position &&
    Number.isFinite(restored.position.x) &&
    Number.isFinite(restored.position.z) &&
    Math.abs(restored.position.x) < 46 &&
    Math.abs(restored.position.z) < 46
  ) {
    const p = freePoint(restored.position.x, restored.position.z);
    player.x = p.x;
    player.z = p.z;
  }
  syncCargo();
  step(0);
  save();
  ui();
  return {
    state,
    trade,
    toggleTime,
    campWorld,
    radius,
    save,
    ancientNotice,
    player,
    actor,
    keys,
    step,
    hit,
    goTo,
    approach,
    walkable,
    dispose,
  };
}
