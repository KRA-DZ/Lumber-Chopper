import { CENTER } from "../game/config.js";
import { LAYERS } from "./layers.js";
export class EnemyView {
  constructor(scene) {
    this.scene = scene;
    this.objects = new Map();
    this.starterLight = scene.addImage(
      "survival.startLantern",
      CENTER.x,
      CENTER.y,
    );
    this.signals = scene.add.graphics().setDepth(LAYERS.hints);
  }
  render() {
    const s = this.scene,
      c = s.core,
      d = c.survival,
      g = this.signals.clear();
    if (!d) return;
    this.starterLight.setVisible(c.state.campLevel === 0);
    const actors = [...d.raiders, ...(d.monster ? [d.monster] : [])],
      ids = new Set(actors.map((e) => e.id));
    for (const [id, o] of this.objects)
      if (!ids.has(id)) {
        o.image.destroy();
        o.label.destroy();
        this.objects.delete(id);
      }
    if (c.cycle.isNight) {
      g.lineStyle(2, 0xe6bb70, 0.35).strokeCircle(
        CENTER.x,
        CENTER.y,
        d.safeRadius(),
      );
    }
    for (const e of actors) {
      let o = this.objects.get(e.id);
      if (!o) {
        o = {
          image: s
            .addImage(`survival.${e.kind}0`, e.x, e.y)
            .setInteractive({ pixelPerfect: true })
            .setData("enemy", e.id),
          label: s.text("", e.x, e.y - 210, 11, "#e9c598", LAYERS.hints),
        };
        this.objects.set(e.id, o);
      }
      const visible = s.nearView(e, s.camera.worldView, 250),
        frame = e.moving ? Math.floor(c.elapsed * 5) % 2 : 0;
      s.assets.setFrame(o.image, `survival.${e.kind}${frame}`);
      o.image
        .setPosition(Math.round(e.x / 2) * 2, Math.round(e.y / 2) * 2)
        .setDepth(e.y)
        .setAlpha(e.warning > 0 ? 0.45 : 1)
        .setVisible(visible);
      o.label
        .setPosition(e.x, e.y - (e.invulnerable ? 208 : 110))
        .setText(
          e.invulnerable
            ? e.warning > 0
              ? "Смотритель просыпается…"
              : "СМОТРИТЕЛЬ · НЕУЯЗВИМ"
            : `Налётчик · ${e.hp} HP`,
        )
        .setVisible(visible);
      if (e.windup > 0) {
        const radius = 20 + e.windup * 18;
        g.lineStyle(3, 0xd56f62, 0.9).strokeCircle(e.x, e.y, radius);
      }
    }
    this.scene.player.setAlpha(
      d.hitCooldown > 0 && Math.floor(c.elapsed * 12) % 2 === 0 ? 0.45 : 1,
    );
  }
}
