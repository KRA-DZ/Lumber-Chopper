import { createForestGround } from "./art/ground-art.js";
export class TerrainLayer {
  constructor(scene, model) {
    this.scene = scene;
    this.source = createForestGround({
      ...model,
      center: { x: 1600, y: 1600 },
      clearings: model.landmarks,
    });
    this.images = new Map();
  }
  update(view) {
    const wanted = new Set();
    for (
      let y = Math.floor(view.y / 256);
      y <= Math.floor((view.y + view.height) / 256);
      y++
    )
      for (
        let x = Math.floor(view.x / 256);
        x <= Math.floor((view.x + view.width) / 256);
        x++
      ) {
        const key = `terrain/${x}/${y}`;
        wanted.add(key);
        if (this.images.has(key)) continue;
        const texture = this.scene.textures.addCanvas(
          key,
          this.source.getChunk(x, y),
        );
        texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
        this.images.set(
          key,
          this.scene.add
            .image(x * 256, y * 256, key)
            .setOrigin(0)
            .setScale(2)
            .setDepth(-10000),
        );
      }
    for (const [key, image] of this.images)
      if (!wanted.has(key)) {
        image.destroy();
        this.scene.textures.remove(key);
        this.images.delete(key);
      }
  }
  destroy() {
    for (const [key, image] of this.images) {
      image.destroy();
      this.scene.textures.remove(key);
    }
    this.images.clear();
  }
}
