import { regionAt, REGION_SIZE } from "./regions.js";
import { CENTER } from "./config.js";
import { transitionNoise } from "./biomes.js";
import { pixelHash } from "../pixel-art.js";
const origin = CENTER.x - REGION_SIZE / 2,
  BAND = 210;
const smooth = (t) => t * t * (3 - 2 * t);
function axis(value, other) {
  const warped = value + transitionNoise(value, other),
    cell = Math.floor((warped - origin) / REGION_SIZE),
    offset = warped - origin - cell * REGION_SIZE;
  if (offset < BAND)
    return [
      [cell - 1, smooth((BAND - offset) / (2 * BAND))],
      [cell, 1 - smooth((BAND - offset) / (2 * BAND))],
    ];
  if (offset > REGION_SIZE - BAND)
    return [
      [cell, 1 - smooth((offset - REGION_SIZE + BAND) / (2 * BAND))],
      [cell + 1, smooth((offset - REGION_SIZE + BAND) / (2 * BAND))],
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

// World coordinates make the damp, irregular fringe identical across cached chunks.
// Preserve PNG colour clusters rather than averaging the entire forest/swamp edge.
export function sampleBiomeGround(materials, x, y) {
  const weights = biomeWeights(x * 2, y * 2), entries = Object.entries(weights);
  let rgb = [0, 0, 0];
  if (weights.forest && weights.swamp) {
    const pairWeight = weights.forest + weights.swamp;
    const patch = (pixelHash(Math.floor(x / 7), Math.floor(y / 7)) % 256) / 256,
      grain = (pixelHash(x, y) % 256) / 256,
      threshold = patch * 0.8 + grain * 0.2;
    const pair = sampleMaterial(materials, weights.swamp / pairWeight > threshold ? "swamp" : "forest", x, y);
    if (pairWeight === 1) return pair;
    rgb = pair.map(channel => channel * pairWeight);
  }
  for (const [name, weight] of entries) {
    if (weights.forest && weights.swamp && (name === "forest" || name === "swamp")) continue;
    const sample = sampleMaterial(materials, name, x, y);
    for (let i = 0; i < 3; i++) rgb[i] += sample[i] * weight;
  }
  return rgb;
}
