import { passageOpen } from "../game/locations.js";
import { fortressParts } from "./fortress-assets.js";

// Playable layout preview with existing PNGs. Stream short wall pieces around
// the camera; collision uses whole data segments, never these decorative images.
export class LocationView {
  constructor(scene) {
    this.scene = scene;
    this.objects = new Map();
    this.parts = [];
    for (const location of scene.core.world.locations || []) {
      const generated =
        scene.assets.fortress?.manifest.regionId === location.regionId;
      if (generated) this.parts.push(...fortressParts(location));
      else
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
              key: wall.key || "biomeprop.ruins",
              timber: wall.key === "log",
              angle: Math.atan2(wall.b.y - wall.a.y, wall.b.x - wall.a.x),
              wall: true,
            });
        }
      const siteKeys = {
        "fortress-winch": "winch",
        "fortress-hidden-latch": "latch",
        "fortress-watch-token": "keepsake",
        "fortress-barricade": "barricade",
        "fortress-last-fire": "coldFire",
        "fortress-abandoned-supplies": "supplies",
      };
      for (const site of location.sites)
        this.parts.push({
          ...site,
          key:
            generated && siteKeys[site.id]
              ? `fortress.${siteKeys[site.id]}`
              : site.key || "world.rune",
          site: site.id,
        });
      for (const p of location.dressing || [])
        this.parts.push({
          ...p,
          id: `${location.id}/${p.id}`,
          regionId: location.regionId,
          key:
            generated && p.key === "world.strangeTracks"
              ? "fortress.tracks"
              : generated && p.id === "guard-crate"
                ? "fortress.supplies"
                : p.key,
        });
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
        (p.requiredPassage && !passageOpen(s.core.state, p.requiredPassage)) ||
        (p.kind === "discovery" &&
          s.core.state.exploration.discoveries.includes(p.id)) ||
        (p.passage && !p.drawOpened && passageOpen(s.core.state, p.passage)) ||
        !s.nearView(p, view, 160)
      )
        continue;
      wanted.add(p.id);
      if (!this.objects.has(p.id)) {
        const image = s.addImage(p.key, p.x, p.y);
        if (p.timber)
          image.setOrigin(0.5).setDisplaySize(64, 26).setRotation(p.angle);
        if (p.wall && !p.timber && !s.assets.fortress) image.setScale(1);
        if (p.site)
          // PNG frames have transparent foot padding; inspection must accept base taps too.
          image.setInteractive().setData("site", p.site);
        image.setData("locationPart", p.id);
        this.objects.set(p.id, image);
      }
      // Low broken walls fade locally when they cover the hero's upper body.
      const image = this.objects.get(p.id),
        player = s.core.player;
      const key =
        p.drawOpened && passageOpen(s.core.state, p.passage)
          ? p.openKey
          : p.key;
      if (image.frame.name !== key) s.assets.setFrame(image, key);
      const meta = s.assets.meta.get(key);
      image.setAlpha(
        p.wall &&
          Math.abs(player.x - p.x) < (meta.width * image.scaleX) / 2 &&
          player.y < p.y + (p.footSpan || 0) &&
          player.y > p.y - meta.originY * meta.height * image.scaleY
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
