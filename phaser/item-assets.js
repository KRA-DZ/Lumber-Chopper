import { sprite } from "../pixel-art.js";
import { AXE_TIERS } from "../economy.js";

export function preloadItems(scene) {
  scene.load.json("items.manifest", "./src/assets/items/manifest.json");
  scene.load.image("items.source", "./src/assets/items/items.png");
}
export function retainItems(scene) {
  const manifest = scene.cache.json.get("items.manifest");
  if (!manifest?.frames || !scene.textures.exists("items.source"))
    throw Error("Generated item PNGs failed to load");
  scene.registry.set("itemPack", {
    manifest,
    image: scene.textures.get("items.source").getSourceImage(),
  });
  scene.textures.remove("items.source");
}
export function applyItemArt(scene, art, worldArt) {
  const pack = scene.registry.get("itemPack");
  if (!pack) return null;
  const get = (key) => {
    const f = pack.manifest.frames[key];
    if (!f) throw Error(`Missing item frame: ${key}`);
    return sprite(f.width, f.height, ...f.anchor, (p) =>
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
    );
  };
  art.sprites.log = get("log");
  if (worldArt) worldArt.firewood = get("pile");
  art.sprites.axes = AXE_TIERS.map((_, i) => {
    const idle = get(`axe.${i}`);
    return [idle, idle, idle];
  });
  art.sprites.axe = art.sprites.axes[0];
  return { variant: 3, manifest: pack.manifest };
}
export function itemShopIcon(id, offer) {
  const name =
    id === "carry"
      ? "wood-bundle"
      : id === "pickup"
        ? "wood-pile"
        : id === "axe"
          ? `axe-${Math.min(offer.level + 1, AXE_TIERS.length - 1)}`
          : null;
  return name ? `./src/assets/items/icons/${name}.png` : null;
}
