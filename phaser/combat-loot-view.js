import { LAYERS } from "./layers.js";
import { ITEMS } from "../game/exploration.js";
import { nightOpacity, nightLights, inCampLight } from "./night-lighting.js";
export const LOOT_VISUALS = Object.freeze({
  maxFlights: 6,
  flightSeconds: 0.45,
  nearRadius: 160,
});
// Approved PNGs share the main atlas; markers remain inside available night light.
export class CombatLootView {
  constructor(scene) {
    this.scene = scene;
    this.objects = new Map();
    this.flights = [];
    this.glints = scene.add.graphics().setDepth(LAYERS.hints - 1);
  }
  collected(event) {
    for (const key of [
      event.coins > 0 ? "coins" : null,
      event.resin > 0 ? "resin" : null,
    ].filter(Boolean)) {
      if (this.flights.length >= LOOT_VISUALS.maxFlights)
        this.flights.shift().image.destroy();
      this.flights.push({
        image: this.scene
          .addImage(`loot.${key}`, event.x, event.y - 12, LAYERS.flights)
          .setScale(1.2),
        x: event.x,
        y: event.y - 12,
        time: this.scene.core.elapsed,
      });
    }
  }
  render() {
    const s = this.scene,
      c = s.core,
      piles = c.combatLoot.piles,
      dark = nightOpacity(c.state) >= 0.98,
      lights = dark
        ? nightLights(c.state, c.player, c.survival.safeRadius())
        : null,
      lit = (x, y) => !dark || inCampLight(x, y, lights),
      glints = this.glints.clear();
    for (const [id, o] of this.objects)
      if (!piles.has(id)) {
        o.image.destroy();
        o.resin.destroy();
        o.label.destroy();
        this.objects.delete(id);
      }
    for (const [id, pile] of piles) {
      let o = this.objects.get(id);
      if (!o) {
        o = {
          image: s.addImage("loot.coins", pile.x, pile.y).setScale(1.5),
          resin: s.addImage("loot.resin", pile.x, pile.y).setScale(1.5),
          label: s.text("", pile.x, pile.y - 50, 11, "#f0d59b", LAYERS.hints),
        };
        this.objects.set(id, o);
      }
      const visible =
          s.nearView(pile, s.camera.worldView, 100) && lit(pile.x, pile.y),
        near =
          Math.hypot(pile.x - c.player.x, pile.y - c.player.y) <
          LOOT_VISUALS.nearRadius,
        both = pile.coins > 0 && pile.resin > 0,
        depth = near ? LAYERS.hints - 1 : pile.y + 0.1;
      s.assets.setFrame(o.image, pile.coins > 0 ? "loot.coins" : "loot.resin");
      o.image
        .setPosition(pile.x - (both ? 10 : 0), pile.y)
        .setVisible(visible)
        .setDepth(depth);
      o.resin
        .setPosition(pile.x + 14, pile.y - 3)
        .setVisible(visible && both)
        .setDepth(depth + 0.01);
      if (visible && near) {
        const alpha = 0.45 + Math.sin(c.elapsed * 4) * 0.15;
        glints
          .fillStyle(0xf0ce7b, alpha)
          .fillRect(pile.x - 25, pile.y - 18, 3, 3)
          .fillRect(pile.x + 24, pile.y - 28, 3, 3);
      }
      const text = [
        pile.coins ? `${pile.coins} мон.` : "",
        pile.resin
          ? `Смола${c.state.exploration.items.resin >= ITEMS.resin.limit ? " · сумка полна" : ""}`
          : "",
      ]
        .filter(Boolean)
        .join(" · ");
      o.label.setText(text).setVisible(visible && (pile.boss || near));
    }
    this.flights = this.flights.filter((flight) => {
      const t = (c.elapsed - flight.time) / LOOT_VISUALS.flightSeconds;
      if (t >= 1) {
        flight.image.destroy();
        return false;
      }
      const ease = 1 - (1 - t) ** 2,
        x = flight.x + (c.player.x + 8 - flight.x) * ease,
        y =
          flight.y +
          (c.player.y - 60 - flight.y) * ease -
          Math.sin(t * Math.PI) * 24;
      flight.image
        .setPosition(Math.round(x), Math.round(y))
        .setAlpha(1 - t * 0.3)
        .setVisible(lit(x, y));
      return true;
    });
  }
  destroy() {
    for (const object of this.objects.values()) {
      object.image.destroy();
      object.resin.destroy();
      object.label.destroy();
    }
    for (const flight of this.flights) flight.image.destroy();
    this.objects.clear();
    this.flights = [];
    this.glints.destroy();
  }
}
