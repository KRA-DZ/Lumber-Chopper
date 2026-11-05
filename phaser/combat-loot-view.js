import { LAYERS } from "./layers.js";
import { ITEMS } from "../game/exploration.js";
// Reuse the approved PNG sack. A label identifies contents without adding new art packs.
export class CombatLootView {
  constructor(scene) {
    this.scene = scene;
    this.objects = new Map();
  }
  render() {
    const s = this.scene,
      c = s.core,
      piles = c.combatLoot.piles;
    for (const [id, o] of this.objects)
      if (!piles.has(id)) {
        o.image.destroy();
        o.label.destroy();
        this.objects.delete(id);
      }
    for (const [id, pile] of piles) {
      let o = this.objects.get(id);
      if (!o) {
        o = {
          image: s.addImage("loot.sack", pile.x, pile.y).setScale(0.7),
          label: s.text("", pile.x, pile.y - 36, 11, "#f0d59b", LAYERS.hints),
        };
        this.objects.set(id, o);
      }
      const visible = s.nearView(pile, s.camera.worldView, 100);
      o.image.setVisible(visible).setDepth(pile.y + 0.1);
      const text = [
        pile.coins ? `${pile.coins} мон.` : "",
        pile.resin
          ? `Смола${c.state.exploration.items.resin >= ITEMS.resin.limit ? " · сумка полна" : ""}`
          : "",
      ]
        .filter(Boolean)
        .join(" · ");
      o.label
        .setText(text)
        .setVisible(
          visible &&
            (pile.boss ||
              Math.hypot(pile.x - c.player.x, pile.y - c.player.y) < 160),
        );
    }
  }
}
