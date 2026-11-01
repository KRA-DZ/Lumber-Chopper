import { passageOpen } from "../game/locations.js";

// Playable layout preview with existing PNGs. Stream short wall pieces around
// the camera; collision uses whole data segments, never these decorative images.
export class LocationView {
  constructor(scene) {
    this.scene = scene;
    this.objects = new Map();
    this.parts = [];
    for (const location of scene.core.world.locations || []) {
      for (const wall of location.walls) {
        const count = Math.ceil(
          Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y) / 48,
        );
        for (let i = 0; i <= count; i++)
          this.parts.push({
            id: `${location.id}/${wall.id}/${i}`,
            regionId: location.regionId,
            x: wall.a.x + ((wall.b.x - wall.a.x) * i) / count,
            y: wall.a.y + ((wall.b.y - wall.a.y) * i) / count,
            passage: wall.passage,
            key: "biomeprop.ruins",
            wall: true,
          });
      }
      for (const site of location.sites)
        this.parts.push({ ...site, key: "world.rune", site: site.id });
      this.parts.push({
        id: `${location.id}/sign`,
        ...location.entrance,
        x: location.entrance.x - 120,
        regionId: location.regionId,
        key: "camp.gateSign",
      });
    }
  }
  sync(view) {
    const s = this.scene,
      wanted = new Set();
    for (const p of this.parts) {
      if (
        !s.core.regions.unlocked.has(p.regionId) ||
        (p.passage && passageOpen(s.core.state, p.passage)) ||
        !s.nearView(p, view, 100)
      )
        continue;
      wanted.add(p.id);
      if (!this.objects.has(p.id)) {
        const image = s.addImage(p.key, p.x, p.y);
        if (p.wall) image.setScale(1);
        if (p.site)
          image.setInteractive({ pixelPerfect: true }).setData("site", p.site);
        image.setData("locationPart", p.id);
        this.objects.set(p.id, image);
      }
      // Low broken walls fade locally when they cover the hero's upper body.
      const image = this.objects.get(p.id),
        player = s.core.player;
      image.setAlpha(
        p.wall &&
          Math.abs(player.x - p.x) < 34 &&
          player.y < p.y &&
          player.y > p.y - 80
          ? 0.4
          : 1,
      );
    }
    for (const [id, image] of this.objects)
      if (!wanted.has(id)) {
        image.destroy();
        this.objects.delete(id);
      }
  }
}
