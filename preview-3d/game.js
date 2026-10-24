import { character, log } from "./models.js";
export function createGame(world) {
  const { THREE, scene, trees, pond, campsite } = world,
    actor = character();
  scene.add(actor.root);
  actor.root.scale.setScalar(1.35);
  const state = { wood: 0, capacity: 20, coins: 0 }; // Отдельная пробная поляна: сохранения основной игры не меняются.
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
  let elapsed = 0,
    sellTimer = 0;
  actor.root.position.set(player.x, 0, player.z);
  const wood = document.querySelector("#wood"),
    coins = document.querySelector("#coins"),
    hint = document.querySelector("#hint");
  const onBridge = (x, z) =>
    Math.abs(x + 9.2) < 2.45 && Math.abs(z - 6.5) < 0.65;
  function walkable(x, z) {
    if (Math.hypot(x, z) > 22) return false;
    if (
      !onBridge(x, z) &&
      ((x - pond.x) / (pond.rx + 0.25)) ** 2 +
        ((z - pond.z) / (pond.rz + 0.25)) ** 2 <
        1
    )
      return false;
    if (Math.abs(x) < 1.9 && z > -5.35 && z < -1.55) return false;
    if (Math.abs(x + 4.2) < 1.7 && Math.abs(z - 1.7) < 0.85) return false;
    if (Math.hypot(x, z) < 0.9) return false;
    return !trees.some((t) => t.hp > 0 && Math.hypot(x - t.x, z - t.z) < 0.55);
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
    if (walkable(x, z)) return { x, z };
    for (let r = 0.3; r < 5; r += 0.3)
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * Math.PI * 2,
          p = { x: x + Math.cos(a) * r, z: z + Math.sin(a) * r };
        if (walkable(p.x, p.z)) return p;
      }
    return { x: player.x, z: player.z };
  }
  function pathTo(goal) {
    const target = freePoint(goal.x, goal.z);
    if (line(player, target)) return [target];
    const cell = 0.8,
      N = 56,
      origin = -22.4;
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
    const start = nearest(player),
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
    let anchor = player,
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
    hint.textContent =
      state.wood >= state.capacity
        ? "Вот это башня! Отнесите брёвна на светлую площадку у лавки."
        : "Нажмите на дерево — лесоруб подойдёт и начнёт рубить.";
  }
  function hit(t) {
    if (t.hp <= 0 || state.wood >= state.capacity) return false;
    t.hp--;
    t.shake = 0.23;
    player.hit = 0.32;
    actor.root.rotation.y = Math.atan2(t.x - player.x, t.z - player.z);
    if (t.hp === 0) {
      t.canopy.visible = false;
      t.trunk.visible = false;
      t.stump.visible = true;
      state.wood++;
      log(actor.cargo, 0, (state.wood - 1) * 0.28, 0, 1.1);
      ui();
    }
    return true;
  }
  function approach(t) {
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
  function move(dx, dz) {
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.08));
    for (let i = 0; i < steps; i++) {
      const x = player.x + dx / steps,
        z = player.z + dz / steps;
      if (walkable(x, z)) {
        player.x = x;
        player.z = z;
      } else {
        if (walkable(x, player.z)) player.x = x;
        if (walkable(player.x, z)) player.z = z;
      }
    }
  }
  function step(dt) {
    elapsed += dt;
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
        (t) => t.hp > 0 && Math.hypot(t.x - player.x, t.z - player.z) < 1.95,
      )
      .sort(
        (a, b) =>
          Math.hypot(a.x - player.x, a.z - player.z) -
          Math.hypot(b.x - player.x, b.z - player.z),
      )[0];
    if (near && player.auto <= 0 && state.wood < state.capacity) {
      hit(near);
      player.auto = 0.7;
    }
    if (
      Math.hypot(player.x + 3.8, player.z - 4.4) < 1.35 &&
      state.wood > 0 &&
      sellTimer <= 0
    ) {
      state.wood--;
      state.coins += 10;
      const cargoLog = actor.cargo.children.at(-1);
      actor.cargo.remove(cargoLog);
      cargoLog.traverse((m) => m.geometry?.dispose());
      sellTimer = 0.15;
      ui();
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
    for (const t of trees) {
      t.shake = Math.max(0, t.shake - dt);
      t.canopy.rotation.z = t.shake
        ? Math.sin(t.shake * 80) * 0.065
        : Math.sin(elapsed * 1.3 + t.id) * 0.012;
    }
    campsite.flames.forEach((f, i) => {
      f.scale.y = 1 + Math.sin(elapsed * 9 + i) * 0.16;
      f.rotation.y = elapsed * (i + 1) * 0.5;
    });
    world.fireLight.intensity = 12 + Math.sin(elapsed * 9) * 2;
    world.ripples.forEach((r, i) => {
      const t = (elapsed * 0.2 + i * 0.17) % 1;
      r.scale.setScalar(0.5 + t * 1.8);
      r.material.opacity = (1 - t) * 0.4;
    });
  }
  function dispose() {
    keys.clear();
  }
  ui();
  return {
    state,
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
