import { sprite } from "../pixel-art.js";
import { fortressParts } from "./fortress-assets.js";

const ROOT = "./src/assets/sawmill/";
export function preloadSawmill(scene) {
  scene.load.json("sawmill.manifest", ROOT + "manifest.json");
  scene.load.image("sawmill.source", ROOT + "sawmill.png");
  scene.load.image("sawmill.floors", ROOT + "floors.png");
}
export function retainSawmill(scene) {
  const manifest = scene.cache.json.get("sawmill.manifest");
  if (
    !manifest?.frames ||
    !scene.textures.exists("sawmill.source") ||
    !scene.textures.exists("sawmill.floors")
  )
    throw Error("Sawmill PNGs failed to load");
  const image = scene.textures.get("sawmill.source").getSourceImage();
  const floorImage = scene.textures.get("sawmill.floors").getSourceImage();
  const canvas = document.createElement("canvas");
  canvas.width = floorImage.width;
  canvas.height = floorImage.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(floorImage, 0, 0);
  const floors = Object.fromEntries(
    Object.entries(manifest.floors).map(([key, f]) => [
      key,
      ctx.getImageData(f.x, f.y, f.width, f.height).data,
    ]),
  );
  scene.registry.set("sawmillPack", { manifest, image, floors });
  scene.textures.remove("sawmill.source");
  scene.textures.remove("sawmill.floors");
}
export function applySawmillFrames(scene, sources) {
  const pack = scene.registry.get("sawmillPack");
  if (!pack) return null;
  for (const [key, f] of Object.entries(pack.manifest.frames))
    sources.set(
      `sawmill.${key}`,
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
    variant: 1,
    manifest: pack.manifest,
    tagIcon: ROOT + "tag-icon.png",
  };
}
export function sawmillClueKey(assets, clue) {
  return assets.sawmill && assets.sawmill.manifest.regionId === clue.regionId
    ? `sawmill.${clue.id === "sawmill-ledger" ? "ledger" : "note"}`
    : null;
}
const siteKeys = {
  "sawmill-unshipped-load": "load",
  "sawmill-empty-crate": "crate",
  "sawmill-hand-drive": "drive.closed",
  "sawmill-shift-tag": "niche.open",
};
export const sawmillSiteKey = (site) => `sawmill.${siteKeys[site.id]}`;
export function sawmillDressingKey(p) {
  return p.id.startsWith("wood-stack-")
    ? "sawmill.woodRack"
    : p.id === "work-bench"
      ? "sawmill.bench"
      : "sawmill.crate";
}
// Reuse the proven modular geometry, not the fortress textures or its physics.
export function sawmillParts(location) {
  const parts = fortressParts(location).map((p) => ({
    ...p,
    key: p.key.replace("fortress.", "sawmill."),
  }));
  for (const room of location.rooms.filter((r) => r.name !== "Двор"))
    parts.push({
      id: `${location.id}/roof/${room.name}`,
      regionId: location.regionId,
      key: `sawmill.roof.${room.name === "Склад древесины" ? "store" : "hall"}`,
      x: room.x + room.width / 2,
      y: room.y + 156,
      depth: room.y + 220,
      roofCover: {
        x: room.x - 24,
        y: room.y - 48,
        width: room.width + 48,
        height: 340,
      },
    });
  const tag = location.sites.find((s) => s.id === "sawmill-shift-tag");
  for (const [state, extra] of [
    ["closed", { untilPassage: tag.requiredPassage }],
    ["empty", { requiredPassage: tag.requiredPassage, afterDiscovery: tag.id }],
  ])
    parts.push({
      id: `${location.id}/niche-${state}`,
      regionId: location.regionId,
      x: tag.x,
      y: tag.y,
      key: `sawmill.niche.${state}`,
      ...extra,
    });
  const x = location.entrance.x,
    y = location.entrance.y - 608;
  for (const [id, key, dx, dy] of [
    ["wheel-tracks", "tracks", -32, 96],
    ["tool-board", "tools", 528, 128],
    ["old-cloth", "cloth", 96, -448],
  ])
    parts.push({
      id: `${location.id}/${id}`,
      regionId: location.regionId,
      key: `sawmill.${key}`,
      x: x + dx,
      y: y + dy,
    });
  return parts;
}
