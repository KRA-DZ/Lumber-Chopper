import { sprite } from "../pixel-art.js";

const ROOT = "./src/assets/fortress/";
export function preloadFortress(scene) {
  scene.load.json("fortress.manifest", ROOT + "manifest.json");
  scene.load.image("fortress.source", ROOT + "fortress.png");
  scene.load.image("fortress.floors", ROOT + "floors.png");
}
export function retainFortress(scene) {
  const manifest = scene.cache.json.get("fortress.manifest");
  if (
    !manifest?.frames ||
    !scene.textures.exists("fortress.source") ||
    !scene.textures.exists("fortress.floors")
  )
    throw Error("Fortress PNGs failed to load");
  const image = scene.textures.get("fortress.source").getSourceImage();
  const floorImage = scene.textures.get("fortress.floors").getSourceImage();
  const canvas = document.createElement("canvas");
  canvas.width = floorImage.width;
  canvas.height = floorImage.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(floorImage, 0, 0);
  const floors = Object.fromEntries(
    Object.entries(manifest.floors).map(([key, f]) => [
      key,
      ctx.getImageData(f.x, f.y, 64, 64).data,
    ]),
  );
  scene.registry.set("fortressPack", { manifest, image, floors });
  scene.textures.remove("fortress.source");
  scene.textures.remove("fortress.floors");
}
export function applyFortressFrames(scene, sources) {
  const pack = scene.registry.get("fortressPack");
  if (!pack) return null;
  for (const [key, f] of Object.entries(pack.manifest.frames))
    sources.set(
      `fortress.${key}`,
      sprite(f.width, f.height, ...f.anchor, (p) =>
        p.g.drawImage(
          pack.image,
          f.x,
          f.y,
          f.width,
          f.height,
          0,
          0,
          f.width,
          f.height,
        ),
      ),
    );
  return {
    variant: 4,
    manifest: pack.manifest,
    tokenIcon: ROOT + "token-icon.png",
  };
}

// Only the first large fortress uses this pack; other ruins keep their art.
export function fortressClueKey(assets, clue) {
  if (assets.fortress && clue.regionId === assets.fortress.manifest.regionId)
    return `fortress.${["ruins-note", "fortress-last-watch"].includes(clue.id) ? "diary" : "note"}`;
  return `world.${clue.id === "tracks" ? "strangeTracks" : clue.id === "mark" ? "rune" : "note"}`;
}

export function fortressParts(location) {
  const parts = [],
    nodes = new Map();
  const connect = (p, dir) => {
    const key = `${p.x}:${p.y}`;
    if (!nodes.has(key)) nodes.set(key, { ...p, dirs: new Set() });
    nodes.get(key).dirs.add(dir);
  };
  for (const wall of location.walls) {
    const vertical = wall.a.x === wall.b.x;
    connect(wall.a, vertical ? "s" : "e");
    connect(wall.b, vertical ? "n" : "w");
    if (wall.passage) {
      parts.push({
        id: `${location.id}/${wall.id}/passage`,
        x: (wall.a.x + wall.b.x) / 2,
        y: (wall.a.y + wall.b.y) / 2,
        regionId: location.regionId,
        wall: true,
        passage: wall.passage,
        drawOpened: true,
        key: `fortress.${vertical ? "gate" : "secret"}.closed`,
        openKey: `fortress.${vertical ? "gate" : "secret"}.open`,
        footSpan: vertical ? 64 : 8,
      });
      continue;
    }
    const length = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y);
    const count = Math.ceil(length / 64);
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count;
      parts.push({
        id: `${location.id}/${wall.id}/${i}`,
        regionId: location.regionId,
        x: wall.a.x + (wall.b.x - wall.a.x) * t,
        y: wall.a.y + (wall.b.y - wall.a.y) * t,
        key: `fortress.wall.${vertical ? "v" : "h"}.${i % 4}`,
        wall: true,
        footSpan: vertical ? 24 : 8,
      });
    }
  }
  for (const [id, p] of nodes) {
    const dirs = [...p.dirs];
    let key;
    if (dirs.length === 1) key = `end.${dirs[0]}`;
    else if (
      dirs.length === 2 &&
      !(
        (p.dirs.has("n") && p.dirs.has("s")) ||
        (p.dirs.has("e") && p.dirs.has("w"))
      )
    )
      key = `corner.${p.dirs.has("n") ? "n" : "s"}${p.dirs.has("e") ? "e" : "w"}`;
    if (key)
      parts.push({
        id: `${location.id}/joint/${id}`,
        x: p.x,
        y: p.y,
        regionId: location.regionId,
        key: `fortress.${key}`,
        wall: true,
        footSpan: 8,
      });
  }
  return parts;
}
