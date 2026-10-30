import { sprite } from "../pixel-art.js";

export function preloadTrees(scene) {
  scene.load.json("trees.manifest", "./src/assets/trees/manifest.json");
  scene.load.image("trees.source", "./src/assets/trees/trees.png");
}

export function retainTrees(scene) {
  const manifest = scene.cache.json.get("trees.manifest");
  if (!manifest?.frames || !scene.textures.exists("trees.source"))
    throw Error("Generated tree assets failed to load");
  scene.registry.set("treePack", {
    manifest,
    image: scene.textures.get("trees.source").getSourceImage(),
  });
  scene.textures.remove("trees.source");
}

// Replaces art before wind frames and pixel-perfect hit areas are prepared.
export function applyTreeArt(scene, art) {
  const pack = scene.registry.get("treePack");
  if (!pack) return art;
  const get = (key, scale = 1) => {
    const f = pack.manifest.frames[key];
    if (!f) throw Error(`Missing tree frame: ${key}`);
    const width = Math.round(f.width * scale),
      height = Math.round(f.height * scale);
    return sprite(
      width,
      height,
      ...f.anchor.map((n) => Math.round(n * scale)),
      (p) =>
        p.g.drawImage(
          pack.image,
          f.x,
          f.y,
          f.width,
          f.height,
          0,
          0,
          width,
          height,
        ),
    );
  };
  const s = art.sprites;
  s.growth = {};
  for (const type of ["oak", "spruce", "birch", "dead"]) {
    const mature = get(`${type}.mature`);
    s.trees[type] = [mature, mature, get(`${type}.mature`, 1.14)];
    s.growth[type] = Object.fromEntries(
      ["stump", "sprout", "young"].map((stage) => [
        stage,
        get(`${type}.${stage}`),
      ]),
    );
  }
  s.ancient = get("ancient");
  art.generatedTrees = true;
  return art;
}
