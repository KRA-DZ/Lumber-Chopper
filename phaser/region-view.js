import { LAYERS } from "./layers.js";
import { REGION_SIZE } from "../game/regions.js";

// Stream only nearby decoration and trees. Locked tiles remain geometry + names.
export class RegionView {
  constructor(scene) {
    this.scene = scene;
    this.objects = new Map();
    this.gates = new Map();
    this.lastRevision = -1;
    this.border = scene.add.graphics().setDepth(LAYERS.border);
    this.banner = null;
  }
  createDecor(region) {
    const w = this.scene.core.world,
      result = [];
    const image = (key, x, y, depth = y) => {
      const a = this.scene.addImage(key, x, y, depth);
      result.push(a);
      return a;
    };
    for (const p of w.decorBins.get(region.id) || [])
      image(`details.${p.type}.${p.variant}`, p.x, p.y).setData("plant", p);
    for (const p of w.landmarks.filter((p) => p.regionId === region.id)) {
      if (p.type === "chest") {
        image("camp.chest", p.x, p.y)
          .setInteractive({ pixelPerfect: true })
          .setData("site", p.id)
          .setData("chest", p.id);
        result.push(
          this.scene
            .text("Запечатан", p.x, p.y + 30, 11, "#d3cda8")
            .setData("chestLabel", p.id),
        );
      } else if (p.type === "ruins") {
        const g = this.scene.add.graphics().setDepth(p.y);
        result.push(g);
        for (let col = 0; col < 7; col++)
          for (let row = 0; row < (col === 3 ? 1 : col % 2 ? 4 : 3); row++)
            g.fillStyle(0x4d5e50)
              .fillRect(
                p.x - 88 + col * 27 + (row % 2) * 3,
                p.y - row * 22 - 18,
                25,
                20,
              )
              .fillStyle(0x929d7d)
              .fillRect(
                p.x - 86 + col * 27 + (row % 2) * 3,
                p.y - row * 22 - 16,
                20,
                13,
              );
        for (let n = 0; n < 7; n++) {
          const x = p.x - 86 + n * 27;
          g.fillStyle(0x607b4c).fillRect(x, p.y - 3, 15, 3);
          g.lineStyle(2, 0xb4b79a).lineBetween(
            x,
            p.y - 55 - (n % 2) * 22,
            x + 17,
            p.y - 55 - (n % 2) * 22,
          );
          g.lineStyle(2, 0x61715c)
            .lineBetween(x + 9, p.y - 40, x + 13, p.y - 35)
            .lineBetween(x + 13, p.y - 35, x + 10, p.y - 29);
        }
      } else
        image(
          p.type === "arch"
            ? "world.arch"
            : p.type === "wagon"
              ? "cart"
              : p.type === "camp"
                ? "oldTent"
                : "world.log",
          p.x,
          p.y,
        );
    }
    if (region.activity === "pond") {
      const p = w.pond,
        g = this.scene.add.graphics().setDepth(-3900);
      result.push(g);
      for (let i = 0; i < 8; i++)
        g.fillStyle(i % 2 ? 0x997447 : 0xb18b55).fillRect(
          p.x + 120 + i * 14,
          p.y + 110,
          12,
          80,
        );
      image("camp.gateSign", p.x + 265, p.y + 175)
        .setInteractive({ pixelPerfect: true })
        .setData("site", "fishing");
      result.push(
        this.scene.text("Тихие воды · рыбалка", p.x, p.y + 235, 12, "#dce2ba"),
      );
    }
    return result;
  }
  sync(view) {
    const c = this.scene.core,
      regions = c.regions,
      margin = 360,
      wanted = new Set();
    for (const r of regions.all)
      if (
        regions.unlocked.has(r.id) &&
        r.x < view.right + margin &&
        r.x + r.width > view.x - margin &&
        r.y < view.bottom + margin &&
        r.y + r.height > view.y - margin
      ) {
        wanted.add(r.id);
        if (!this.objects.has(r.id))
          this.objects.set(r.id, this.createDecor(r));
      }
    for (const [id, list] of this.objects)
      if (!wanted.has(id)) {
        list.forEach((o) => o.destroy());
        this.objects.delete(id);
      }
    if (this.lastRevision !== regions.revision) {
      this.lastRevision = regions.revision;
      for (const a of this.gates.values())
        a.objects.forEach((o) => o.destroy());
      this.gates.clear();
    }
    // Stream border signs too. Keep a wider release margin to avoid edge flicker.
    const wantedGates = new Set();
    for (const gate of regions.frontiers()) {
      if (!this.scene.nearView(gate, view, this.gates.has(gate.id) ? 520 : 360))
        continue;
      wantedGates.add(gate.id);
      if (!this.gates.has(gate.id)) {
        const pad = this.scene.addImage(
          "camp.gatePad",
          gate.x,
          gate.y,
          LAYERS.ground,
        );
        const sign = this.scene
          .addImage("camp.gateSign", gate.x, gate.y - 18)
          .setInteractive({ pixelPerfect: true })
          .setData("regionGate", gate);
        const title = this.scene.text(
          gate.region.name,
          gate.x,
          gate.y - 115,
          13,
          "#eed5a0",
          LAYERS.hints,
        );
        const label = this.scene.text(
          "",
          gate.x,
          gate.y + 42,
          12,
          "#f2dfb0",
          LAYERS.hints,
        );
        this.gates.set(gate.id, {
          gate,
          label,
          objects: [pad, sign, title, label],
        });
      }
    }
    for (const [id, entry] of this.gates)
      if (!wantedGates.has(id)) {
        entry.objects.forEach((o) => o.destroy());
        this.gates.delete(id);
      }
    for (const { gate, label, objects } of this.gates.values()) {
      const near = this.scene.nearView(gate, view, 240);
      objects.forEach((o) => o.setVisible(near));
      label.setText(
        `Открыть · ${c.state.regionWood[gate.region.id] || 0}/${gate.region.cost} брёвен`,
      );
    }
    for (const list of this.objects.values())
      for (const image of list) {
        const chest = image.getData("chest"),
          label = image.getData("chestLabel");
        if (chest) {
          const key = this.scene.core.state.exploration.openedChests.includes(
            chest,
          )
            ? "exploration.chestOpen"
            : "camp.chest";
          if (image.frame.name !== key) this.scene.assets.setFrame(image, key);
        }
        if (label)
          image.setText(
            this.scene.core.state.exploration.openedChests.includes(label)
              ? "Пусто"
              : "Нужен ключ",
          );
        const p = image.getData("plant");
        if (!p || p.type === "rock" || !this.scene.nearView(p, view, 90))
          continue;
        const phase = this.scene.effectsLight
          ? 0
          : [0, 1, 0, -1][Math.floor(c.elapsed * 1.1 + p.x) % 4];
        const key = phase
          ? `plant.${p.type}.${p.variant}.${phase}`
          : `details.${p.type}.${p.variant}`;
        if (image.frame.name !== key) this.scene.assets.setFrame(image, key);
      }
    const b = this.border.clear();
    // Only cells intersecting the camera emit triangles/lines, never the full 9600² map.
    for (const r of regions.all) {
      if (
        r.x > view.right ||
        r.x + r.width < view.x ||
        r.y > view.bottom ||
        r.y + r.height < view.y
      )
        continue;
      if (!regions.unlocked.has(r.id))
        b.fillStyle(0x142c2b, 0.97).fillRect(r.x, r.y, r.width, r.height);
    }
    for (const r of regions.all)
      if (
        regions.unlocked.has(r.id) &&
        r.x < view.right + 4 &&
        r.x + r.width > view.x - 4 &&
        r.y < view.bottom + 4 &&
        r.y + r.height > view.y - 4
      ) {
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ])
          if (!regions.unlocked.has(`${r.gx + dx}:${r.gy + dy}`)) {
            const x = r.cx + (dx * REGION_SIZE) / 2,
              y = r.cy + (dy * REGION_SIZE) / 2;
            if (dx)
              b.lineStyle(4, 0xb2b586, 0.8).lineBetween(
                x,
                r.y,
                x,
                r.y + r.height,
              );
            else
              b.lineStyle(4, 0xb2b586, 0.8).lineBetween(
                r.x,
                y,
                r.x + r.width,
                y,
              );
          }
      }
    if (this.banner && c.elapsed - this.banner.time < 8) {
      const r = this.banner.region,
        alpha = Math.max(0, 1 - (c.elapsed - this.banner.time) / 8);
      b.lineStyle(6, 0xf8dc8d, alpha).strokeRect(
        r.x + 3,
        r.y + 3,
        r.width - 6,
        r.height - 6,
      );
    }
  }
  opened(region) {
    this.banner = { region, time: this.scene.core.elapsed };
    this.lastRevision = -1;
  }
}
