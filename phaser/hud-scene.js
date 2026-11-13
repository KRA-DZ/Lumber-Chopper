import { BIOMES } from "../game/biomes.js";
import { WatcherHud } from "./watcher-hud.js";
import { DayHud } from "./day-hud.js";
import { RepairControl } from "./repair-control.js";
import { DAY_SECONDS } from "../game/config.js";
import { clockHour } from "../game/cycle.js";
import { regionAt } from "../game/regions.js";
import { hasCampBuilding } from "../game/camp-projects.js";
import { MATERIAL_NAMES } from "../game/camp-industry-config.js";
import { countdown } from "../game/first-days.js";
import { dockInset } from "./viewport.js";
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
    this.tutorial
      .setInteractive()
      .on("pointerdown", (p, x, y, event) => event.stopPropagation());
    this.doneAt = null;
    this.guideWidth = null;
    this.storyGuide = false;
    this.dayHud = new DayHud(this);
    this.watcherHud = new WatcherHud(this);
    this.guideButton = this.add
      .text(0, 0, "", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#2c3c2d",
        backgroundColor: "#d9b66d",
        padding: { x: 12, y: 8 },
      })
      .setOrigin(0.5, 1)
      .setInteractive({ useHandCursor: true });
    this.guideButton.on("pointerdown", (pointer, x, y, event) => {
      event.stopPropagation();
      const c = this.world.core;
      if (c.paused) return;
      const fishing = c.exploration?.fishing;
      if (fishing) {
        if (fishing.phase === "bite") c.exploration.reel();
        else c.exploration.cancelFishing();
        return;
      }
      if(this.contextGuide){if(c.contextHints.activate(this.contextGuide)==='bag')this.world.explorationUi.openBag();return;}
      if (this.storyGuide) {
        c.navigateStory();
        return;
      }
      const action = c.guide.action;
      if (action === "shop") this.world.shop.open();
      else if (action === "journal") this.world.survivalUi.open();
      else if (action === "map") this.world.regionMap.open();
      else c.navigateGuide(action);
    });
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
    this.repairControl = new RepairControl(this);
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
      hour = Math.floor(clockHour(c.state.worldTime))
        .toString()
        .padStart(2, "0"),
      minute = Math.floor((clockHour(c.state.worldTime) * 60) % 60)
        .toString()
        .padStart(2, "0");
    g.clear()
      .fillStyle(0x243c2d, 0.95)
      .fillRect(14, 12, this.scale.width < 600 ? 265 : 330, 150)
      .fillRect(left - 4, top - 4, size + 8, size + 8);
    const order=c.orders.current,orderProgress=order?.resource==="logs"?c.orders.data.active.logs.length:order?Math.min(order.amount,c.state.campIndustry.materials[order.resource]):0,
      location=order?`Заказ ${orderProgress}/${order.amount} ${MATERIAL_NAMES[order.resource]} · ${countdown(c.orders.secondsLeft)}`:
        `${c.player.room ? "Дом лагеря" : regionAt(c.player.x,c.player.y)?.name||"Лес"} · Камень ${c.state.stone}`;
    this.clock.setText(
      `День ${c.dayNumber + 1} · ${c.state.nightsSurvived} ночей · ${hour}:${minute}\n${this.world.atmosphere.weather.profile.name} · ${hasCampBuilding(c.state,"fire") ? `Огонь ${Math.ceil(c.state.campFuel)} с` : "Нет костра"}\n${location}\n${c.coop ? `Игрок ${c.activeActor + 1} · ` : ""}♥ ${c.state.health}/${c.state.maxHealth} · База ${c.state.campHealth}/${c.state.maxCampHealth}`,
    );
    const adjacent = new Set(c.regions.frontiers().map((g) => g.region.id));
    for (const r of c.regions.all) {
      const open = c.regions.unlocked.has(r.id),
        x = left + (r.x - b.x) * scale,
        y = top + (r.y - b.y) * scale,
        w = r.width * scale;
      g.fillStyle(
        open ? BIOMES[r.biome].color : adjacent.has(r.id) ? 0x425d4c : 0x263f35,
      ).fillRect(x, y, w - 1, w - 1);
      if (open) g.lineStyle(1, 0xe1d099, 0.8).strokeRect(x, y, w - 1, w - 1);
      else if (adjacent.has(r.id))
        g.fillStyle(0xc6bd89).fillRect(x + w / 2 - 1, y + w / 2 - 1, 3, 3);
    }
    if (this.world.coopCamera?.split) {
      const camera = this.world.coopCamera.second;
      g.lineStyle(2, 0xe2c17e, .8).lineBetween(camera.x, camera.y,
        camera.x || this.scale.width, camera.y || this.scale.height);
    }
    for (const v of this.world.coopCamera?.views() || [this.world.camera.worldView]) {
    g.lineStyle(1, 0xf0ecc0, 0.6).strokeRect(
      left + (v.x - b.x) * scale,
      top + (v.y - b.y) * scale,
      v.width * scale,
      v.height * scale,
    );
    }
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
    if (c.coop) for (const [i, actor] of c.actors.entries())
      g.fillStyle(i ? 0x9bdae4 : 0xf4ce83).fillRect(
        left + (actor.player.x - b.x) * scale - 1,
        top + (actor.player.y - b.y) * scale - 1, 3, 3);
    this.dayHud.refresh();
    const fishing = c.exploration?.fishing;
    this.contextGuide=!fishing?c.contextHints?.current:null;
    const quietPreparation=!fishing&&c.contextHints?.preparing&&!this.contextGuide;
    this.storyGuide =
      !fishing &&
      !this.contextGuide && !quietPreparation &&
      c.guide.id === "free" &&
      !!c.story &&
      !c.story.overview().completed &&
      c.story.overview().phase > 0;
    const storyGoal = this.storyGuide ? c.story.overview() : null;
    const guide = fishing
      ? {
          title:
            fishing.phase === "bite"
              ? `Клюёт! · ${Math.max(0, fishing.timer).toFixed(1)} с`
              : `Рыбалка · поклёвка через ${Math.ceil(fishing.timer)} с`,
          text:
            fishing.phase === "bite"
              ? "Нажмите «Подсечь», E или пробел. Время продолжает идти."
              : "Ждите движения поплавка. Ходьба или ночь прервут ловлю.",
          button:
            fishing.phase === "bite"
              ? "Подсечь! · E / пробел"
              : "Убрать снасти",
          action: "fishing",
        }
      : this.contextGuide || (quietPreparation?{title:'',text:'',action:null}:null) || (storyGoal
        ? {
            title: storyGoal.chapter,
            text: `${storyGoal.title}. ${storyGoal.text}`,
            button: "К цели главы",
            action: "story",
          }
        : c.guide);
    if (this.guideWidth !== this.scale.width) {
      this.guideWidth = this.scale.width;
      this.tutorial
        .setFontSize(this.scale.width < 600 ? 14 : 12)
        .setWordWrapWidth(this.scale.width - 64);
      this.guideButton.setFontSize(this.scale.width < 600 ? 14 : 12);
    }
    this.tutorial
      .setPosition(this.scale.width / 2, this.scale.height - dockInset(this) - 12)
      .setText(`${c.coop ? "1: WASD / E · 2: стрелки / Enter · помощь: удерживать E / Enter\n" : ""}${guide.title}\n${guide.text}`)
      .setVisible(!quietPreparation);
    this.guideButton
      .setText(guide.button || "")
      .setPosition(
        this.scale.width / 2,
        this.tutorial.y - this.tutorial.height - 8,
      )
      .setVisible(!!guide.action && !c.state.gameOver);
    this.watcherHud.refresh();
    this.repairControl.refresh();
    const messageY = this.dayHud.warning.visible
      ? this.dayHud.warning.y + this.dayHud.warning.height + 12
      : this.watcherHud.label.visible
        ? this.watcherHud.bottom + 12
        : 168;
    this.banner.setPosition(this.scale.width / 2, messageY);
    this.discovery
      .setVisible(
        c.elapsed < this.world.atmosphere.discoveryUntil &&
          !this.banner.visible &&
          !this.world.expansionBanner &&
          !this.dayHud.warning.visible,
      )
      .setPosition(this.scale.width / 2, messageY)
      .setText(this.world.atmosphere.discovery);
    if(this.world.dayBanner){const day=this.world.dayBanner.day;this.world.dayBanner=null;
      this.banner.setText(`ДЕНЬ ${day}\nПережито ночей: ${c.state.nightsSurvived}`).setVisible(true).setAlpha(1);
      this.tweens.killTweensOf(this.banner);this.tweens.add({targets:this.banner,alpha:0,delay:1800,duration:800,onComplete:()=>this.banner.setVisible(false)});
    }
    if (this.world.expansionBanner) {
      const e = this.world.expansionBanner;
      this.world.expansionBanner = null;
      this.banner
        .setPosition(this.scale.width / 2, messageY)
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
