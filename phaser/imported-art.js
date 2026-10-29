import { sprite } from "../pixel-art.js";

export const IMPORTED_ASSETS = [
  "tent",
  "shop",
  "merchant",
  "spruce",
  "birch",
  "campfire",
];

// The PNGs are kept at export resolution in src/assets. Rasterize them once into
// the same native pixel grid/atlas as the existing game, never on every frame.
export function applyImportedArt(scene, art) {
  const pack = scene.registry.get("importedPack");
  if (!pack) return art;
  function fit(name, size, dimension = "width", scale = 1) {
    const info = pack.manifest.assets[name],
      image = pack.images[name];
    const factor =
      (size / (dimension === "width" ? info.width : info.height)) * scale;
    const width = Math.round(info.width * factor),
      height = Math.round(info.height * factor);
    return sprite(
      width,
      height,
      Math.round(width * info.anchor.x),
      Math.round(height * info.anchor.y),
      (p) => p.g.drawImage(image, 0, 0, width, height),
    );
  }
  const s = art.sprites;
  s.tent = fit("tent", 112);
  const t = s.tent;
  s.tentFrame = sprite(t.width, t.height, t.ax, t.ay, (p) => {
    const top = { x: t.width * 0.59, y: 4 },
      left = { x: t.width * 0.23, y: t.height * 0.18 };
    p.line(top.x, top.y, t.ax, t.ay, "#6c5638", 3);
    p.line(left.x, left.y, t.width * 0.15, t.height * 0.77, "#9f7b49", 3);
    p.line(left.x, left.y, top.x, top.y, "#d8b677", 2);
    for (const [x, y] of [
      [3, t.height * 0.75],
      [t.width * 0.95, t.height * 0.84],
      [t.width * 0.68, t.height - 3],
    ])
      p.line(top.x, top.y, x, y, "#a08c64");
  });
  // This house belongs to the mysterious merchant. The player's own hut remains
  // a distinct building with its existing staged construction and warm windows.
  s.merchantTent = fit("shop", 112);
  s.merchant = fit("merchant", 44, "height");
  const merchant = s.merchant;
  art.merchantPose = () => merchant; // one supplied pose; directional gestures need another sheet
  for (const type of ["spruce", "birch"])
    s.trees[type] = [0, 1, 2].map((i) =>
      fit(type, type === "spruce" ? 178 : 168, "height", i === 2 ? 1.14 : 1),
    );
  const pit = fit("campfire", 40),
    oldFlames = s.fire;
  const base = (p) => p.g.drawImage(pit.bitmap, 20 - pit.ax, 38 - pit.ay);
  s.unlitFire = sprite(40, 44, 20, 38, base);
  s.fire = [0, 1, 2].map((i) =>
    sprite(40, 44, 20, 38, (p) => {
      base(p);
      // Only the flame portion of the original animation, not its old stone ring.
      p.g.drawImage(oldFlames[i].bitmap, 8, 0, 25, 26, 8, 0, 25, 26);
    }),
  );
  art.style = "generated-camp-png";
  art.importedSource = pack.manifest.source.sha256;
  return art;
}
