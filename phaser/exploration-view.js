import { LAYERS } from "./layers.js";
export class ExplorationView {
  constructor(scene) {
    this.scene = scene;
    this.ripples = scene.add.graphics().setDepth(LAYERS.ground + 10);
    this.line = scene.add.graphics();
    this.rod = scene.addImage("exploration.rod", 0, 0).setVisible(false);
    this.bobber = scene
      .addImage("exploration.bobber", 0, 0)
      .setScale(1)
      .setVisible(false);
    const rodFrame = scene.assets.lootItems.manifest.frames.rod;
    this.rodTip = {
      x: rodFrame.tip[0] - rodFrame.anchor[0],
      y: rodFrame.tip[1] - rodFrame.anchor[1],
    };
    this.fish = scene
      .addImage("exploration.fish", 0, 0)
      .setDepth(LAYERS.particles)
      .setVisible(false);
    this.catchTime = -100;
  }
  caught() {
    this.catchTime = this.scene.core.elapsed;
    const p = this.scene.core.player;
    this.fish.setPosition(p.x + 25, p.y - 75);
  }
  render() {
    const c = this.scene.core,
      f = c.exploration.fishing,
      p = c.player,
      t = c.elapsed;
    this.ripples.clear();
    this.line.clear();
    this.rod.setVisible(!!f);
    this.bobber.setVisible(!!f);
    this.scene.axe.setVisible(!f && !this.scene.heroView.bakedTool);
    if (f) {
      const site = c.exploration.get(f.siteId),
        x = site.x - 130,
        y = site.y - 88 + Math.sin(t * 6) * (f.phase === "bite" ? 3 : 1);
      this.rod
        .setPosition(p.x - 16, p.y - 24)
        .setDepth(p.y + 0.1)
        .setRotation(0);
      this.bobber.setPosition(x, y + 4).setDepth(p.y + 0.3);
      this.line
        .setDepth(p.y + 0.2)
        .lineStyle(1, 0xe1d4a4, 0.8)
        .lineBetween(
          this.rod.x + this.rodTip.x * this.rod.scaleX,
          this.rod.y + this.rodTip.y * this.rod.scaleY,
          x,
          y,
        );
      this.ripples
        .lineStyle(2, 0xb4d5bf, 0.6)
        .strokeEllipse(x, y + 6, 18 + ((t * 13) % 24), 7 + ((t * 5) % 10));
    }
    const age = t - this.catchTime;
    this.fish.setVisible(age >= 0 && age < 1);
    if (this.fish.visible)
      this.fish.setPosition(p.x + 25, p.y - 75 - age * 30).setAlpha(1 - age);
  }
}
