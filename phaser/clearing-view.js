import { LAYERS } from "./layers.js";

// Stream the two terrain piles; physics stays in the engine-independent model.
export class ClearingView {
  constructor(scene) {
    this.scene = scene;
    this.objects = new Map();
    this.labels = new Map();
  }
  sync(view) {
    const s = this.scene,
      c = s.core,
      wanted = new Set(),
      labels = new Set();
    for (const d of c.clearing.all) {
      if (!c.clearing.available(d) || !s.nearView(d, view, 180)) continue;
      wanted.add(d.id);
      if (!this.objects.has(d.id)) {
        const images = s.assets.sawmill
          ? [
              s
                .addImage(
                  `sawmill.debris.${d.maxHP > 6 ? "heavy" : "light"}`,
                  d.x,
                  d.y,
                  d.y + 80,
                )
                .setInteractive({ pixelPerfect: true })
                .setData("debris", d.id),
            ]
          : [-56, 0, 56].map((dy, i) =>
              s
                .addImage("log", d.x, d.y + dy)
                .setOrigin(0.5)
                .setDisplaySize(88, 32)
                .setRotation(Math.PI / 2 + (i - 1) * 0.12)
                .setInteractive()
                .setData("debris", d.id),
            );
        if (!s.assets.sawmill && d.maxHP > 6)
          images.push(
            s
              .addImage("log", d.x, d.y)
              .setOrigin(0.5)
              .setDisplaySize(106, 36)
              .setRotation(0.35)
              .setInteractive()
              .setData("debris", d.id),
          );
        const label = s.text("", d.x, d.y - 112, 12, "#ffe4ae", LAYERS.hints);
        // Floating hints may cover nearby props; only the actual beams accept taps.
        this.objects.set(d.id, { images, label });
      }
      const { label } = this.objects.get(d.id);
      label.setText(
        `${d.name} · ${c.clearing.hp(d)}/${d.maxHP}\nНажмите / E: расчистить топором`,
      );
      label.setVisible(
        c.clearingOrder === d.id ||
          Math.hypot(c.player.x - d.x, c.player.y - d.y) < 190,
      );
    }
    for (const [id, entry] of this.objects)
      if (!wanted.has(id)) {
        entry.images.forEach((image) => image.destroy());
        entry.label.destroy();
        this.objects.delete(id);
      }
    for (const location of c.world.locations.filter((l) => l.debris?.length)) {
      if (!c.regions.unlocked.has(location.regionId)) continue;
      for (const [i, room] of location.rooms.entries()) {
        const p = { x: room.x + room.width / 2, y: room.y + room.height - 48 };
        if (!s.nearView(p, view, 80)) continue;
        const id = `${location.id}/${i}`;
        labels.add(id);
        if (!this.labels.has(id))
          this.labels.set(id, s.text(room.name, p.x, p.y, 13, "#ecd5a4"));
      }
    }
    for (const [id, label] of this.labels)
      if (!labels.has(id)) {
        label.destroy();
        this.labels.delete(id);
      }
  }
}
