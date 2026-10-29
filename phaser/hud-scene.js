import { DAY_SECONDS } from "../game/config.js";
import { regionAt } from "../game/regions.js";
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
      fontSize: "12px",
      color: "#f2e3af",
    });
    this.banner = this.add
      .text(0, 100, "", {
        fontFamily: "monospace",
        fontSize: "15px",
        color: "#ffe2a0",
        backgroundColor: "#263e2b",
        padding: { x: 14, y: 12 },
        align: "center",
      })
      .setOrigin(0.5, 0)
      .setVisible(false);
    this.discovery = this.add
      .text(0, 100, "", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#f4db9c",
        backgroundColor: "#263e2b",
        padding: { x: 10, y: 7 },
      })
      .setOrigin(0.5, 0)
      .setVisible(false);
    this.tutorial = this.add
      .text(0, 0, "", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#eddfad",
        backgroundColor: "#263e2b",
        padding: { x: 12, y: 9 },
        align: "center",
      })
      .setOrigin(0.5, 1);
    this.doneAt = null;
    this.mapZone = this.add.zone(0, 0, 144, 144).setOrigin(0).setInteractive();
    this.mapZone.on("pointerdown", (pointer, x, y, event) => {
      event.stopPropagation();
      const c = this.world.core;
      if (c.paused) return;
      const left = this.scale.width - this.size - 16,
        b = c.regions.bounds;
      const wx = b.x + ((pointer.x - left) / this.size) * b.width,
        wy = b.y + ((pointer.y - 16) / this.size) * b.height,
        r = regionAt(wx, wy);
      if (!r) return;
      if (c.regions.unlocked.has(r.id)) c.setDestination(wx, wy);
      else {
        const gate = c.regions
          .frontiers()
          .filter((g) => g.region.id === r.id)
          .sort(
            (a, b) =>
              Math.hypot(a.x - c.player.x, a.y - c.player.y) -
              Math.hypot(b.x - c.player.x, b.y - c.player.y),
          )[0];
        if (gate) c.setDestination(gate.x, gate.y);
        else
          this.world.float(
            "Сначала откройте соседний участок",
            c.player.x,
            c.player.y - 100,
          );
      }
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
      b = c.regions.bounds,
      scale = size / b.width,
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
      .fillStyle(0x243c2d, 0.95)
      .fillRect(14, 12, this.scale.width < 600 ? 265 : 330, 76)
      .fillRect(left - 4, top - 4, size + 8, size + 8);
    this.clock.setText(
      `День ${c.dayNumber + 1} · ${hour}:${minute}\n${this.world.atmosphere.weather.profile.name} · Лагерь ${c.state.campLevel}/4\n${regionAt(c.player.x, c.player.y)?.name || "Лес"}\n♥ ${c.state.health}/${c.state.maxHealth} · База ${c.state.campHealth}/${c.state.maxCampHealth}`,
    );
    const adjacent = new Set(c.regions.frontiers().map((g) => g.region.id));
    for (const r of c.regions.all) {
      const open = c.regions.unlocked.has(r.id),
        x = left + (r.x - b.x) * scale,
        y = top + (r.y - b.y) * scale,
        w = r.width * scale;
      g.fillStyle(
        open
          ? r.activity === "mystery"
            ? 0x696778
            : r.activity === "pond"
              ? 0x568b86
              : 0x6d9459
          : adjacent.has(r.id)
            ? 0x425d4c
            : 0x263f35,
      ).fillRect(x, y, w - 1, w - 1);
      if (open) g.lineStyle(1, 0xe1d099, 0.8).strokeRect(x, y, w - 1, w - 1);
      else if (adjacent.has(r.id))
        g.fillStyle(0xc6bd89).fillRect(x + w / 2 - 1, y + w / 2 - 1, 3, 3);
    }
    const v = this.world.camera.worldView;
    g.lineStyle(1, 0xf0ecc0, 0.6).strokeRect(
      left + (v.x - b.x) * scale,
      top + (v.y - b.y) * scale,
      v.width * scale,
      v.height * scale,
    );
    g.fillStyle(0xf3c866).fillRect(
      left + (1600 - b.x) * scale - 2,
      top + (1600 - b.y) * scale - 2,
      4,
      4,
    );
    g.fillStyle(0xffffff).fillRect(
      left + (c.player.x - b.x) * scale - 1,
      top + (c.player.y - b.y) * scale - 1,
      3,
      3,
    );
    const step = c.tutorialStep;
    if (step === 3 && this.doneAt === null) this.doneAt = c.elapsed;
    const hints = [
      "1/3 · Срубите дерево: подойдите к стволу.",
      "2/3 · Продайте брёвна на золотой площадке.",
      "3/3 · Откройте лавку и улучшите переноску.",
      "Отлично! Стройте лагерь или открывайте соседние регионы.",
    ];
    const night = c.cycle.isNight;
    const nightHint = night
      ? `Ночь ${c.dayNumber + 1} · ${c.survival?.raiders.length ? `Налётчики: ${c.survival.raiders.length}. Топор — защита лагеря.` : "Смотритель неуязвим. Держитесь света лагеря."}`
      : null;
    this.tutorial
      .setWordWrapWidth(this.scale.width - 64)
      .setPosition(this.scale.width / 2, this.scale.height - 12)
      .setText(nightHint || hints[step])
      .setVisible(night || step < 3 || c.elapsed - this.doneAt < 6);
    this.discovery
      .setVisible(
        c.elapsed < this.world.atmosphere.discoveryUntil &&
          !this.banner.visible &&
          !this.world.expansionBanner,
      )
      .setPosition(this.scale.width / 2, this.scale.width < 600 ? 135 : 100)
      .setText(this.world.atmosphere.discovery);
    if (this.world.expansionBanner) {
      const e = this.world.expansionBanner;
      this.world.expansionBanner = null;
      this.banner
        .setPosition(this.scale.width / 2, this.scale.width < 600 ? 155 : 100)
        .setText(`Открыта новая территория\n${e.name}`)
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
