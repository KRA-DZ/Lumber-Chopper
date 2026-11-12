import { pixelHash, random } from "../pixel-art.js";

export const BIOME_DETAIL_LIMIT = 12;
const families = {
  forest: ["fern", "flowers", "mushroom"],
  swamp: ["swampRoots", "swampFungi"],
};
export function biomeDressing(region, paths, canPlace) {
  const kinds = families[region.biome];
  if (!kinds) return [];
  const rng = random(pixelHash(region.gx + 71, region.gy - 53)), result = [];
  for (let attempt = 0; attempt < 90 && result.length < BIOME_DETAIL_LIMIT; attempt++) {
    const path = paths[attempt % paths.length], i = 1 + Math.floor(rng() * (path.length - 1)),
      a = path[i - 1], b = path[i], t = 0.15 + rng() * 0.7,
      dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy),
      side = (attempt % 4 < 2 ? 1 : -1) * (100 + rng() * 45),
      x = Math.round(a.x + dx * t - dy / length * side),
      y = Math.round(a.y + dy * t + dx / length * side);
    if (x < region.x + 48 || x > region.x + region.width - 48 ||
        y < region.y + 48 || y > region.y + region.height - 48 ||
        !canPlace(x, y) || result.some(p => Math.hypot(p.x - x, p.y - y) < 130)) continue;
    const kind = kinds[result.length % kinds.length];
    result.push({ kind, x, y, regionId: region.id, natural:region.biome==="forest",variant:result.length%2,ground:false });
  }
  return result;
}
