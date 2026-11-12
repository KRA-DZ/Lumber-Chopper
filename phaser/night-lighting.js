import { hasCampBuilding } from "../game/camp-projects.js";
import { NIGHT_START } from "../game/cycle.js";
import { CENTER } from "../game/config.js";
import { CAMP, pixelHash } from "../pixel-art.js";
import { playerLights,lightContains } from "../game/light-shapes.js";

// A trace of ambient light preserves silhouettes outside the lantern without turning night into dusk.
export function nightOpacity(state) {
  if (state.worldTime >= NIGHT_START) return .95;
  const t = Math.max(0, Math.min(1, (state.worldTime - (NIGHT_START - 12)) / 12));
  return .95*t * t * (3 - 2 * t);
}
export function campLights(state, safeRadius) {
  if (!hasCampBuilding(state,"fire") || state.campFuel <= 0) return [];
  return [
    { x: CENTER.x, y: CENTER.y, r: safeRadius + 120 },
    { x: CAMP.stall.x + 80, y: CAMP.stall.y - 80, r: 90 },
    ...(hasCampBuilding(state,"house")
      ? [
          { x: CAMP.hut.x - 68, y: CAMP.hut.y - 68, r: 100 },
          { x: CAMP.hut.x + 78, y: CAMP.hut.y - 68, r: 85 },
        ]
      : []),
  ];
}
export function nightLights(state, player, safeRadius, outposts = []) {
  return [
    ...playerLights(state,player),
    ...campLights(state, safeRadius),
    ...outposts,
  ];
}
export function inCampLight(x, y, lights) {
  return lights.some((l) => lightContains(l,x,y));
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
