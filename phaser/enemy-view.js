import { BIOMES } from "../game/biomes.js";
import { RAIDER_ROLES } from "../game/raiders.js";
import { CENTER } from "../game/config.js";
import { WATCHER_LABELS } from "../game/watcher.js";
import { LAYERS } from "./layers.js";
import { MINIONS } from "../game/minions.js";
export class EnemyView {
  constructor(scene) {
    this.scene = scene;
    this.objects = new Map();
    this.impacts = [];
    this.fade = null;
    this.starterLight = scene.addImage(
      "survival.startLantern",
      CENTER.x,
      CENTER.y,
    ).setVisible(false);
    this.signals = scene.add.graphics().setDepth(LAYERS.hints);
  }
  strike(area) {
    if (this.impacts.length >= 2) this.impacts.shift();
    this.impacts.push({ ...area, time: this.scene.core.elapsed });
  }
  render() {
    const s = this.scene,
      c = s.core,
      d = c.survival,
      g = this.signals.clear();
    if (!d) return;
    this.starterLight.setVisible(false);
    const actors = [
        ...d.raiders,
        ...(d.residents || []),
        ...(d.monster ? [d.monster] : []),
      ],
      ids = new Set(actors.map((e) => e.id));
    for (const [id, o] of this.objects)
      if (!ids.has(id)) {
        o.label.destroy();
        if (id === "watcher") {
          if (this.fade) {
            s.tweens.killTweensOf(this.fade);
            this.fade.destroy();
          }
          this.fade = o.image;
          const ghost = o.image;
          s.tweens.add({
            targets: ghost,
            alpha: 0,
            duration: 600,
            onComplete: () => {
              ghost.destroy();
              if (this.fade === ghost) this.fade = null;
            },
          });
        } else o.image.destroy();
        this.objects.delete(id);
      }
    if (c.cycle.isNight) {
      const bright = d.monster?.phase === "repelled" && d.monster.phaseTime < 2;
      g.lineStyle(
        bright ? 3 : 2,
        bright ? 0xb5d6a3 : 0xe6bb70,
        bright ? 0.7 : 0.35,
      ).strokeCircle(CENTER.x, CENTER.y, d.safeRadius());
    }
    for (const e of actors) {
      let o = this.objects.get(e.id);
      if (!o) {
        o = {
          image: s
            .addImage(
              e.kind === "resident"
                ? `enemy.${e.family}.idle`
                : `survival.${e.kind}0`,
              e.x,
              e.y,
            )
            .setInteractive({ pixelPerfect: true })
            .setData("enemy", e.id),
          label: s.text("", e.x, e.y - 210, 11, "#e9c598", LAYERS.hints),
        };
        this.objects.set(e.id, o);
      }
      const frame = e.moving ? Math.floor(c.elapsed * 5) % 2 : 0;
      const role = RAIDER_ROLES[e.role] || RAIDER_ROLES.attacker;
      const small = e.tier === "minion";
      const spriteRole=role.spriteRole||e.role;
      let key =
        e.kind === "raider" && spriteRole && spriteRole !== "attacker"
          ? `survival.raider.${spriteRole}${frame}`
          : `survival.${e.kind}${frame}`;
      if (e.kind === "raider" && e.windup > 0) key = "survival.raider.attack";
      if (e.invulnerable) {
        if (["notice", "windup", "strike", "repelled"].includes(e.phase))
          key = `survival.watcher.${e.phase}`;
        else if (e.phase === "search" && Math.floor(c.elapsed) % 2)
          key = "survival.watcher.search";
      }
      if (e.kind === "resident")
        key = `enemy.${e.family}.${e.windup > 0 ? "attack" : frame ? "walk" : "idle"}`;
      s.assets.setFrame(o.image, key);
      o.image.setScale(
        e.invulnerable ? 4 : small
          ? 3.3
          : e.tier === "boss"
            ? 3.375
            : e.role === "breaker"
              ? 2.25
              : 2,
      );
      const visible = s.nearView(
        e,
        s.camera.worldView,
        Math.max(250, o.image.displayHeight + 24),
      );
      if (e.flash > 0) o.image.setTintFill(0xffedc0);
      else if(e.kind==="raider"&&e.role==="thrower")o.image.setTint(0xc5c595);
      else o.image.clearTint();
      const selected = (c.actors || [c]).some(a => a.selectedEnemyId === e.id);
      if (selected && visible) {
        g.lineStyle(3, 0xffe5a2, 0.95).strokeEllipse(e.x, e.y, 48, 24);
        const barY = e.y - (small ? 195 : e.tier === "boss" ? 185 : 123);
        g.fillStyle(0x302f29, 0.95)
          .fillRect(e.x - 26, barY, 52, 6)
          .fillStyle(role.color)
          .fillRect(e.x - 25, barY + 1, (50 * e.hp) / e.maxHP, 4);
      }
      o.image
        .setPosition(Math.round(e.x / 2) * 2, Math.round(e.y / 2) * 2)
        .setDepth(e.y)
        .setAlpha(
          e.warning > 0
            ? 0.3 + (1 - e.warning / (e.kind === "resident" ? 3 : 12)) * 0.4
            : 1,
        )
        .setVisible(visible);
      o.label
        .setPosition(
          e.x,
          e.y -
            (e.invulnerable
              ? Math.max(208,o.image.displayHeight*o.image.originY+20)
              : small
                ? 228
                : e.tier === "boss"
                  ? 210
                  : 110),
        )
        .setText(
          e.invulnerable
            ? `СМОТРИТЕЛЬ · НЕУЯЗВИМ\n${WATCHER_LABELS[e.phase] || "РЯДОМ"}${e.phase === "windup" ? ` · ${Math.max(0, (e.attack?.duration || 1.2) - e.windup).toFixed(1)} с` : ""}`
            : `${selected ? "▾ " : ""}${e.kind === "resident" ? `${small ? (e.role === "ranged" ? "Метатель" : "Малый") : "Босс"} · ${BIOMES[e.biome].creature}` : e.fast ? "Бегун" : role.name} · ${e.hp} HP${e.warning > 0 && e.kind === "resident" ? " · появляется" : ""}${
                e.fleeing
                  ? `
Убегает · ${e.stolen} монет`
                  : ""
              }`,
        )
        .setVisible(visible);
      s.worldHints.offer(o.label, e, {
        eligible: visible,
        range: selected || e.invulnerable ? Infinity : 220,
        priority: e.invulnerable ? 110 : selected ? 100 : e.windup > 0 ? 80 : 40,
      });
      const color = e.invulnerable
        ? "#e9c598"
        : selected
          ? "#ffe5a2"
          : `#${role.color.toString(16).padStart(6, "0")}`;
      // Text.setColor redraws its canvas/GPU texture even when the color is unchanged.
      if (o.label.style.color !== color) o.label.setColor(color);
      /* ground telegraphs below */
      if (e.invulnerable && e.phase === "windup" && e.attack) {
        const a = e.attack,
          t = Math.min(1, e.windup / (e.attack.duration || 1.2));
        g.fillStyle(0xb44834, 0.2)
          .fillCircle(a.x, a.y, a.radius)
          .lineStyle(3, 0xf0a087, 0.95)
          .strokeCircle(a.x, a.y, a.radius);
        g.lineStyle(4, 0xffd8a8)
          .beginPath()
          .arc(
            a.x,
            a.y,
            a.radius - 7,
            -Math.PI / 2,
            -Math.PI / 2 + Math.PI * 2 * t,
          )
          .strokePath();
      } else if (e.attack) {
        const radius = e.role==="thrower"?e.attack.radius:small
          ? e.attack.kind === "throw"
            ? MINIONS.blastRadius
            : MINIONS.range
          : 54;
        g.fillStyle(0xb44834, 0.15).fillCircle(e.attack.x, e.attack.y, radius);
        g.lineStyle(2, 0xf0a087, 0.9).strokeCircle(
          e.attack.x,
          e.attack.y,
          radius,
        );
      } else if (!e.invulnerable && e.windup > 0)
        g.lineStyle(3, 0xd56f62, 0.9).strokeCircle(
          e.x,
          e.y,
          20 + e.windup * 18,
        );
    }
    for (const shot of d.projectiles || []) {
      const t = Math.min(1, shot.age / shot.duration);
      if (!s.nearView(shot, s.camera.worldView, 160)) continue;
      g.lineStyle(2, 0xe8ab79, 0.75).strokeCircle(shot.x, shot.y, shot.radius);
      const x = shot.fromX + (shot.x - shot.fromX) * t;
      const y =
        shot.fromY + (shot.y - shot.fromY) * t - Math.sin(t * Math.PI) * 60;
      g.fillStyle(0xf0bd75, 1)
        .fillCircle(x, y, 5)
        .lineStyle(1, 0x563f36, 1)
        .strokeCircle(x, y, 5);
    }
    this.impacts = this.impacts.filter((e) => c.elapsed - e.time < 0.4);
    for (const e of this.impacts)
      g.lineStyle(3, 0xf3b697, 1 - (c.elapsed - e.time) / 0.4).strokeCircle(
        e.x,
        e.y,
        e.radius + (c.elapsed - e.time) * 24,
      );
    if (!c.coop) s.player.setAlpha(
      d.hitCooldown > 0 && Math.floor(c.elapsed * 12) % 2 === 0 ? 0.45 : 1,
    );
  }
}
