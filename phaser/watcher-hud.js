import { watcherThreat } from "../game/watcher.js";
export class WatcherHud {
  constructor(scene) {
    this.scene = scene;
    this.arrow = scene.add.graphics().setVisible(false);
    this.label = scene.add
      .text(0, 168, "", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#ead19f",
        backgroundColor: "#3c3436",
        padding: { x: 12, y: 9 },
        align: "center",
      })
      .setOrigin(0.5, 0)
      .setVisible(false);
    this.label
      .setInteractive()
      .on("pointerdown", (p, x, y, event) => event.stopPropagation());
  }
  refresh() {
    const s = this.scene,
      c = s.world.core,
      threat = watcherThreat(c),
      g = this.arrow.clear().setVisible(false);
    this.label.setVisible(!!threat);
    this.bottom = 168;
    if (!threat) return;
    this.label
      .setPosition(s.scale.width / 2, 168)
      .setWordWrapWidth(s.scale.width - 90)
      .setText(threat.text)
      .setColor(threat.color);
    this.bottom = 168 + this.label.height;
    const m = c.survival.monster,
      v = s.world.camera.worldView;
    const x = m.x - v.x,
      y = m.y - v.y;
    if (
      threat.active &&
      (x < 0 || x > s.scale.width || y < 0 || y > s.scale.height)
    ) {
      const px = c.player.x - v.x,
        py = c.player.y - v.y,
        dx = x - px,
        dy = y - py;
      const top = this.bottom + 16,
        bottom = s.scale.height - s.tutorial.height - 72;
      const candidates = [
        dx > 0
          ? (s.scale.width - 28 - px) / dx
          : dx < 0
            ? (28 - px) / dx
            : Infinity,
        dy > 0 ? (bottom - py) / dy : dy < 0 ? (top - py) / dy : Infinity,
      ];
      const k = Math.max(0, Math.min(...candidates)),
        cx = Math.max(28, Math.min(s.scale.width - 28, px + dx * k)),
        cy = Math.max(top, Math.min(bottom, py + dy * k)),
        a = Math.atan2(dy, dx);
      const pt = (angle, r) => ({
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
      });
      const tip = pt(a, 11),
        l = pt(a + 2.4, 9),
        r = pt(a - 2.4, 9);
      g.setVisible(true)
        .fillStyle(threat.phase === "windup" ? 0xe99b80 : 0xd2b378)
        .fillTriangle(tip.x, tip.y, l.x, l.y, r.x, r.y);
    }
  }
}
