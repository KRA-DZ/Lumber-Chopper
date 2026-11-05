export function ambientCue(core, random = Math.random) {
  const p = core.player, biome = core.world.biomeAt(p.x, p.y),
    night = core.nightAmount() > 0.5;
  if (night) {
    const source = (core.survival?.residents || []).filter(e => e.moving && e.hp > 0 && !e.warning)
      .map(e => ({ e, distance: Math.hypot(e.x - p.x, e.y - p.y) }))
      .filter(({ distance }) => distance > 90 && distance < 560)
      .sort((a, b) => a.distance - b.distance)[0];
    if (source) return { biome, kind: "steps", frequency: 400, duration: 0.13,
      volume: 0.025 * (1 - source.distance / 650),
      pan: Math.max(-0.85, Math.min(0.85, (source.e.x - p.x) / 300)), interval: 2.5 };
  }
  const swamp = biome === "swamp", pan = (random() - 0.5) * 1.4;
  return { biome, kind: swamp ? "frog" : night ? "owl" : "bird",
    frequency: swamp ? 170 + random() * 90 : night ? 420 : 1800 + random() * 700,
    duration: swamp ? 0.28 : night ? 0.4 : 0.18,
    volume: night ? 0.012 : 0.018, pan,
    interval: (night ? 3 : 4) + random() * 4 };
}
