import { HeroView } from "./hero-view.js";
import { StackView } from "./stack-view.js";
import { ExplorationView } from "./exploration-view.js";
import { ChoppingFeedback } from "./chopping-feedback.js";
import { LAYERS } from "./layers.js";

const ALIASES = ["heroView", "stackView", "explorationView", "feedback", "playerModel", "player", "axe", "cargo"];
export class CoopViews {
  constructor(scene) {
    this.scene = scene;
    this.entries = [Object.fromEntries(ALIASES.map(k => [k, scene[k]]))];
    const heroView = new HeroView(scene, true), stackView = new StackView(scene);
    this.entries.push({ heroView, stackView, explorationView: new ExplorationView(scene), feedback: new ChoppingFeedback(scene),
      playerModel: scene.core.actors[1].player, player: heroView.player, axe: heroView.axe, cargo: stackView.logs });
    this.labels = scene.core.actors.map((a, i) => scene.text(`${i + 1}`, a.player.x, a.player.y - 92, 12,
      i ? "#aadfe7" : "#ffe1a0", LAYERS.healthText));
    this.panel = document.createElement("div"); this.panel.id = "coopPlayers";
    this.cards = scene.core.actors.map((a, i) => {
      const card = document.createElement("article"), title = document.createElement("button"), stats = document.createElement("p");
      card.dataset.coopPlayer = i; title.textContent = `P${i + 1} · ${i ? "стрелки" : "WASD"}`;
      title.onclick = () => { if (!scene.core.paused) { this.focus(i); scene.renderModel(); } };
      card.append(title, stats);
      for (const [text, action] of [["Лавка", () => scene.shop.open()], ["Сумка", () => scene.explorationUi.openBag()]]) {
        const button = document.createElement("button"); button.textContent = text;
        button.dataset.coopAction = text === "Лавка" ? "shop" : "bag";
        button.onclick = () => { if (!scene.core.paused && a.state.health > 0) { this.focus(i); action(); } };
        card.append(button);
      }
      this.panel.append(card); return { card, stats };
    });
    document.querySelector("footer").prepend(this.panel);
    document.querySelector("footer").classList.add("is-coop");
  }
  focus(i) { this.scene.core.focus(i); Object.assign(this.scene, this.entries[i]); }
  withActor(i, fn) {
    const old = Object.fromEntries(ALIASES.map(k => [k, this.scene[k]]));
    return this.scene.core.withActor(i, () => { Object.assign(this.scene, this.entries[i]); try { return fn(); } finally { Object.assign(this.scene, old); } });
  }
  render() {
    const s = this.scene;
    this.focus(s.core.activeActor);
    this.entries.forEach((entry, i) => this.withActor(i, () => {
      const a = s.core.actors[i], down = a.state.health <= 0;
      entry.heroView.render(); entry.stackView.render(); entry.explorationView.render(); entry.feedback.render();
      entry.player.setAngle(down ? 75 : 0).setAlpha(down ? .55 : a.player.hitCooldown > 0 && Math.floor(s.core.elapsed * 12) % 2 ? .45 : 1);
      if (down) entry.axe.setVisible(false);
      this.labels[i].setPosition(a.player.x, a.player.y - 137).setText(down ? `${i + 1} · нужна помощь` : `${i + 1}`);
      const p = s.core.helpProgress(i);
      const text = `${a.state.wood}/${a.state.maxWood} бр. · ${a.state.coins} мон.${p ? ` · помощь ${Math.round(p * 100)}%` : ""}`;
      if (this.cards[i].stats.textContent !== text) this.cards[i].stats.textContent = text;
    }));
    this.cards.forEach((c, i) => {
      const value = String(s.core.activeActor === i);
      if (c.card.dataset.active !== value) c.card.dataset.active = value;
    });
  }
  destroy() {
    document.querySelector("footer").classList.remove("is-coop");
    this.panel.remove(); for (const label of this.labels) label.destroy();
  }
}
