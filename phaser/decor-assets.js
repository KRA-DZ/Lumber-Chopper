import { sprite } from "../pixel-art.js";

export function preloadDecor(scene) {
  scene.load.json("decor.manifest", "./src/assets/decor/manifest.json");
  scene.load.image("decor.source", "./src/assets/decor/decor.png");
}
export function retainDecor(scene) {
  const manifest = scene.cache.json.get("decor.manifest");
  if (!manifest?.frames || !scene.textures.exists("decor.source"))
    throw Error("Generated decor PNGs failed to load");
  scene.registry.set("decorPack", {
    manifest,
    image: scene.textures.get("decor.source").getSourceImage(),
  });
  scene.textures.remove("decor.source");
}
export function applyDecorArt(scene, art, worldArt) {
  const pack = scene.registry.get("decorPack");
  if (!pack) return null;
  const cache = new Map();
  const get = (key) => {
    if (!cache.has(key)) {
      const f = pack.manifest.frames[key];
      if (!f) throw Error(`Missing decor frame: ${key}`);
      cache.set(
        key,
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
    }
    return cache.get(key);
  };
  // Existing decoration sites and bases stay fixed; assemble their PNG contents once.
  const place = (p, key, x, y, scale = 1) => {
    const s = get(key);
    p.g.drawImage(
      s.bitmap,
      Math.round(x - s.ax * scale),
      Math.round(y - s.ay * scale),
      Math.round(s.width * scale),
      Math.round(s.height * scale),
    );
  };
  for (const kind of ["rock", "fern", "mushroom", "flowers"])
    art.sprites.details[kind] = [get(`${kind}.0`), get(`${kind}.1`)];
  worldArt.supplies = sprite(48, 33, 24, 29, (p) => {
    place(p, "crate", 15, 29, 0.72);
    place(p, "sack", 28, 29, 0.62);
    place(p, "barrel", 38, 29, 0.62);
  });
  worldArt.tools = sprite(34, 45, 17, 40, (p) => place(p, "lantern", 17, 40));
  const dishes = sprite(38, 28, 19, 22, (p) => {
    place(p, "kettle", 12, 22, 0.85);
    place(p, "mug", 30, 22, 0.9);
  });
  return { variant: 3, manifest: pack.manifest, get, dishes };
}
export function applyDecorFrames(decor, sources) {
  if (!decor) return;
  sources.set("camp.crate", decor.get("crate"));
  sources.set("loot.sack", decor.get("sack"));
  sources.set("camp.mat", decor.get("mat"));
  sources.set("camp.flowers", decor.get("flowerpot"));
  sources.set("camp.dishes", decor.dishes);
}
