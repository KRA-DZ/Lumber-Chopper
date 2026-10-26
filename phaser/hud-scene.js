import { RADII, DAY_SECONDS } from "../game/config.js";
export class HudScene extends Phaser.Scene {
  constructor() {
    super("Hud");
  }
  init(data) {
    this.world = data.world;
  }
  create() {
    this.panel = this.add.graphics();
    this.clock = this.add.text(22, 18, "", {
      fontFamily: "monospace",
      fontSize: "13px",
      color: "#f2e3af",
    });
    this.banner = this.add
      .text(0, 100, "", {
        fontFamily: "monospace",
        fontSize: "17px",
        color: "#ffe2a0",
        backgroundColor: "#263e2b",
        padding: { x: 16, y: 14 },
        align: "center",
      })
      .setOrigin(0.5, 0)
      .setVisible(false);
    this.mapZone = this.add.zone(0, 0, 144, 144).setOrigin(0).setInteractive();
    this.mapZone.on("pointerdown", (pointer, x, y, event) => {
      event.stopPropagation();
      if (this.world.core.paused) return;
      const size = this.size,
        left = this.scale.width - size - 16;
      this.world.core.setDestination(
        ((pointer.x - left) / size) * 3200,
        ((pointer.y - 16) / size) * 3200,
      );
    });
    this.world.hudReady = true;
    this.lastRefresh = -Infinity;
    this.refresh();
  }
  update(time) {
    if (time - this.lastRefresh > 100) {
      this.lastRefresh = time;
      this.refresh();
    }
  }
  refresh() {
    if (!this.panel) return;
    const c = this.world.core,
      size = this.scale.width < 600 ? 100 : 144,
      left = this.scale.width - size - 16,
      top = 16,
      scale = size / 3200,
      r = c.forestRadius(),
      g = this.panel;
    this.size = size;
    this.mapZone.setPosition(left, top).setSize(size, size);
    this.mapZone.input.hitArea.setSize(size, size);
    const phase = c.state.worldTime / DAY_SECONDS,
      hour = Math.floor((phase * 24 + 6) % 24)
        .toString()
        .padStart(2, "0"),
      minute = Math.floor((phase * 1440) % 60)
        .toString()
        .padStart(2, "0");
    g.clear()
      .fillStyle(0x243c2d, 0.93)
      .fillRect(14, 12, 230, 56)
      .fillRect(left - 4, top - 4, size + 8, size + 8);
    this.clock.setText(
      `День ${c.dayNumber + 1} · ${hour}:${minute}\nЛагерь ${c.state.campLevel}/4`,
    );
    g.fillStyle(0x68a34e).fillCircle(
      left + size / 2,
      top + size / 2,
      r * scale,
    );
    for (let i = 0; i < RADII.length; i++)
      g.lineStyle(
        i === c.state.campLevel ? 2 : 1,
        i === c.state.campLevel ? 0xf3dc93 : 0x6d8975,
        i === c.state.campLevel ? 1 : 0.4,
      ).strokeCircle(left + size / 2, top + size / 2, RADII[i] * scale);
    g.fillStyle(0x275d38);
    for (const t of c.trees)
      if (t.hp > 0 && c.treeAccessible(t))
        g.fillRect(left + t.x * scale, top + t.y * scale, 1, 1);
    const v = this.world.camera.worldView;
    g.lineStyle(1, 0xf0ecc0, 0.6).strokeRect(
      left + v.x * scale,
      top + v.y * scale,
      v.width * scale,
      v.height * scale,
    );
    g.fillStyle(0xf3c866).fillCircle(
      left + 1600 * scale,
      top + 1600 * scale,
      3,
    );
    g.fillStyle(0xffffff).fillRect(
      left + c.player.x * scale - 2,
      top + c.player.y * scale - 2,
      4,
      4,
    );
    if (this.world.expansionBanner) {
      const e = this.world.expansionBanner;
      this.world.expansionBanner = null;
      this.banner
        .setPosition(this.scale.width / 2, this.scale.width < 600 ? 155 : 100)
        .setText(`Открыта новая территория\n${e.from} → ${e.to}`)
        .setVisible(true)
        .setAlpha(1);
      this.tweens.killTweensOf(this.banner);
      this.tweens.add({
        targets: this.banner,
        alpha: 0,
        delay: 3500,
        duration: 800,
        onComplete: () => this.banner.setVisible(false),
      });
    }
  }
}
