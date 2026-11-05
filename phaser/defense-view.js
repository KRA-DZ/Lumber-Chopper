import { LAYERS } from "./layers.js";
// A fixed, small set of sites. Redraw on model changes, never create objects per frame.
export class DefenseView {
  constructor(scene) {
    this.scene = scene;
    this.objects = [];
    this.key = "";
    this.feedback = scene.add.graphics().setDepth(LAYERS.hints);
  }
  render() {
    const s = this.scene,
      c = s.core;
    const key = `${c.state.campLevel}:${c.state.buildWood}:${c.defenses?.revision}`;
    if (key !== this.key) {
      this.key = key;
      for (const o of this.objects) {
        o.g.destroy();
        o.zone.destroy();
        o.label?.destroy();
      }
      this.objects = [];
      for (const d of c.defenses?.all() || []) {
        const generated = s.assets.camp && d.kind !== "fence";
        const g = generated
          ? s.addImage(
              `camp.defense.${d.kind}.${d.hp > 0 ? "ready" : "broken"}`,
              d.x,
              d.y,
              d.y + 2,
            )
          : s.add.graphics().setDepth(d.y + 2);
        if (generated) {
          if (!d.hp && !Object.hasOwn(c.state.defenseHP, d.id))
            g.setAlpha(0.35 + 0.15 * d.wood);
        } else if (d.kind === "barricade") {
          if (d.hp > 0) {
            for (const x of [-26, 0, 26])
              g.fillStyle(0x483626)
                .fillRect(d.x + x - 6, d.y - 40, 12, 43)
                .fillStyle(0xbd8d56)
                .fillRect(d.x + x - 3, d.y - 38, 4, 37);
            g.lineStyle(8, 0x775032)
              .lineBetween(d.x - 33, d.y - 30, d.x + 33, d.y - 13)
              .lineStyle(3, 0xd0ab68)
              .lineBetween(d.x - 33, d.y - 32, d.x + 33, d.y - 15);
          } else
            g.lineStyle(2, 0xd7b67d, 0.6).strokeRect(
              d.x - 36,
              d.y - 12,
              72,
              24,
            );
        } else if (d.kind === "trap") {
          g.lineStyle(
            d.hp ? 4 : 2,
            d.hp ? 0xadbdaf : 0xc0a577,
            d.hp ? 1 : 0.5,
          ).strokeRect(d.x - 18, d.y - 10, 36, 20);
          for (let i = -12; i <= 12; i += 8)
            g.lineBetween(d.x + i, d.y - 10, d.x + i + 4, d.y + 10);
          if (d.hp) g.fillStyle(0xe5cd9a).fillRect(d.x - 4, d.y - 4, 8, 8);
        } else if (d.hp < d.maxHP) {
          if (!d.hp) {
            g.lineStyle(2, 0xe4ad71, 0.7).strokeEllipse(d.x, d.y, 46, 20);
          } else {
            // Cracks overlay the existing PNG; severe damage adds a second split.
            for (const dx of d.hp <= d.maxHP / 2 ? [-10, 10] : [0]) {
              g.lineStyle(3, 0x392b22, 0.95)
                .lineBetween(d.x + dx, d.y - 29, d.x + dx - 5, d.y - 18)
                .lineBetween(d.x + dx - 5, d.y - 18, d.x + dx + 3, d.y - 9);
            }
          }
        }
        const zone = s.add
          .zone(d.x, d.y - 15, d.kind === "barricade" ? 78 : 42, 46)
          .setDepth(d.y + 3)
          .setInteractive()
          .setData("defense", d.id);
        const text =
          d.kind === "fence"
            ? `${d.hp ? "Повреждено" : "ПРОЛОМ"} · ${d.hp}/${d.maxHP}`
            : `${d.name}\n${d.hp ? (d.kind === "trap" ? "Взведена · 1 заряд" : `${d.hp}/${d.maxHP} HP`) : `${d.wood}/${d.cost} брёвен`}`;
        // Intact fence labels are never visible; don't allocate their canvas textures.
        const label =
          d.kind !== "fence" || d.hp < d.maxHP
            ? s.text(text, d.x, d.y + 18, 11, "#e4c994", LAYERS.hints)
            : null;
        this.objects.push({ d, g, zone, label });
      }
    }
    const bars = this.feedback.clear();
    for (const { d, label } of this.objects) {
      if (!label) continue;
      const selected = c.defenseOrder === d.id || c.defenseRepair?.id === d.id;
      label.setVisible(
        (selected || Math.hypot(c.player.x - d.x, c.player.y - d.y) < 135) &&
          (d.kind !== "fence" || d.hp < d.maxHP),
      );
      const color = selected ? "#ffedaa" : "#e4c994";
      if (label.style.color !== color) label.setColor(color);
      if (label.visible && d.kind !== "trap" && d.hp < d.maxHP) {
        bars
          .fillStyle(0x292c24, 0.95)
          .fillRect(d.x - 25, d.y + 29, 50, 6)
          .fillStyle(d.hp <= d.maxHP / 2 ? 0xde9264 : 0xd9c282)
          .fillRect(d.x - 24, d.y + 30, (48 * d.hp) / d.maxHP, 4);
      }
      s.worldHints.offer(label, d, {
        eligible: label.visible,
        range: selected ? Infinity : 135,
        priority: selected ? 85 : 60,
      });
    }
  }
}
