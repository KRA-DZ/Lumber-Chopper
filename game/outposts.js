export const OUTPOST = Object.freeze({
  ignitionLogs: 2,
  secondsPerLog: 60,
  maxFuel: 180,
  safeRadius: 150,
  lightRadius: 230,
  warningSeconds: 20,
});

// Fuel belongs to the simulation; renderer/UI cannot extend a fire's lifetime.
export function createOutposts({ state, world, regions, nav, forestry, emit = () => {} }) {
  const sites = (world.locations || []).flatMap(l => l.sites).filter(s => s.kind === "outpost"),
    byId = new Map(sites.map(s => [s.id, s])), fuel = state.exploration.outpostFuel;
  let revision = 0;
  const remaining = id => byId.has(id) ? fuel[id] || 0 : 0;
  const lit = id => remaining(id) > 0 && regions.isOpen(byId.get(id));
  function canStoke(id) {
    return byId.has(id) && regions.isOpen(byId.get(id)) && !state.gameOver &&
      remaining(id) <= OUTPOST.maxFuel - OUTPOST.secondsPerLog &&
      state.cargo.length >= (remaining(id) > 0 ? 1 : OUTPOST.ignitionLogs);
  }
  return {
    sites, remaining, lit, canStoke,
    stoke(id) {
      if (!canStoke(id)) return false;
      const logs = remaining(id) > 0 ? 1 : OUTPOST.ignitionLogs;
      for (let i = 0; i < logs; i++) forestry.takeCargo();
      fuel[id] = remaining(id) + logs * OUTPOST.secondsPerLog;
      revision++;
      emit("outpost-stoked", { site: byId.get(id), logs, fuel: fuel[id] });
      return true;
    },
    update(dt) {
      if (state.gameOver || !Number.isFinite(dt) || dt <= 0) return;
      for (const site of sites) {
        const before = remaining(site.id);
        if (!before) continue;
        fuel[site.id] = Math.max(0, before - dt);
        if (before > OUTPOST.warningSeconds && fuel[site.id] <= OUTPOST.warningSeconds)
          emit("outpost-low-fuel", { site });
        if (fuel[site.id] === 0) {
          revision++;
          emit("outpost-extinguished", { site });
        }
      }
    },
    safeZone(p) {
      const site = sites.find(s => lit(s.id) && Math.hypot(s.x - p.x, s.y - p.y) < OUTPOST.safeRadius &&
        nav.hasLineOfSight(s, p));
      return site ? { x: site.x, y: site.y, r: OUTPOST.safeRadius, id: site.id } : null;
    },
    lights() {
      return sites.filter(s => lit(s.id)).map(s => ({ x: s.x, y: s.y, r: OUTPOST.lightRadius, kind: "outpost" }));
    },
    get revision() { return revision; },
  };
}
