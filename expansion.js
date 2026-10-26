const TAU = Math.PI * 2;
export function createExpansion({ center, radii }) {
  const rings = [];
  let radius = radii[0],
    target = radius;
  function open(from, to) {
    if (to <= from) return;
    if (rings.length >= 4) rings.shift();
    rings.push({ from, to, age: 0 });
    target = to;
  }
  function update(dt, level) {
    const actual = radii[level];
    // Поддерживает прямую смену этапа в инструментах тестирования.
    if (actual !== target) {
      target = radius = actual;
      rings.length = 0;
    }
    if (dt <= 0) return;
    radius += (target - radius) * (1 - Math.exp(-dt * 2.5));
    if (Math.abs(target - radius) < 0.1) radius = target;
    for (let i = rings.length - 1; i >= 0; i--) {
      rings[i].age += dt;
      if (rings[i].age >= 18) rings.splice(i, 1);
    }
  }
  function annulus(ctx, from, to) {
    ctx.beginPath();
    ctx.arc(center.x, center.y, to, 0, TAU);
    ctx.arc(center.x, center.y, from, 0, TAU, true);
    ctx.fill("evenodd");
  }
  function drawWorld(ctx, view, level) {
    ctx.save();
    for (const ring of rings) {
      ctx.fillStyle = `rgba(208,225,118,${(1 - ring.age / 18) * 0.15})`;
      annulus(ctx, ring.from, Math.max(ring.from, Math.min(ring.to, radius)));
      ctx.strokeStyle = `rgba(245,221,139,${(1 - ring.age / 18) * 0.85})`;
      ctx.lineWidth = 4;
      ctx.setLineDash([12, 12]);
      ctx.beginPath();
      ctx.arc(center.x, center.y, ring.from, 0, TAU);
      ctx.stroke();
      const r = Math.min(ring.to, radius);
      for (let i = 0; i < 40; i++) {
        const a = (i / 40) * TAU + ring.age * 0.025,
          x = center.x + Math.cos(a) * r,
          y = center.y + Math.sin(a) * r;
        if (
          x < view.x ||
          x > view.x + view.width ||
          y < view.y ||
          y > view.y + view.height
        )
          continue;
        ctx.fillStyle = "#f3dda2";
        ctx.globalAlpha =
          (1 - ring.age / 18) * (0.5 + Math.sin(i + ring.age * 3) * 0.25);
        ctx.fillRect(Math.round(x / 2) * 2, Math.round(y / 2) * 2, 6, 4);
      }
      ctx.globalAlpha = 1;
    }
    // Следы открытых колец остаются, чтобы расширение читалось и после вспышки.
    for (let i = 0; i < level; i++) {
      ctx.strokeStyle = "#d2c58536";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 20]);
      ctx.beginPath();
      ctx.arc(center.x, center.y, radii[i], 0, TAU);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.fillStyle = "#142f29eb";
    ctx.beginPath();
    ctx.rect(view.x, view.y, view.width, view.height);
    ctx.arc(center.x, center.y, radius, 0, TAU);
    ctx.fill("evenodd");
    ctx.strokeStyle = "#e4d28c";
    ctx.lineWidth = 4;
    ctx.setLineDash([10, 12]);
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
  function drawMapRings(ctx, size, scale, level) {
    ctx.save();
    ctx.translate(size / 2, size / 2);
    for (let i = 0; i < radii.length; i++) {
      ctx.strokeStyle =
        i === level ? "#f3dc93" : i < level ? "#b8ca8575" : "#6d897564";
      ctx.lineWidth = i === level ? 2 : 1;
      ctx.setLineDash(i === level ? [] : [2, 3]);
      ctx.beginPath();
      ctx.arc(0, 0, (i === level ? radius : radii[i]) * scale, 0, TAU);
      ctx.stroke();
    }
    for (const r of rings) {
      ctx.globalAlpha = (1 - r.age / 18) * (0.4 + Math.sin(r.age * 5) * 0.2);
      ctx.fillStyle = "#e7d78f";
      ctx.beginPath();
      ctx.arc(0, 0, r.to * scale, 0, TAU);
      ctx.arc(0, 0, r.from * scale, 0, TAU, true);
      ctx.fill("evenodd");
    }
    ctx.restore();
  }
  return {
    open,
    update,
    drawWorld,
    drawMapRings,
    rings,
    get radius() {
      return radius;
    },
    get banner() {
      const r = rings.at(-1);
      return r && r.age < 5.5 ? r : null;
    },
  };
}
