import { sprite } from "../pixel-art.js";

const IDS = new Set([
  "coins",
  "resin",
  "key",
  "salve",
  "relic",
  "rod",
  "bobber",
  "fish",
]);
export function lootItemIcon(id) {
  if(id==="berry")return "./src/assets/plants/berry-icon.png";
  return IDS.has(id) ? `./src/assets/loot-items/icons/${id}.png` : null;
}
export function prependLootIcon(element, id, size = 24) {
  const src = lootItemIcon(id);
  if (!src) return;
  const image = document.createElement("img");
  image.src = src;
  image.alt = "";
  image.width = image.height = size;
  image.className = "loot-item-icon";
  image.dataset.itemIcon = id;
  element.prepend(image);
  return image;
}
export function preloadLootItems(scene) {
  scene.load.json(
    "lootItems.manifest",
    "./src/assets/loot-items/manifest.json",
  );
  scene.load.image("lootItems.source", "./src/assets/loot-items/items.png");
}
export function retainLootItems(scene) {
  const manifest = scene.cache.json.get("lootItems.manifest");
  if (!manifest?.frames || !scene.textures.exists("lootItems.source"))
    throw Error("Approved loot PNGs failed to load");
  scene.registry.set("lootItemPack", {
    manifest,
    image: scene.textures.get("lootItems.source").getSourceImage(),
  });
  scene.textures.remove("lootItems.source");
}
export function applyLootItemFrames(scene, sources) {
  const pack = scene.registry.get("lootItemPack");
  if (!pack) throw Error("Missing approved loot item pack");
  for (const [id, f] of Object.entries(pack.manifest.frames)) {
    const key = ["rod", "bobber", "fish"].includes(id)
      ? `exploration.${id}`
      : `loot.${id}`;
    sources.set(
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
  return { variant: 3, manifest: pack.manifest };
}
