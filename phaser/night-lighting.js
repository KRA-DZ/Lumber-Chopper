import { NIGHT_START } from "../game/cycle.js";
import { CENTER } from "../game/config.js";
import { CAMP, pixelHash } from "../pixel-art.js";
import { nightSight } from "../mystery.js";

// Night is fully opaque from the boundary onward; dusk only prepares the transition.
export function nightOpacity(state) {
  if (state.worldTime >= NIGHT_START) return 1;
  const t = Math.max(
    0,
    Math.min(1, (state.worldTime - (NIGHT_START - 30)) / 30),
  );
  return t * t * (3 - 2 * t);
}
export function campLights(state, safeRadius) {
  return [
    { x: CENTER.x, y: CENTER.y, r: safeRadius + 120 },
    { x: CAMP.stall.x + 80, y: CAMP.stall.y - 80, r: 90 },
    ...(state.campLevel === 4
      ? [
          { x: CAMP.hut.x - 68, y: CAMP.hut.y - 68, r: 100 },
          { x: CAMP.hut.x + 78, y: CAMP.hut.y - 68, r: 85 },
        ]
      : []),
  ];
}
export function nightLights(state, player, safeRadius, outposts = []) {
  return [
    {
      x: player.x,
      y: player.y - 24,
      r: nightSight(state.lanternLevel),
      kind: "player",
    },
    ...campLights(state, safeRadius),
    ...outposts,
  ];
}
export function inCampLight(x, y, lights) {
  return lights.some((l) => Math.hypot(x - l.x, y - l.y) < l.r * 0.9);
}
// Decorative points never punch holes in the darkness mask or affect safe areas.
export function nightFireflies(
  time,
  view,
  accessible,
  lights,
  lightMode = false,
) {
  const dots = [];
  const cell = 320;
  for (
    let cy = Math.floor(view.y / cell);
    cy <= Math.floor(view.bottom / cell);
    cy++
  )
    for (
      let cx = Math.floor(view.x / cell);
      cx <= Math.floor(view.right / cell);
      cx++
    ) {
      const h = pixelHash(cx, cy);
      if (h % 3 !== 0 || (lightMode && h % 2)) continue;
      for (let i = 0; i < 2; i++) {
        const x =
          cx * cell +
          70 +
          ((h >>> 4) % 170) +
          Math.sin(time * 0.4 + i) * 12 +
          i * 9;
        const y =
          cy * cell + 80 + ((h >>> 13) % 140) + Math.cos(time * 0.6 + i) * 8;
        if (
          x < view.x ||
          x > view.right ||
          y < view.y ||
          y > view.bottom ||
          !accessible({ x, y }) ||
          inCampLight(x, y, lights)
        )
          continue;
        dots.push({
          x,
          y,
          alpha: 0.2 + Math.max(0, Math.sin(time * 0.7 + i + (h % 7))) * 0.5,
        });
      }
    }
  return dots.slice(0, lightMode ? 6 : 16);
}
