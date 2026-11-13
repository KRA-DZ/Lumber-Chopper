import { watcherThreat } from "../game/watcher.js";
export class WatcherHud {
  constructor(scene) {
    this.scene = scene;
    this.arrow = scene.add.graphics().setVisible(false);
    this.label = scene.add
      .text(0, 168, "", {
        fontFamily: "Arial, sans-serif",
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
      target = c.coop ? c.actors[c.survival.monster?.targetPlayerId ?? c.activeActor] : c,
      threat = watcherThreat(target),
      g = this.arrow.clear().setVisible(false);
    this.label.setVisible(!!threat);
    this.bottom = 168;
    if (!threat) return;
    this.label
      .setPosition(s.scale.width / 2, 168)
      .setWordWrapWidth(s.scale.width - 90)
      .setText(`${c.coop ? `Игрок ${target.player.id + 1}: ` : ""}${threat.text}`)
      .setColor(threat.color);
    this.bottom = 168 + this.label.height;
    const m = c.survival.monster,
      camera = s.world.coopCamera?.split && target.player.id === 1 ? s.world.coopCamera.second : s.world.camera,
      v = camera.worldView;
    const x = m.x - v.x + camera.x,
      y = m.y - v.y + camera.y;
    if (
      threat.active &&
      (x < camera.x || x > camera.x + camera.width || y < camera.y || y > camera.y + camera.height)
    ) {
      const px = target.player.x - v.x + camera.x,
        py = target.player.y - v.y + camera.y,
        dx = x - px,
        dy = y - py;
      const top = Math.max(camera.y + 28, this.bottom + 16),
        bottom = Math.min(camera.y + camera.height - 28, s.scale.height - s.tutorial.height - 72);
      const candidates = [
        dx > 0
          ? (camera.x + camera.width - 28 - px) / dx
          : dx < 0
            ? (camera.x + 28 - px) / dx
            : Infinity,
        dy > 0 ? (bottom - py) / dy : dy < 0 ? (top - py) / dy : Infinity,
      ];
      const k = Math.max(0, Math.min(...candidates)),
        cx = Math.max(camera.x + 28, Math.min(camera.x + camera.width - 28, px + dx * k)),
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
