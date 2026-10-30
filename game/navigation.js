import { CAMP } from "./camp-layout.js";
import {
  fencePlan,
  partialFence,
  constructionCollisionKey,
} from "../construction.js";
import { CENTER, RADII } from "./config.js";
// Круглые стволы, скруглённые основания, скольжение и A* сохранены при смене движка.
export function createNavigation(
  model,
  gameState,
  player,
  showNotice = () => {},
) {
  const { trees, ancientTree, landmarks, waterCollision } = model;
  const construction = { plan: fencePlan(CENTER) };
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const forestRadius = () => RADII[gameState.campLevel];
  const bounds = model.bounds || { x: 0, y: 0, width: 3200, height: 3200 };
  const merchant = model.merchant || CAMP.merchant;
  function constrainPoint(x, y) {
    if (model.regions) return model.regions.constrain(x, y, player.radius);
    const dx = x - CENTER.x,
      dy = y - CENTER.y,
      d = Math.hypot(dx, dy),
      r = forestRadius() - player.radius;
    return d > r
      ? { x: CENTER.x + (dx / d) * r, y: CENTER.y + (dy / d) * r }
      : { x, y };
  }
  const obstacleBuckets = new Map();
  let obstacles = [],
    navVersion = 0,
    lastConstructionKey = "";
  const BUCKET = 128,
    NAV = 32,
    GRID = Math.ceil(bounds.width / NAV);
  const FOOT_RADIUS = 10; // Физика учитывает ноги, а не ширину спрайта или рюкзака.
  function campFencePosts() {
    return partialFence(gameState, construction.plan).posts;
  }
  function campFenceSegments() {
    return (
      model.defenses?.fenceSegments() ||
      partialFence(gameState, construction.plan).segments
    );
  }
  function rebuildObstacles() {
    obstacles = [];
    obstacleBuckets.clear();
    navVersion++;
    lastConstructionKey = constructionCollisionKey(
      gameState,
      construction.plan,
    );
    const circle = (x, y, r) => obstacles.push({ x, y, r, half: 0 });
    // Горизонтальная капсула: скруглённое основание вместо цепляющихся прямых углов.
    const capsule = (x, y, w, h) =>
      obstacles.push({
        x: x + w / 2,
        y: y + h / 2,
        r: h / 2,
        half: Math.max(0, (w - h) / 2),
      });
    for (const t of trees) if (t.hp > 0) circle(t.x, t.y - 3, 8);
    if (!model.regions || model.regions.isOpen(ancientTree))
      circle(ancientTree.x, ancientTree.y - 12, 50);
    // Пни, камни, сундуки, траву и стопки дров можно пересекать свободно.
    capsule(CAMP.stall.x - 80, CAMP.stall.y - 30, 160, 32);
    if (!model.regions || model.regions.isOpen(merchant))
      capsule(merchant.x - 82, merchant.y - 24, 164, 28);
    if (gameState.campLevel >= 1 || gameState.buildWood > 0)
      circle(1600, 1600, 23);
    if (
      (gameState.campLevel >= 2 && gameState.campLevel < 4) ||
      (gameState.campLevel === 1 && gameState.buildWood > 0)
    )
      capsule(CAMP.tent.x - 80, CAMP.tent.y - 22, 160, 26);
    if (
      gameState.campLevel >= 4 ||
      (gameState.campLevel === 3 && gameState.buildWood > 0)
    )
      capsule(CAMP.hut.x - 114, CAMP.hut.y - 44, 228, 48);
    for (const p of campFencePosts()) circle(p.x, p.y, 5);
    for (const [a, b] of campFenceSegments())
      obstacles.push({
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
        r: 4,
        half: 0,
        a,
        b,
      });
    for (const site of model.defenses?.all() || [])
      if (site.kind === "barricade" && site.hp > 0)
        capsule(site.x - 32, site.y - 6, 64, 12);
    for (const site of landmarks) {
      if (model.regions && !model.regions.isOpen(site)) continue;
      if (site.type === "camp") capsule(site.x - 57, site.y - 18, 100, 22);
      else if (site.type === "arch") {
        // У ворот остаётся проём: непроходимы только основания двух колонн.
        capsule(site.x - 82, site.y - 18, 30, 20);
        capsule(site.x + 56, site.y - 18, 30, 20);
      } else if (site.type === "ruins") {
        if (model.regions) {
          for (const column of [0, 1, 2, 4, 5, 6])
            capsule(site.x - 88 + column * 27, site.y - 18, 25, 20);
        } else capsule(site.x - 49, site.y - 18, 98, 22);
      } else if (site.type === "wagon")
        capsule(site.x - 40, site.y - 16, 80, 24);
    }
    for (const o of obstacles) {
      const x0 = (o.a ? Math.min(o.a.x, o.b.x) : o.x - o.half) - o.r,
        y0 = (o.a ? Math.min(o.a.y, o.b.y) : o.y) - o.r,
        x1 = (o.a ? Math.max(o.a.x, o.b.x) : o.x + o.half) + o.r,
        y1 = (o.a ? Math.max(o.a.y, o.b.y) : o.y) + o.r;
      for (let y = Math.floor(y0 / BUCKET); y <= Math.floor(y1 / BUCKET); y++)
        for (
          let x = Math.floor(x0 / BUCKET);
          x <= Math.floor(x1 / BUCKET);
          x++
        ) {
          const key = x + "," + y;
          if (!obstacleBuckets.has(key)) obstacleBuckets.set(key, []);
          obstacleBuckets.get(key).push(o);
        }
    }
  }
  function obstacleContact(x, y, r = FOOT_RADIUS) {
    let deepest = null;
    for (
      let by = Math.floor((y - r) / BUCKET);
      by <= Math.floor((y + r) / BUCKET);
      by++
    )
      for (
        let bx = Math.floor((x - r) / BUCKET);
        bx <= Math.floor((x + r) / BUCKET);
        bx++
      ) {
        for (const o of obstacleBuckets.get(bx + "," + by) || []) {
          let cx = clamp(x, o.x - o.half, o.x + o.half),
            cy = o.y;
          if (o.a) {
            const vx = o.b.x - o.a.x,
              vy = o.b.y - o.a.y,
              t = clamp(
                ((x - o.a.x) * vx + (y - o.a.y) * vy) / (vx * vx + vy * vy),
                0,
                1,
              );
            cx = o.a.x + vx * t;
            cy = o.a.y + vy * t;
          }
          const dx = x - cx,
            dy = y - cy,
            d = Math.hypot(dx, dy),
            depth = r + o.r - d;
          if (depth > 0.005 && (!deepest || depth > deepest.depth))
            deepest = {
              depth,
              nx: d > 0.001 ? dx / d : 0,
              ny: d > 0.001 ? dy / d : 1,
            };
        }
      }
    return deepest;
  }
  function isWalkable(x, y, r = FOOT_RADIUS) {
    return (
      (model.regions
        ? model.regions.contains(x, y, r)
        : Math.hypot(x - 1600, y - 1600) <= forestRadius() - r) &&
      !waterCollision(x, y, r) &&
      !obstacleContact(x, y, r)
    );
  }
  function nearestGround(x, y, r = FOOT_RADIUS) {
    const p = constrainPoint(x, y);
    if (isWalkable(p.x, p.y, r)) return p;
    for (let d = 8; d <= 320; d += 8)
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2,
          n = { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d };
        if (isWalkable(n.x, n.y, r)) return n;
      }
    return { x: 1600, y: 1720 };
  }
  // Sight is independent of walkability: water is transparent; solid bases and locked fog are not.
  function hasLineOfSight(a, b) {
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4));
    for (let i = 0; i <= steps; i++) {
      const x = a.x + ((b.x - a.x) * i) / steps,
        y = a.y + ((b.y - a.y) * i) / steps;
      if (
        (model.regions && !model.regions.isOpen({ x, y })) ||
        obstacleContact(x, y, 0)
      )
        return false;
    }
    return true;
  }
  function clearSegment(a, b, r = FOOT_RADIUS) {
    const d = Math.hypot(b.x - a.x, b.y - a.y),
      steps = Math.max(1, Math.ceil(d / 7));
    for (let i = 1; i <= steps; i++)
      if (
        !isWalkable(
          a.x + ((b.x - a.x) * i) / steps,
          a.y + ((b.y - a.y) * i) / steps,
          r,
        )
      )
        return false;
    return true;
  }
  function moveBody(body, dx, dy, r = FOOT_RADIUS) {
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 4));
    let moved = 0;
    for (let i = 0; i < steps; i++) {
      const ox = body.x,
        oy = body.y,
        sx = dx / steps,
        sy = dy / steps;
      if (isWalkable(ox + sx, oy + sy, r)) {
        body.x += sx;
        body.y += sy;
      } else {
        // Выталкиваем только на глубину проникновения: движение плавно идёт по касательной.
        let x = ox + sx,
          y = oy + sy;
        for (let pass = 0; pass < 4; pass++) {
          const c = obstacleContact(x, y, r);
          if (!c) break;
          x += c.nx * (c.depth + 0.02);
          y += c.ny * (c.depth + 0.02);
        }
        if (
          Math.hypot(x - ox, y - oy) <= Math.hypot(sx, sy) * 1.5 + 0.1 &&
          isWalkable(x, y, r)
        ) {
          body.x = x;
          body.y = y;
        } else {
          if (isWalkable(body.x + sx, body.y, r)) body.x += sx;
          if (isWalkable(body.x, body.y + sy, r)) body.y += sy;
        }
      }
      moved += Math.hypot(body.x - ox, body.y - oy);
    }
    return moved;
  }
  // A* по сетке; проверка отрезков запрещает срезать углы и проходить через стволы.
  function findPath(start, goal) {
    const target = nearestGround(goal.x, goal.y);
    if (clearSegment(start, target)) return [target];
    const walkCache = new Int8Array(GRID * GRID),
      cost = new Float64Array(GRID * GRID);
    cost.fill(Infinity);
    const parent = new Int32Array(GRID * GRID);
    parent.fill(-1);
    const closed = new Uint8Array(GRID * GRID);
    const center = (id) => ({
      x: bounds.x + (id % GRID) * NAV + NAV / 2,
      y: bounds.y + Math.floor(id / GRID) * NAV + NAV / 2,
    });
    const free = (id) => {
      if (id < 0 || id >= GRID * GRID) return false;
      if (!walkCache[id]) {
        const p = center(id);
        walkCache[id] = isWalkable(p.x, p.y) ? 1 : -1;
      }
      return walkCache[id] === 1;
    };
    function nearestCell(p) {
      const cx = Math.floor((p.x - bounds.x) / NAV),
        cy = Math.floor((p.y - bounds.y) / NAV);
      for (let rad = 0; rad < 7; rad++) {
        let best = -1,
          dist = Infinity;
        for (let y = cy - rad; y <= cy + rad; y++)
          for (let x = cx - rad; x <= cx + rad; x++) {
            if (x < 0 || x >= GRID || y < 0 || y >= GRID) continue;
            const id = y * GRID + x,
              n = center(id),
              d = Math.hypot(p.x - n.x, p.y - n.y);
            if (d < dist && free(id) && clearSegment(p, n)) {
              best = id;
              dist = d;
            }
          }
        if (best >= 0) return best;
      }
      return -1;
    }
    const first = nearestCell(start),
      last = nearestCell(target);
    if (first < 0 || last < 0) return [];
    const heap = [];
    function push(id, f) {
      let i = heap.length;
      heap.push({ id, f });
      while (i) {
        const p = (i - 1) >> 1;
        if (heap[p].f <= f) break;
        heap[i] = heap[p];
        i = p;
      }
      heap[i] = { id, f };
    }
    function pop() {
      const top = heap[0],
        end = heap.pop();
      if (heap.length) {
        let i = 0;
        heap[0] = end;
        while (true) {
          let c = i * 2 + 1;
          if (c >= heap.length) break;
          if (c + 1 < heap.length && heap[c + 1].f < heap[c].f) c++;
          if (heap[c].f >= end.f) break;
          heap[i] = heap[c];
          i = c;
          heap[i] = end;
        }
      }
      return top.id;
    }
    cost[first] = 0;
    push(first, 0);
    let visits = 0,
      found = false;
    while (heap.length && visits++ < (model.regions ? 20000 : 10000)) {
      const id = pop();
      if (closed[id]) continue;
      closed[id] = 1;
      if (id === last) {
        found = true;
        break;
      }
      const p = center(id),
        cx = id % GRID,
        cy = Math.floor(id / GRID);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const x = cx + dx,
            y = cy + dy;
          if (x < 0 || x >= GRID || y < 0 || y >= GRID) continue;
          const next = y * GRID + x;
          if (closed[next] || !free(next)) continue;
          const n = center(next);
          if (!clearSegment(p, n)) continue;
          const g = cost[id] + Math.hypot(dx, dy);
          if (g < cost[next]) {
            cost[next] = g;
            parent[next] = id;
            push(
              next,
              g + Math.hypot(x - (last % GRID), y - Math.floor(last / GRID)),
            );
          }
        }
    }
    if (!found) return [];
    const raw = [target];
    for (let id = last; id !== -1; id = parent[id]) {
      raw.push(center(id));
      if (id === first) break;
    }
    raw.reverse();
    const result = [];
    let anchor = start,
      index = 0;
    while (index < raw.length) {
      let far = index;
      while (far + 1 < raw.length && clearSegment(anchor, raw[far + 1])) far++;
      result.push(raw[far]);
      anchor = raw[far];
      index = far + 1;
    }
    return result;
  }
  function setDestination(x, y) {
    const target = nearestGround(x, y);
    player.targetX = target.x;
    player.targetY = target.y;
    player.path = findPath(player, target);
    player.pathVersion = navVersion;
    if (!player.path.length && distance(player, target) > 12)
      showNotice("Здесь нет прохода. Попробуйте подойти с другой стороны.");
  }
  function followPath(body, dt, speed) {
    let budget = speed * dt,
      total = 0;
    while (budget > 0 && body.path?.length) {
      const p = body.path[0],
        dx = p.x - body.x,
        dy = p.y - body.y,
        d = Math.hypot(dx, dy);
      if (d < 1) {
        body.path.shift();
        continue;
      }
      const step = Math.min(budget, d),
        moved = moveBody(body, (dx / d) * step, (dy / d) * step);
      total += moved;
      budget -= step;
      if (moved < step * 0.1) break;
      if (Math.hypot(p.x - body.x, p.y - body.y) < 1) body.path.shift();
    }
    return total;
  }

  rebuildObstacles();
  return {
    rebuildObstacles,
    isWalkable,
    nearestGround,
    clearSegment,
    hasLineOfSight,
    moveBody,
    findPath,
    setDestination,
    followPath,
    constrainPoint,
    campFencePosts,
    campFenceSegments,
    get version() {
      return navVersion;
    },
    get collisionKey() {
      return lastConstructionKey;
    },
  };
}
