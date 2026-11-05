import { LAYERS } from "./layers.js";
import { OUTPOST } from "../game/outposts.js";

// One reused caption/ground outline per streamed fire, using the existing fire PNG frames.
export class OutpostView {
  constructor(scene) {
    this.scene = scene;
    this.labels = new Map();
    this.ground = scene.add.graphics().setDepth(LAYERS.ground + 18);
  }
  render() {
    const s = this.scene, system = s.core.outposts, g = this.ground.clear(), seen = new Set();
    for (const site of system.sites) {
      if (!s.core.accessible(site) || !s.nearView(site, s.camera.worldView, 280)) continue;
      seen.add(site.id);
      if (!this.labels.has(site.id))
        this.labels.set(site.id, s.text("", site.x, site.y + 40, 11, "#f6dda3", LAYERS.hints));
      const fuel = system.remaining(site.id), label = this.labels.get(site.id);
      label.setText(fuel > 0 ? `Привал · ${Math.ceil(fuel)} с${fuel <= OUTPOST.warningSeconds ? " · мало топлива" : ""}` : "Привал · разжечь за 2 бревна");
      s.worldHints.offer(label, site, { range: 240, priority: fuel <= OUTPOST.warningSeconds ? 80 : 70 });
      if (fuel > 0)
        g.lineStyle(2, fuel <= OUTPOST.warningSeconds ? 0xf0a16c : 0xe0c486, 0.3)
          .strokeCircle(site.x, site.y, OUTPOST.safeRadius);
    }
    for (const [id, label] of this.labels) if (!seen.has(id)) {
      label.destroy(); this.labels.delete(id);
    }
  }
  destroy() {
    for (const label of this.labels.values()) label.destroy();
    this.labels.clear(); this.ground.destroy();
  }
}
