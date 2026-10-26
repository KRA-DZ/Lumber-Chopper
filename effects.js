// Только визуальные события: этот модуль не изменяет HP, инвентарь или деньги.
export const EFFECT_LIMITS = Object.freeze({
  falls: 4,
  logs: 16,
  dust: 64,
  frameSets: 4,
});
const ease = (t) => t * t * (3 - 2 * t);
export function createEffects(art) {
  const falls = [],
    logs = [],
    dust = [],
    bursts = [],
    frameCache = new Map();
  let serial = 0;
  function fallFrames(sprite) {
    if (frameCache.has(sprite)) {
      const frames = frameCache.get(sprite);
      frameCache.delete(sprite);
      frameCache.set(sprite, frames);
      return frames;
    }
    const frames = [-0.04, 0.06, 0.28, 0.64, 1.05, 1.5].map((angle) => {
      const bitmap = document.createElement("canvas");
      bitmap.width = 176;
      bitmap.height = 144;
      const ctx = bitmap.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      ctx.translate(48, 130);
      ctx.rotate(angle);
      // Нижние пиксели остаются пнём, а не вращаются вместе с кроной.
      const h = Math.min(sprite.height, sprite.ay - 4);
      ctx.drawImage(
        sprite.bitmap,
        0,
        0,
        sprite.width,
        h,
        -sprite.ax,
        -sprite.ay,
        sprite.width,
        h,
      );
      return { bitmap, width: 176, height: 144, ax: 48, ay: 130 };
    });
    frameCache.set(sprite, frames);
    while (frameCache.size > EFFECT_LIMITS.frameSets)
      frameCache.delete(frameCache.keys().next().value);
    return frames;
  }
  function chips(x, y, color = "#d5a266", amount = 10) {
    for (let i = 0; i < amount; i++) {
      if (dust.length >= EFFECT_LIMITS.dust) dust.shift();
      const a = i * 2.399 + serial++ * 0.17;
      dust.push({
        x,
        y,
        vx: Math.cos(a) * (22 + (i % 4) * 18),
        vy: -35 - (i % 5) * 14,
        life: 0.55 + (i % 3) * 0.08,
        max: 0.75,
        color,
      });
    }
  }
  function fell(tree, sprite, player) {
    if (falls.length >= EFFECT_LIMITS.falls) falls.shift();
    falls.push({
      x: tree.x,
      y: tree.y,
      side: player.x < tree.x ? 1 : -1,
      age: 0,
      frames: fallFrames(sprite),
      id: tree.id,
    });
    chips(tree.x, tree.y - 12, "#dab576", 16);
  }
  function pushLog(event) {
    if (logs.length >= EFFECT_LIMITS.logs) logs.shift();
    logs.push(event);
  }
  function pickup(tree, index) {
    pushLog({
      kind: "pickup",
      age: 0,
      duration: 0.78,
      x: tree.x,
      y: tree.y - 16,
      start: { x: tree.x, y: tree.y - 16 },
      index,
    });
  }
  function transfer(kind, start, target) {
    pushLog({
      kind,
      age: 0,
      duration: 0.55,
      x: start.x,
      y: start.y,
      start: { ...start },
      target,
    });
  }
  function complete(target) {
    if (bursts.length >= 3) bursts.shift();
    bursts.push({ x: target.x, y: target.y, age: 0 });
    chips(target.x, target.y - 10, "#f1d082", 24);
  }
  function update(dt, player, wood) {
    if (dt <= 0) return;
    for (let i = falls.length - 1; i >= 0; i--) {
      falls[i].age += dt;
      if (falls[i].age >= 1.2) falls.splice(i, 1);
    }
    for (let i = logs.length - 1; i >= 0; i--) {
      const l = logs[i];
      l.age += dt;
      const raw =
          l.kind === "pickup"
            ? Math.max(0, (l.age - 0.18) / 0.6)
            : l.age / l.duration,
        t = Math.min(1, raw),
        s = ease(t);
      const target =
        l.kind === "pickup"
          ? {
              x: player.x,
              y:
                player.y - 4 - Math.min(Math.max(0, wood - 1), l.index, 39) * 9,
            }
          : l.target.follow
            ? {
                x: l.target.follow.x + l.target.dx,
                y: l.target.follow.y + l.target.dy,
              }
            : l.target;
      l.x = l.start.x + (target.x - l.start.x) * s;
      l.y =
        l.start.y +
        (target.y - l.start.y) * s -
        Math.sin(Math.min(1, l.age / l.duration) * Math.PI) * 26;
      if (l.age >= l.duration) logs.splice(i, 1);
    }
    for (let i = dust.length - 1; i >= 0; i--) {
      const p = dust[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 180 * dt;
      if (p.life <= 0) dust.splice(i, 1);
    }
    for (let i = bursts.length - 1; i >= 0; i--) {
      bursts[i].age += dt;
      if (bursts[i].age >= 1) bursts.splice(i, 1);
    }
  }
  function cargoHidden(index) {
    return logs.some((l) => l.kind === "pickup" && l.index === index);
  }
  function drawFall(ctx, f) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, (1.2 - f.age) / 0.35));
    const frame = Math.min(5, Math.floor(Math.min(1, f.age / 0.72) * 6));
    art.draw(ctx, f.frames[frame], f.x, f.y - 6, 2, f.side < 0);
    ctx.restore();
  }
  function draw(ctx, view) {
    const visible = (x, y) =>
      x > view.x - 80 &&
      x < view.x + view.width + 80 &&
      y > view.y - 200 &&
      y < view.y + view.height + 80;
    for (const l of logs)
      if (visible(l.x, l.y)) art.draw(ctx, art.sprites.log, l.x, l.y);
    for (const p of dust)
      if (visible(p.x, p.y)) {
        ctx.globalAlpha = Math.min(1, p.life / 0.2);
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x / 2) * 2, Math.round(p.y / 2) * 2, 4, 2);
      }
    ctx.globalAlpha = 1;
    for (const b of bursts) {
      ctx.save();
      ctx.globalAlpha = (1 - b.age) * 0.7;
      ctx.strokeStyle = "#f3d88c";
      ctx.lineWidth = 2;
      const r = 14 + b.age * 55;
      ctx.strokeRect(
        Math.round((b.x - r) / 2) * 2,
        Math.round((b.y - r * 0.4) / 2) * 2,
        Math.round((r * 2) / 2) * 2,
        Math.round((r * 0.8) / 2) * 2,
      );
      ctx.restore();
    }
  }
  return {
    falls,
    logs,
    dust,
    bursts,
    fell,
    pickup,
    transfer,
    complete,
    chips,
    update,
    cargoHidden,
    drawFall,
    draw,
    get cachedFrameSets() {
      return frameCache.size;
    },
  };
}
