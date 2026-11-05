export const CROWN_LIMIT = 8;

// Calculated once while baking the atlas, never in the frame loop.
export function crownCut(pixels, width, height) {
  let bottom = Math.floor(height * 0.48);
  for (let y = bottom; y < height * 0.88; y++) {
    let first = width, last = -1;
    for (let x = 0; x < width; x++)
      if (pixels[(y * width + x) * 4 + 3] >= 128) {
        first = Math.min(first, x);
        last = x;
      }
    if (last - first > width * 0.4) bottom = y + 1;
  }
  return Math.min(height - 1, bottom);
}

export function coversHero(image, cut, player) {
  if (!image.visible || image.depth <= player.y) return false;
  const left = image.x - image.displayOriginX * image.scaleX,
    top = image.y - image.displayOriginY * image.scaleY;
  return player.x + 16 > left + image.displayWidth * 0.1 &&
    player.x - 16 < left + image.displayWidth * 0.9 &&
    player.y - 12 > top && player.y - 80 < top + cut * image.scaleY;
}

// A cropped duplicate is allocated only for a crown that actually covers the hero.
// The base stays opaque and the original trunk collision remains in the model.
export class CrownOcclusion {
  constructor(scene) {
    this.scene = scene;
    this.entries = new Map();
    this.time = scene.core.elapsed;
  }
  begin() {
    const now = this.scene.core.elapsed;
    this.blend = 1 - Math.exp(-18 * Math.min(0.1, Math.max(0, now - this.time)));
    this.time = now;
    for (const entry of this.entries.values()) entry.seen = false;
  }
  apply(image, enabled = true) {
    const meta = this.scene.assets.meta.get(image.frame.name),
      cut = meta?.crownCut,
      covered = enabled && cut && coversHero(image, cut, this.scene.core.player);
    let entry = this.entries.get(image);
    if (!entry && covered && this.entries.size < CROWN_LIMIT) {
      const crown = this.scene.add.image(image.x, image.y, "forest", image.frame.name);
      if (image.input) crown.setInteractive({ pixelPerfect: true });
      for (const key of ["tree", "ancient", "site"])
        if (image.getData(key) !== undefined) crown.setData(key, image.getData(key));
      entry = { crown, alpha: 1, seen: true };
      this.entries.set(image, entry);
    }
    if (!entry) return;
    entry.seen = true;
    if (!cut || !image.visible || !enabled) {
      this.remove(image, entry);
      return;
    }
    entry.alpha += ((covered ? 0.2 : 1) - entry.alpha) * this.blend;
    if (!covered && entry.alpha > 0.99) {
      this.remove(image, entry);
      return;
    }
    image.setAlpha(1).setCrop(0, cut, meta.width, meta.height - cut);
    if (entry.crown.frame !== image.frame) entry.crown.setFrame(image.frame.name);
    entry.crown
      .setOrigin(image.originX, image.originY)
      .setPosition(image.x, image.y).setScale(image.scaleX, image.scaleY)
      .setDepth(image.depth + 0.001).setCrop(0, 0, meta.width, cut)
      .setAlpha(entry.alpha).setVisible(image.visible);
    if (entry.crown.input) entry.crown.input.enabled = image.input.enabled;
  }
  remove(image, entry) {
    if (image.scene && image.frame) image.setCrop();
    entry.crown.destroy();
    this.entries.delete(image);
  }
  end() {
    for (const [image, entry] of this.entries)
      if (!entry.seen || !image.scene) this.remove(image, entry);
  }
  destroy() {
    for (const [image, entry] of this.entries) this.remove(image, entry);
  }
}
