import { regionAt, REGION_SIZE } from "./regions.js";
import { CENTER } from "./config.js";
import { transitionNoise } from "./biomes.js";
const origin = CENTER.x - REGION_SIZE / 2,
  BAND = 150;
function axis(value, other) {
  const warped = value + transitionNoise(value, other),
    cell = Math.floor((warped - origin) / REGION_SIZE),
    offset = warped - origin - cell * REGION_SIZE;
  if (offset < BAND)
    return [
      [cell - 1, (BAND - offset) / (2 * BAND)],
      [cell, 1 - (BAND - offset) / (2 * BAND)],
    ];
  if (offset > REGION_SIZE - BAND)
    return [
      [cell, 1 - (offset - REGION_SIZE + BAND) / (2 * BAND)],
      [cell + 1, (offset - REGION_SIZE + BAND) / (2 * BAND)],
    ];
  return [[cell, 1]];
}
export function biomeWeights(x, y) {
  const weights = {};
  for (const [gx, wx] of axis(x, y))
    for (const [gy, wy] of axis(y, x)) {
      const biome =
        regionAt(
          origin + (gx + 0.5) * REGION_SIZE,
          origin + (gy + 0.5) * REGION_SIZE,
        )?.biome || "forest";
      weights[biome] = (weights[biome] || 0) + wx * wy;
    }
  return weights;
}
export function sampleMaterial(materials, name, x, y) {
  const data = materials[name] || materials.forest,
    i = ((((y % 64) + 64) % 64) * 64 + (((x % 64) + 64) % 64)) * 4;
  return [data[i], data[i + 1], data[i + 2]];
}
