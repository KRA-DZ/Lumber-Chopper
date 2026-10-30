import { sprite } from "../pixel-art.js";
export const ENEMY_FAMILIES = [
  "doll",
  "cosmic",
  "wood",
  "drowned",
  "spider",
  "masked",
];
export const ENEMY_POSES = ["idle", "walk", "attack"];
export const MATERIALS = [
  "forest",
  "field",
  "swamp",
  "shore",
  "web",
  "ruins",
  "dirt",
  "water",
];
export const WATCHER_POSES = [
  "idle",
  "walk",
  "notice",
  "windup",
  "strike",
  "repelled",
];
export function preloadBiomeAssets(scene) {
  for (const name of WATCHER_POSES)
    scene.load.image(`watcherpng.${name}`, `./src/assets/watcher/${name}.png`);
  for (const name of MATERIALS.slice(0, 6))
    scene.load.image(
      `biomeprop.${name}`,
      `./src/assets/biome-props/${name}.png`,
    );
  for (const family of ENEMY_FAMILIES)
    for (const pose of ENEMY_POSES)
      scene.load.image(
        `enemy.${family}.${pose}`,
        `./src/assets/enemies/${family}-${pose}.png`,
      );
  for (const name of MATERIALS)
    scene.load.image(`material.${name}`, `./src/assets/biomes/${name}.png`);
}
export function retainBiomeAssets(scene) {
  const enemies = new Map(),
    materials = {};
  for (const name of WATCHER_POSES) {
    const key = `watcherpng.${name}`;
    if (!scene.textures.exists(key))
      throw Error(`Missing generated asset: ${key}`);
    enemies.set(key, scene.textures.get(key).getSourceImage());
  }
  for (const family of ENEMY_FAMILIES)
    for (const pose of ENEMY_POSES) {
      const key = `enemy.${family}.${pose}`;
      if (!scene.textures.exists(key))
        throw Error(`Missing generated asset: ${key}`);
      enemies.set(key, scene.textures.get(key).getSourceImage());
    }
  for (const name of MATERIALS.slice(0, 6)) {
    const key = `biomeprop.${name}`;
    if (!scene.textures.exists(key))
      throw Error(`Missing generated asset: ${key}`);
    enemies.set(key, scene.textures.get(key).getSourceImage());
  }
  for (const name of MATERIALS) {
    const key = `material.${name}`;
    if (!scene.textures.exists(key))
      throw Error(`Missing generated asset: ${key}`);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    canvas
      .getContext("2d")
      .drawImage(scene.textures.get(key).getSourceImage(), 0, 0);
    materials[name] = canvas.getContext("2d").getImageData(0, 0, 64, 64).data;
  }
  scene.registry.set("biomePack", { enemies, materials });
  for (const key of [
    ...enemies.keys(),
    ...MATERIALS.map((n) => `material.${n}`),
  ])
    scene.textures.remove(key);
}
export function biomeEnemyFrames(scene) {
  const pack = scene.registry.get("biomePack"),
    out = {};
  if (!pack) return out;
  for (const [key, image] of pack?.enemies || []) {
    out[key] = key.startsWith("biomeprop.")
      ? sprite(
          image.width,
          image.height,
          Math.floor(image.width / 2),
          image.height - 2,
          (p) => p.g.drawImage(image, 0, 0),
        )
      : key.startsWith("watcherpng.")
        ? sprite(112, 112, 56, 106, (p) => p.g.drawImage(image, 0, 0))
        : sprite(64, 64, 32, 60, (p) => p.g.drawImage(image, 0, 0));
  }
  out["survival.watcher0"] = out["watcherpng.idle"];
  out["survival.watcher1"] = out["watcherpng.walk"];
  for (const pose of ["notice", "windup", "strike", "repelled"])
    out[`survival.watcher.${pose}`] = out[`watcherpng.${pose}`];
  out["survival.watcher.search"] = out["watcherpng.notice"];
  for (const [i, pose] of ["idle", "walk"].entries())
    for (const suffix of ["", ".thief", ".breaker"])
      out[`survival.raider${suffix}${i}`] = out[`enemy.wood.${pose}`];
  out["survival.raider.attack"] = out["enemy.wood.attack"];
  // Pack each bitmap once: aliases refer to the same source and are resolved in the atlas.
  return out;
}
