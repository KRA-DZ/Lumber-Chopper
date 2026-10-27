export const FEEDBACK_LIMITS = Object.freeze({ piles: 8, impacts: 4 });
const snap = (v) => Math.round(v / 2) * 2;
// Two reused Graphics + one reused text. No object per tree or glow shader.
export class ChoppingFeedback {
  constructor(scene) {
    this.scene = scene;
    this.target = null;
    this.impacts = [];
    this.highlightCount = 0;
    this.ground = scene.add.graphics().setDepth(-3500);
    this.badge = scene.add.graphics().setDepth(5004);
    this.label = scene.text("", 0, 0, 11, "#f8e5b3", 5005).setVisible(false);
    this.barVisible = false;
  }
  hit(tree) {
    this.target = tree;
    this.lastHit = this.scene.core.elapsed;
  }
  fell(tree) {
    if (this.impacts.length === FEEDBACK_LIMITS.impacts) this.impacts.shift();
    this.impacts.push({ x: tree.x, y: tree.y, time: this.scene.core.elapsed });
  }
  render() {
    const { scene } = this,
      c = scene.core,
      p = c.player,
      t = c.elapsed,
      light = scene.effectsLight;
    const g = this.ground.clear(),
      badge = this.badge.clear(),
      tree = this.target;
    this.barVisible = !!(
      tree &&
      tree.hp > 0 &&
      t - this.lastHit < 1.8 &&
      Math.hypot(tree.x - p.x, tree.y - p.y) < 135 &&
      c.treeAccessible(tree)
    );
    this.label.setVisible(this.barVisible);
    if (this.barVisible) {
      const x = snap(tree.x - 28),
        // Keep the badge off the hero's face when chopping from the north.
        y = snap(p.y < tree.y - 24 ? tree.y + 40 : tree.y - 96),
        ratio = tree.hp / tree.maxHp;
      badge
        .fillStyle(0x273d35, 0.95)
        .fillRect(x - 2, y - 2, 60, 12)
        .fillStyle(0x5a6144)
        .fillRect(x, y, 56, 8);
      badge
        .fillStyle(t - this.lastHit < 0.12 ? 0xffe4a2 : 0xc4b86c)
        .fillRect(x, y, Math.max(2, snap(56 * ratio)), 8);
      this.label
        .setPosition(tree.x, y - 12)
        .setText(`${tree.hp} / ${tree.maxHp}`);
    }
    this.highlightCount = 0;
    if (c.state.wood < c.state.maxWood)
      for (const pile of c.forestry.piles.values()) {
        if (this.highlightCount >= (light ? 3 : FEEDBACK_LIMITS.piles)) break;
        const distance = Math.hypot(pile.x - p.x, pile.y - p.y);
        if (
          distance > c.state.pickupRadius + 52 ||
          !scene.nearView(pile, scene.camera.worldView, 30)
        )
          continue;
        this.highlightCount++;
        const reach = distance <= c.state.pickupRadius,
          alpha = reach ? 0.65 + Math.sin(t * 4) * 0.12 : 0.3,
          x = snap(pile.x),
          y = snap(pile.y);
        // Pixel corner brackets, beneath the logs, indicate pickup reach.
        g.fillStyle(reach ? 0xf1d697 : 0xacc8a1, alpha);
        for (const side of [-1, 1]) {
          g.fillRect(x + side * 42 - (side < 0 ? 0 : 8), y - 10, 8, 2).fillRect(
            x + side * 42,
            y - 10,
            2,
            12,
          );
          g.fillRect(x + side * 42 - (side < 0 ? 0 : 8), y + 18, 8, 2).fillRect(
            x + side * 42,
            y + 10,
            2,
            10,
          );
        }
      }
    for (let i = this.impacts.length - 1; i >= 0; i--) {
      const e = this.impacts[i],
        age = t - e.time;
      if (age > 0.45) {
        this.impacts.splice(i, 1);
        continue;
      }
      if (!scene.nearView(e, scene.camera.worldView, 100)) continue;
      const width = snap(16 + age * 70),
        height = snap(5 + age * 20),
        alpha = (1 - age / 0.45) * 0.65;
      const motes = light ? 4 : 8;
      g.fillStyle(0xdac391, alpha);
      for (let n = 0; n < motes; n++) {
        const angle = (n / motes) * Math.PI * 2;
        g.fillRect(
          snap(e.x + Math.cos(angle) * width),
          snap(e.y + Math.sin(angle) * height),
          4,
          2,
        );
      }
      if (!light)
        for (const side of [-1, 1])
          badge
            .fillStyle(0xf6dfa6, alpha)
            .fillRect(
              snap(e.x + side * (10 + age * 65)),
              snap(e.y - 16 - age * 32),
              6,
              2,
            );
    }
  }
}
