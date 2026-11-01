import { sprite } from "../pixel-art.js";
import { fencePlan } from "../construction.js";
import { CENTER } from "../game/config.js";

export function preloadCamp(scene) {
  scene.load.json("camp.manifest", "./src/assets/camp/manifest.json");
  scene.load.image("camp.source", "./src/assets/camp/camp.png");
}
export function retainCamp(scene) {
  const manifest = scene.cache.json.get("camp.manifest");
  if (!manifest?.frames || !scene.textures.exists("camp.source"))
    throw Error("Generated camp PNGs failed to load");
  scene.registry.set("campPack", {
    manifest,
    image: scene.textures.get("camp.source").getSourceImage(),
  });
  scene.textures.remove("camp.source");
}
export const campDamageState = (hp, maxHP) =>
  hp <= 0 ? "broken" : hp < maxHP ? "damaged" : "ready";

export function applyCampArt(scene, art) {
  const pack = scene.registry.get("campPack");
  if (!pack) return art;
  const cache = new Map();
  const get = (key) => {
    if (!cache.has(key)) {
      const f = pack.manifest.frames[key];
      if (!f) throw Error(`Missing camp frame: ${key}`);
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
  const s = art.sprites;
  s.tent = get("tent.ready");
  s.house = get("hut.ready");
  s.tentFrame = get("tent.early");
  s.houseFrame = get("hut.early");
  s.campStates = Object.fromEntries(
    ["tent", "hut"].map((kind) => [
      kind,
      Object.fromEntries(
        ["early", "late", "damaged"].map((state) => [
          state,
          get(`${kind}.${state}`),
        ]),
      ),
    ]),
  );
  s.unlitFire = get("fire.cold");
  s.fire = [0, 1, 2].map((i) => get(`fire.${i}`));
  s.stall = get("stall");
  s.cart = get("cart");
  s.fence = get("post.ready");
  art.generatedCamp = { get, manifest: pack.manifest };
  return art;
}

// Project generated plank columns along the existing curved fence without
// rotating upright heights. Baked once; no per-frame image manipulation.
function railImage(rail, a, b) {
  const dx = (b.x - a.x) / 2,
    dy = (b.y - a.y) / 2;
  const left = Math.floor(Math.min(0, dx)) - 2,
    top = Math.floor(Math.min(0, dy)) - rail.ay - 2;
  const width = Math.ceil(Math.abs(dx)) + 5,
    height = Math.ceil(Math.abs(dy)) + rail.height + 4;
  return sprite(width, height, -left, -top, (p) => {
    const count = Math.max(2, Math.ceil(Math.hypot(dx, dy)) * 2);
    for (let i = 0; i <= count; i++) {
      const t = i / count,
        column = Math.min(rail.width - 1, Math.floor(t * rail.width));
      p.g.drawImage(
        rail.bitmap,
        column,
        0,
        1,
        rail.height,
        Math.round(dx * t) - left,
        Math.round(dy * t) - top - rail.ay,
        1,
        rail.height,
      );
    }
  });
}

export function applyCampFrames(art, sources) {
  const pack = art.generatedCamp;
  if (!pack) return null;
  for (const key of ["salePad", "buildPad"])
    sources.set(`camp.${key}`, pack.get(key));
  for (const key of ["saleSign", "buildSign"])
    sources.set(`camp.${key}`, pack.get("sign"));
  sources.set("workers.depot", pack.get("depot"));
  sources.set("camp.post.broken", pack.get("post.broken"));
  for (const kind of ["barricade", "trap"])
    for (const state of ["ready", "broken"])
      sources.set(
        `camp.defense.${kind}.${state}`,
        pack.get(`${kind}.${state}`),
      );
  for (const [a, b] of fencePlan(CENTER).segments)
    for (const state of ["ready", "damaged", "broken"])
      sources.set(
        `camp.rail.${a.id}.${state}`,
        railImage(pack.get(`rail.${state}`), a, b),
      );
  return { variant: 4, manifest: pack.manifest };
}
