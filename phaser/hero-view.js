import { heroDirection, STRIKE_HANDS } from "./art/hero-motion.js";

const snap = (v) => Math.round(v / 2) * 2;
// Only presentation. No animation callback awards wood, damage, or coins.
export class HeroView {
  constructor(scene) {
    this.scene = scene;
    this.player = scene.add
      .sprite(1600, 1720, "forest", "characters.player.down.0")
      .setOrigin(0.5, 44 / 46)
      .setScale(2);
    this.axe = scene.add
      .sprite(1620, 1704, "forest", "axes.0.0")
      .setOrigin(0.5, 19 / 24)
      .setScale(2);
    this.bob = 0;
    this.pose = "idle";
  }
  hit() {
    const p = this.scene.core.player,
      dir = heroDirection(p.direction);
    this.strikeDir = dir;
    this.strikeFlip = p.direction === "left";
    this.axe.play(
      `chop.${this.scene.core.state.axeLevel}${dir === "side" ? "" : `.${dir}`}`,
    );
  }
  render() {
    const { scene } = this,
      { player: p, state: s, elapsed: t } = scene.core,
      dir = heroDirection(p.direction);
    const striking = p.swing > 0 && this.axe.anims.isPlaying;
    const mood =
      p.celebration > 0
        ? "happy"
        : s.wood / s.maxWood >= 0.75
          ? "tired"
          : "neutral";
    this.bob = p.moving
      ? Math.floor(t * 12) % 4 < 2
        ? -2
        : 0
      : p.celebration > 0 && s.wood === 0
        ? -Math.max(0, snap(Math.sin(t * 12) * 5))
        : 0;
    this.player
      .setPosition(snap(p.x), snap(p.y + this.bob))
      .setFlipX(p.direction === "left")
      .setDepth(p.y);
    if (striking) {
      this.player.setFlipX(this.strikeFlip);
      const phase = this.axe.anims.currentFrame.index - 1;
      this.player.stop();
      scene.assets.setFrame(
        this.player,
        `hero.strike.${this.strikeDir}.${phase}`,
      );
      const [hx, hy] = STRIKE_HANDS[this.strikeDir][phase],
        sign = this.strikeFlip ? -1 : 1;
      const meta = scene.assets.meta.get(this.axe.frame.name);
      this.axe
        .setOrigin(meta.originX, meta.originY)
        .setScale(2)
        .setPosition(
          snap(p.x + sign * (hx - 16) * 2),
          snap(p.y + (hy - 44) * 2 + this.bob),
        );
      this.pose = "strike";
    } else {
      if (p.swing <= 0) this.axe.stop();
      const carry = s.wood > 0 ? (mood === "tired" ? "heavy" : "carry") : null;
      const prefix = carry
        ? `hero.${carry}.${dir}`
        : mood === "neutral"
          ? `characters.player.${dir}`
          : `people.player.${mood}.${dir}`;
      if (p.moving) {
        this.player.play(`walk.player.${carry || mood}.${dir}`, true);
        this.player.anims.timeScale = s.runSpeed / 200;
        this.pose = carry || "walk";
      } else {
        this.player.stop();
        const idle =
          !s.wood && p.celebration > 0
            ? `hero.cheer.${dir}.${Math.floor(t * 6) % 2}`
            : !s.wood &&
                dir === "down" &&
                mood === "neutral" &&
                Math.floor(t * 10) % 53 < 2
              ? "idle.player.blink"
              : `${prefix}.0`;
        scene.assets.setFrame(this.player, idle);
        this.pose = carry || (!s.wood && p.celebration > 0 ? "cheer" : "idle");
      }
      scene.assets.setFrame(this.axe, `axes.${s.axeLevel}.0`);
      this.axe
        .setScale(carry ? 1.5 : 2)
        .setPosition(
          snap(p.x + (p.direction === "left" ? -22 : 22)),
          snap(p.y - 20 + this.bob),
        );
    }
    this.axe
      .setFlipX(striking ? this.strikeFlip : p.direction === "left")
      .setDepth(p.y + (striking && this.strikeDir === "up" ? -0.02 : 0.03));
  }
}
