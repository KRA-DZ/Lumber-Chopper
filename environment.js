// Слабое покачивание — смена целочисленных пиксельных кадров, без размытия спрайта.
export const ENVIRONMENT_LIMITS = Object.freeze({ leaves: 24, swaySets: 16 });
export function createEnvironment(art) {
  const cache = new Map(),
    leaves = [];
  let timer = 0,
    serial = 0;
  function sway(sprite, phase) {
    if (phase === 0) return sprite;
    if (!cache.has(sprite)) {
      const frames = [-1, 1].map((side) => {
        const bitmap = document.createElement("canvas");
        bitmap.width = sprite.width + 4;
        bitmap.height = sprite.height;
        const ctx = bitmap.getContext("2d");
        ctx.imageSmoothingEnabled = false;
        const small = sprite.height < 40,
          hinge = Math.max(1, sprite.ay - (small ? 2 : 30));
        for (let y = 0; y < sprite.height; y++) {
          const shift =
            y < hinge
              ? Math.round(
                  side * Math.min(1, (hinge - y) / (small ? 10 : hinge)),
                )
              : 0;
          ctx.drawImage(
            sprite.bitmap,
            0,
            y,
            sprite.width,
            1,
            2 + shift,
            y,
            sprite.width,
            1,
          );
        }
        return {
          bitmap,
          width: bitmap.width,
          height: bitmap.height,
          ax: sprite.ax + 2,
          ay: sprite.ay,
        };
      });
      cache.set(sprite, frames);
      while (cache.size > ENVIRONMENT_LIMITS.swaySets)
        cache.delete(cache.keys().next().value);
    }
    return cache.get(sprite)[phase < 0 ? 0 : 1];
  }
  function treeSprite(tree, sprite, time) {
    return sway(
      sprite,
      [0, 1, 0, -1][Math.floor(time * 1.4 + tree.legacyIndex * 0.7) % 4],
    );
  }
  function plantSprite(sprite, time, seed) {
    return sway(sprite, [0, 1, 0, -1][Math.floor(time * 1.1 + seed) % 4]);
  }
  function update(dt, time, trees, player) {
    if (dt <= 0) return;
    timer -= dt;
    if (timer <= 0) {
      timer = 0.65;
      const live = trees.filter(
        (t) =>
          t.hp > 0 &&
          (t.type === "oak" || t.type === "birch") &&
          Math.hypot(t.x - player.x, t.y - player.y) < 450,
      );
      if (live.length && leaves.length < ENVIRONMENT_LIMITS.leaves) {
        const t = live[serial++ % live.length],
          phase = serial * 2.399;
        leaves.push({
          x: t.x + Math.sin(phase) * 44,
          y: t.y - 145,
          startY: t.y - 145,
          ground: t.y + Math.cos(phase) * 10,
          age: 0,
          duration: 3.4 + (serial % 3) * 0.4,
          phase,
          color: t.type === "birch" ? "#c9c975" : "#8eb05a",
        });
      }
    }
    for (let i = leaves.length - 1; i >= 0; i--) {
      const l = leaves[i];
      l.age += dt;
      l.x += dt * (8 + Math.sin(time * 2 + l.phase) * 12);
      l.y = l.startY + (l.ground - l.startY) * Math.min(1, l.age / l.duration);
      if (l.age > l.duration + 1) leaves.splice(i, 1);
    }
  }
  function draw(ctx, time, view) {
    for (const l of leaves) {
      if (
        l.x < view.x ||
        l.x > view.x + view.width ||
        l.y < view.y ||
        l.y > view.y + view.height
      )
        continue;
      ctx.globalAlpha =
        l.age > l.duration ? Math.max(0, 1 - (l.age - l.duration)) : 1;
      ctx.fillStyle = l.color;
      const x = Math.round((l.x + Math.sin(time * 4 + l.phase) * 4) / 2) * 2,
        y = Math.round(l.y / 2) * 2;
      ctx.fillRect(x, y, Math.floor(time * 6 + l.phase) % 2 ? 4 : 2, 2);
      ctx.fillRect(x + 2, y + 2, 2, 2);
    }
    ctx.globalAlpha = 1;
  }
  return {
    update,
    draw,
    treeSprite,
    plantSprite,
    leaves,
    get cachedSwaySets() {
      return cache.size;
    },
  };
}
