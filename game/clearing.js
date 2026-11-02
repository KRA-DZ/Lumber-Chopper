// Debris is finite terrain, not a tree: no regrowth, daily payout or extra physics.
export function createClearing({
  state,
  player,
  world,
  regions,
  nav,
  forestry,
  canAct,
}) {
  const all = (world.locations || []).flatMap((l) => l.debris || []);
  const byId = new Map(all.map((d) => [d.id, d]));
  const hp = (d) => state.exploration.debrisHP[d.id] ?? d.maxHP;
  const available = (d) => !!d && regions.isOpen(d) && hp(d) > 0;
  function contact(d, p = player) {
    const dx = d.b.x - d.a.x,
      dy = d.b.y - d.a.y;
    const t = Math.max(
      0,
      Math.min(
        1,
        ((p.x - d.a.x) * dx + (p.y - d.a.y) * dy) / (dx * dx + dy * dy),
      ),
    );
    return { x: d.a.x + dx * t, y: d.a.y + dy * t };
  }
  function near(d) {
    if (!available(d) || !nav.isWalkable(player.x, player.y)) return false;
    const p = contact(d),
      dx = player.x - p.x,
      dy = player.y - p.y;
    const length = Math.hypot(dx, dy);
    // Stop the sight ray just outside this obstacle's surface, not at its centre.
    return (
      length < 72 &&
      length > d.r &&
      nav.hasLineOfSight(player, {
        x: p.x + (dx / length) * (d.r + 2),
        y: p.y + (dy / length) * (d.r + 2),
      })
    );
  }
  function approach(d) {
    if (!available(d)) return null;
    const dx = d.b.x - d.a.x,
      dy = d.b.y - d.a.y,
      length = Math.hypot(dx, dy);
    const points = [-1, 1]
      .map((side) => ({
        x: d.x - (dy / length) * side * (d.r + player.radius + 14),
        y: d.y + (dx / length) * side * (d.r + player.radius + 14),
      }))
      .sort(
        (a, b) =>
          Math.hypot(a.x - player.x, a.y - player.y) -
          Math.hypot(b.x - player.x, b.y - player.y),
      );
    return (
      points.find(
        (p) => nav.isWalkable(p.x, p.y) && nav.findPath(player, p).length,
      ) || null
    );
  }
  function strike(id, damage) {
    const debris = byId.get(id);
    if (!canAct() || !near(debris) || !Number.isFinite(damage) || damage <= 0)
      return null;
    const dealt = Math.min(hp(debris), damage);
    const remaining = hp(debris) - dealt;
    state.exploration.debrisHP[id] = remaining;
    if (!remaining) {
      forestry.dropPile(id, debris.x, debris.y, debris.logs, debris.value);
      nav.rebuildObstacles();
    }
    return { debris, damage: dealt, cleared: remaining === 0 };
  }
  return {
    all,
    get: (id) => byId.get(id),
    hp,
    available,
    near,
    contact,
    approach,
    strike,
  };
}
