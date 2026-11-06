import { dayOverview, countdown } from "../game/first-days.js";
import { CAMP_SERVICE } from "../game/camp-services.js";
import { hasCampBuilding } from "../game/camp-projects.js";
export class DayHud {
  constructor(scene) {
    this.scene = scene;
    this.track = scene.add.graphics();
    this.fuelTrack = scene.add.graphics();
    this.infoZone = scene.add
      .zone(14, 12, 330, 134)
      .setOrigin(0)
      .setInteractive();
    this.infoZone.on("pointerdown", (p, x, y, event) =>
      event.stopPropagation(),
    );
    this.phase = scene.add.text(22, 91, "", {
      fontFamily: "monospace",
      fontSize: "11px",
      color: "#efdb9e",
    });
    this.raid = scene.add.text(22, 124, "", {
      fontFamily: "monospace",
      fontSize: "11px",
      color: "#cbd4ad",
    });
    this.warning = scene.add
      .text(0, 168, "", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#ffe3b0",
        backgroundColor: "#633f31",
        padding: { x: 12, y: 9 },
        align: "center",
      })
      .setOrigin(0.5, 0)
      .setVisible(false);
  }
  refresh() {
    const s = this.scene,
      c = s.world.core,
      time = dayOverview(c.state),
      width = s.scale.width < 600 ? 249 : 314;
    const mobile = s.scale.width < 600;
    if (this.mobile !== mobile) {
      this.mobile = mobile;
      this.phase.setFontSize(mobile ? 13 : 11);
      this.raid.setFontSize(mobile ? 12 : 11);
    }
    this.infoZone.setSize(width + 16, 134);
    this.infoZone.input.hitArea.setSize(width + 16, 134);
    this.phase
      .setText(
        `${time.period} · ${time.night ? "до рассвета" : "до ночи"} ${countdown(time.boundarySeconds)}`,
      )
      .setColor(
        time.sunsetUrgent ? "#ffc0a0" : time.sunsetSoon ? "#f4c77d" : "#efdb9e",
      );
    const x = 22,
      y = 110,
      g = this.track.clear();
    this.fuelRatio = hasCampBuilding(c.state,"fire") ? Math.max(0,Math.min(1,c.state.campFuel/CAMP_SERVICE.maxFuel)) : 0;
    this.fuelTrack.clear().fillStyle(0x242f28,.95).fillRect(x,80,width,6)
      .fillStyle(c.state.campFuel <= 30 ? 0xc2694c : 0xe6ad56).fillRect(x,80,width*this.fuelRatio,6)
      .lineStyle(1,0x998465,.7).strokeRect(x,80,width,6);
    for (const [from, to, color] of [[0,.15,0xd6a176],[.15,.6,0x9a8756],[.6,.75,0xb56c53],[.75,1,0x293e53]])
      g.fillStyle(color).fillRect(x + width * from, y, width * (to - from), 8);
    for (let i = 0; i <= 4; i++)
      g.lineStyle(1, 0xe0c88c, 0.35).lineBetween(
        x + (width * i) / 4,
        y,
        x + (width * i) / 4,
        y + 8,
      );
    g.fillStyle(time.night ? 0xb8d5df : 0xffe5a2).fillRect(
      Math.round(x + time.phase * width) - 2,
      y - 2,
      4,
      12,
    );
    const text = time.raidActive
      ? c.survival?.pending
        ? "Налёт начинается · ночь " + time.day
        : c.survival?.raiders.length
          ? `Налёт · осталось врагов: ${c.survival.raiders.length}`
          : c.survival?.wave?.status === "won"
            ? `Налёт отражён · +${c.survival.wave.reward} монет`
            : c.survival?.wave?.status === "escaped"
              ? `Налёт завершён · +${c.survival.wave.reward} монет`
              : "Налётчики отступили"
      : time.raidTonight
        ? `Налёт сегодня · через ${countdown(time.raidSeconds)}`
        : `Налёт · ночь ${time.nextRaid} · через ${countdown(time.raidSeconds)}`;
    this.raid.setText(text).setColor(time.raidTonight ? "#f1b595" : "#cbd4ad");
    const warn = c.sunsetWarning;
    const preparation = !time.night && time.raidTonight && time.sunsetSoon;
    this.warning
      .setPosition(s.scale.width / 2, 168)
      .setWordWrapWidth(s.scale.width - 80)
      .setVisible(!!warn || preparation);
    if (preparation)
      this.warning.setText(
        `Налёт через ${countdown(time.boundarySeconds)}\nПочините ограду, возьмите брёвна.\nМетатели бросают через забор — двигайтесь!`,
      );
    else if (warn?.morning)
      this.warning.setText(
        "Сегодня налёт с заката!\nПодготовьте ограду, топор и брёвна.\nМетатели достают через забор.",
      );
    else if (warn)
      this.warning.setText(
        `${warn.raid ? "Скоро налёт!" : "Скоро ночь!"} До темноты ${countdown(time.boundarySeconds)}\nВернитесь к свету лагеря.`,
      );
  }
}
