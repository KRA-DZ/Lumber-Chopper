import { LAYERS } from "./layers.js";
import { createWeather } from "../weather.js";
import { createEnvironment } from "../environment.js";
import { createMystery, MYSTERY_CLUES, nightSight } from "../mystery.js";
import { createWildlife } from "../game/wildlife.js";
import { DAY_SECONDS, CENTER } from "../game/config.js";
import { CAMP, pixelHash } from "../pixel-art.js";

const snap = (v) => Math.round(v / 2) * 2;
export class Atmosphere {
  constructor(scene) {
    this.scene = scene;
    this.core = scene.core;
    this.assets = scene.assets;
    this.quality = "full";
    this.merchantSite = this.core.world.merchant || CAMP.merchant;
    this.clueData = this.core.world.clues || MYSTERY_CLUES;
    this.environment = createEnvironment(this.assets.art);
    this.weather = createWeather({
      art: this.assets.art,
      sprites: this.assets.worldArt,
      ...this.core.world,
      springs: this.core.world.landmarks.filter((p) => p.type === "spring"),
      center: CENTER,
    });
    this.mystery = createMystery();
    this.wildlife = createWildlife(this.core);
    this.discovered = new Set();
    this.discovery = "";
    this.discoveryUntil = 0;
    this.ground = scene.add.graphics().setDepth(-3800);
    this.air = scene.add.graphics().setDepth(LAYERS.air);
    this.eyes = scene.add.graphics().setDepth(LAYERS.eyes);
    this.tint = scene.add.graphics().setScrollFactor(0).setDepth(LAYERS.tint);
    this.glow = scene.add.graphics().setDepth(LAYERS.glow);
    this.animals = this.wildlife.animals.map((a) => ({
      body: a,
      image: scene.addImage(`animals.${a.type}.0`, a.x, a.y),
      shadow: scene
        .addImage("shadow", a.x, a.y)
        .setScale(0.3, 0.35)
        .setAlpha(0.3),
    }));
    this.ripples = Array.from({ length: 8 }, (_, i) => {
      const pond = this.core.world.pond;
      const point =
        i === 7
          ? this.core.world.landmarks.find((p) => p.type === "spring") || pond
          : { x: pond.x - 110 + i * 34, y: pond.y - 48 + Math.sin(i * 2) * 55 };
      return {
        p: point,
        i,
        image: scene.addImage("ripples.0", point.x, point.y, -3900),
      };
    });
    this.siteLabels = (
      this.core.world.regional ? [] : this.core.world.landmarks
    ).map((p) => ({
      p,
      label: scene.text(p.name, p.x, p.y + 42, 11, "#e9e5be").setVisible(false),
    }));
    this.fog = [];
    for (const p of [
      this.core.world.pond,
      ...this.core.world.landmarks.filter((p) => p.type === "spring"),
    ])
      for (let i = 0; i < 3; i++)
        this.fog.push({
          p,
          i,
          image: scene
            .addImage("world.fog", p.x, p.y, LAYERS.particles)
            .setScale(6)
            .setVisible(false),
        });
    this.smoke = Array.from({ length: 5 }, () =>
      scene.addImage("world.smoke", 0, 0, LAYERS.smoke).setVisible(false),
    );
    this.clues = this.clueData.map((c) => ({
      c,
      image: scene
        .addImage(
          `world.${c.id === "tracks" ? "strangeTracks" : c.id === "mark" ? "rune" : "note"}`,
          c.x,
          c.y,
        )
        .setInteractive({ pixelPerfect: true })
        .setData("clue", c),
    }));
    this.prompt = scene
      .text("", 0, 0, 12, "#f1d994", LAYERS.hints)
      .setVisible(false);
    // This is only a low-resolution light mask, not a Canvas rendering of the game.
    // Texture upload is capped at 10 Hz (6 Hz in light mode), with cached soft stamps.
    if (scene.textures.exists("night-mask"))
      scene.textures.remove("night-mask");
    this.mask = scene.textures.createCanvas("night-mask", 480, 352);
    this.mask.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.shade = scene.add
      .image(0, 0, "night-mask")
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(LAYERS.night)
      .setVisible(false);
    this.stamp = document.createElement("canvas");
    this.stamp.width = this.stamp.height = 128;
    const ctx = this.stamp.getContext("2d"),
      g = ctx.createRadialGradient(64, 64, 18, 64, 64, 64);
    g.addColorStop(0, "rgba(0,0,0,1)");
    g.addColorStop(0.6, "rgba(0,0,0,.75)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    this.reveal = {
      from: this.core.forestRadius(),
      to: this.core.forestRadius(),
      age: 18,
    };
    this.rings = scene.add.graphics().setDepth(LAYERS.border);
  }
  setQuality(value) {
    this.quality = value;
    this.weather.setQuality(value);
    this.environment.setQuality(value);
    this.maskKey = "";
  }
  lights() {
    const s = this.core.state,
      p = this.core.player,
      t = this.core.elapsed;
    return [
      { x: p.x, y: p.y - 24, r: nightSight(s.lanternLevel) },
      ...this.lanterns(),
      {
        x: 1600,
        y: 1600,
        r: this.core.survival?.safeRadius() ?? (s.campLevel > 0 ? 220 : 0),
      },
      ...(s.campLevel === 4
        ? [
            { x: CAMP.hut.x - 68, y: CAMP.hut.y - 68, r: 100 },
            { x: CAMP.hut.x + 78, y: CAMP.hut.y - 68, r: 85 },
          ]
        : []),
    ];
  }
  lanterns() {
    return [
      { x: CAMP.stall.x + 80, y: CAMP.stall.y - 80, r: 115 },
      ...(this.accessible(this.merchantSite)
        ? [{ x: this.merchantSite.x + 75, y: this.merchantSite.y + 20, r: 110 }]
        : []),
    ];
  }
  accessible(p) {
    return this.core.accessible(p);
  }
  nearestClue() {
    const player = this.core.player,
      candidates = this.clueData.filter(
        (c) =>
          this.accessible(c) &&
          Math.hypot(c.x - player.x, c.y - player.y) < 130,
      );
    for (const list of this.scene.regionView?.objects.values() || [])
      for (const image of list) {
        const clue = image.getData("clue");
        if (clue && Math.hypot(clue.x - player.x, clue.y - player.y) < 130)
          candidates.push(clue);
      }
    const site = this.core.exploration?.nearest();
    if (site) candidates.push(site);
    return candidates.sort(
      (a, b) =>
        Math.hypot(a.x - player.x, a.y - player.y) -
        Math.hypot(b.x - player.x, b.y - player.y),
    )[0];
  }
  update(dt) {
    if (this.core.paused) return;
    const c = this.core,
      v = this.scene.camera.worldView;
    this.weather.update(
      dt,
      c.state,
      DAY_SECONDS,
      c.dayNumber,
      c.trees,
      c.player,
    );
    this.environment.update(dt, c.elapsed, c.trees, c.player);
    this.wildlife.update(dt);
    this.mystery.update(dt, {
      darkness: c.nightAmount(),
      player: c.player,
      view: v,
      lights: this.lights(),
      center: CENTER,
      radius: c.regions ? 10000 : c.forestRadius(),
      accessible: (p) => this.accessible(p),
    });
    this.reveal.age += dt;
    for (const p of c.world.landmarks)
      if (
        this.accessible(p) &&
        !this.discovered.has(p.id) &&
        Math.hypot(p.x - c.player.x, p.y - c.player.y) < 150
      ) {
        this.discovered.add(p.id);
        this.discovery = `Найдено: ${p.name}`;
        this.discoveryUntil = c.elapsed + 5;
      }
    this.scene.audio.update(dt, c, this.weather.profile);
  }
  expand(e) {
    this.reveal = { from: e.from, to: e.to, age: 0 };
  }
  get radius() {
    const r = this.reveal,
      t = Math.min(1, r.age / 2.4);
    return r.from + (r.to - r.from) * (1 - (1 - t) ** 3);
  }
  render() {
    const { scene, core: c } = this,
      p = c.player,
      t = c.elapsed,
      v = scene.camera.worldView,
      dark = c.nightAmount(),
      profile = this.weather.profile;
    const light = this.quality === "light",
      g = this.ground.clear(),
      a = this.air.clear(),
      eyes = this.eyes.clear(),
      glow = this.glow.clear();
    const near = (x, y, m = 40) =>
      x > v.x - m && x < v.right + m && y > v.y - m && y < v.bottom + m;
    const pond = c.world.pond;
    for (let i = 0; i < 55; i++) {
      const x = pond.x - 160 + ((i * 47) % 310),
        y = pond.y - 90 + ((i * 73) % 850);
      if (near(x, y) && c.world.inWater(x, y))
        g.fillStyle(i % 2 ? 0x91b8ad : 0x548f93, 0.7).fillRect(
          snap(x + (Math.floor(t * 3 + i) % 4) * 2),
          snap(y),
          8 + (i % 3) * 4,
          2,
        );
    }
    for (const { p: water, i, image } of this.ripples) {
      this.assets.setFrame(
        image,
        `ripples.${Math.floor(t * 1.6 + i * 0.7) % 4}`,
      );
      image.setVisible(
        (near(water.x, water.y) && c.world.inWater(water.x, water.y)) ||
          (i === 7 && near(water.x, water.y)),
      );
    }
    for (const { p: site, label } of this.siteLabels)
      label.setVisible(
        this.discovered.has(site.id) && near(site.x, site.y, 160),
      );
    for (const { image, p: plant } of scene.staticObjects)
      if (
        ["fern", "flowers", "mushroom"].includes(plant.type) &&
        image.visible
      ) {
        const phase = light
          ? 0
          : [0, 1, 0, -1][Math.floor(t * 1.1 + plant.x) % 4];
        this.assets.setFrame(
          image,
          phase
            ? `plant.${plant.type}.${plant.variant || 0}.${phase}`
            : `details.${plant.type}.${plant.variant || 0}`,
        );
      }
    for (const tr of this.weather.tracks)
      if (near(tr.x, tr.y)) {
        const progress = tr.age / tr.life;
        g.fillStyle(
          tr.kind === "water"
            ? 0x9ebcb0
            : tr.kind === "grass"
              ? 0x466842
              : 0xd9bd84,
          (1 - progress) * 0.65,
        );
        if (tr.kind === "water")
          g.lineStyle(2, 0x94b8ae, (1 - progress) * 0.6).strokeEllipse(
            snap(tr.x),
            snap(tr.y),
            8 + progress * 22,
            4 + progress * 10,
          );
        else
          g.fillRect(
            snap(tr.x - 4 - progress * 4),
            snap(tr.y - progress * 4),
            snap(8 + progress * 8),
            2,
          );
      }
    for (const l of this.environment.leaves)
      if (near(l.x, l.y))
        a.fillStyle(
          parseInt(l.color.slice(1), 16),
          Math.min(1, 1 + l.duration - l.age),
        )
          .fillRect(snap(l.x + Math.sin(t * 4 + l.phase) * 4), snap(l.y), 4, 2)
          .fillRect(snap(l.x) + 2, snap(l.y) + 2, 2, 2);
    if (profile.rain > 0.01)
      for (let i = 0; i < (light ? 28 : 80); i++) {
        const x = snap(v.x + (((pixelHash(i, 31) % 4096) + t * 34) % v.width)),
          y = snap(
            v.y +
              (((pixelHash(i, 29) % 4096) + t * (210 + (i % 5) * 24)) %
                v.height),
          );
        a.fillStyle(0xc2d5ce, profile.rain * 0.55)
          .fillRect(x, y, 2, 6)
          .fillRect(x - 2, y + 6, 2, 4);
      }
    for (const d of this.weather.drips)
      if (near(d.x, d.y, 160)) {
        const y = d.y + Math.min(1, d.age / 0.8) ** 2 * 120;
        if (d.age < 0.8)
          a.fillStyle(0xb8d3c8, 0.75).fillRect(snap(d.x), snap(y), 2, 6);
        else
          g.lineStyle(2, 0xb8d3c8, 1 - (d.age - 0.8) * 4).strokeEllipse(
            snap(d.x),
            snap(y),
            8 + (d.age - 0.8) * 60,
            4 + (d.age - 0.8) * 20,
          );
      }
    for (const { p: water, i, image } of this.fog)
      image
        .setPosition(
          snap(water.x + Math.sin(t * 0.07 + i) * 46),
          snap(water.y - 14 + i * 18),
        )
        .setAlpha(profile.mist * 0.1)
        .setVisible(
          profile.mist > 0.01 &&
            (!light || i === 0) &&
            near(water.x, water.y, 350),
        );
    for (const { body: b, image, shadow } of this.animals) {
      const visible = this.accessible(b) && near(b.x, b.y, 100),
        frame = b.moving
          ? Math.floor(t * 9 + b.id) % 2
          : Math.floor(t * 0.7 + b.id) % 2;
      this.assets.setFrame(image, `animals.${b.type}.${frame}`);
      image
        .setPosition(
          snap(b.x),
          snap(
            b.y -
              b.z +
              (b.moving && b.type === "rabbit"
                ? Math.sin(t * 15 + b.id) * 3
                : 0),
          ),
        )
        .setDepth(b.z > 5 ? LAYERS.particles : b.y)
        .setFlipX(Math.cos(b.angle) < 0)
        .setAlpha(b.state === "sleep" ? 0.7 : 1)
        .setVisible(visible);
      shadow
        .setPosition(snap(b.x), snap(b.y + 2))
        .setDepth(b.y - 0.1)
        .setVisible(visible);
    }
    const life = this.wildlife.merchantLife;
    this.assets.setFrame(
      scene.merchant,
      `merchant.${life.action}.${Math.floor(t * 3) % 2}`,
    );
    scene.merchant
      .setPosition(
        snap(
          this.merchantSite.x +
            (life.action === "look" ? Math.sin(t * 3) * 2 : 0),
        ),
        snap(this.merchantSite.y + (life.offset ?? 36)),
      )
      .setDepth(this.merchantSite.y + (life.offset ?? 36));
    for (const { image, p: decor } of scene.campDecor)
      if (decor.type === "clothes")
        this.assets.setFrame(image, `world.clothes.${Math.floor(t * 1.4) % 2}`);
    for (const { c: clue, image } of this.clues)
      image.setVisible(this.accessible(clue) && near(clue.x, clue.y));
    const clue = this.nearestClue();
    this.prompt.setVisible(!!clue && !this.core.exploration?.fishing);
    if (clue)
      this.prompt
        .setPosition(clue.x, clue.y + 28)
        .setText(`${clue.name} · E / нажать`);
    for (let i = 0; i < this.smoke.length; i++) {
      const f = (t * 0.23 + i / 5) % 1;
      this.smoke[i]
        .setPosition(
          snap(CAMP.hut.x + 92 + Math.sin(t * 0.4 + i) * 12 + f * 16),
          snap(CAMP.hut.y - 300 - f * 90),
        )
        .setScale(1 + f * 1.2)
        .setAlpha((1 - f) * 0.22)
        .setVisible(
          c.state.campLevel === 4 &&
            !light &&
            near(CAMP.hut.x, CAMP.hut.y, 400),
        );
    }
    for (const l of this.lanterns()) {
      a.fillStyle(0x644b30)
        .fillRect(snap(l.x) - 2, snap(l.y) - 8, 4, 30)
        .fillStyle(0x4a4931)
        .fillRect(snap(l.x) - 8, snap(l.y) - 30, 16, 22)
        .fillStyle(0xe8be66)
        .fillRect(snap(l.x) - 5, snap(l.y) - 26, 10, 14)
        .fillStyle(0xffe3a0)
        .fillRect(snap(l.x) - 2, snap(l.y) - 25, 4, 10);
    }
    if (c.state.campLevel > 0 && !light)
      for (let i = 0; i < 7; i++) {
        const f = (t * 0.23 + i / 7) % 1;
        a.fillStyle(0xd9d6bf, (1 - f) * 0.2).fillRect(
          snap(1600 + Math.sin(f * 8 + i) * 12),
          snap(1558 - f * 65),
          snap(8 + f * 12),
          snap(6 + f * 8),
        );
      }
    if (c.state.campLevel === 4 && dark > 0.15)
      for (const x of [-68, 78])
        a.fillStyle(0xe5b869, dark * 0.4).fillRect(
          CAMP.hut.x + x - 8,
          CAMP.hut.y - 80,
          16,
          22,
        );
    if (dark > 0.15)
      for (const l of this.lights().slice(1))
        glow
          .fillStyle(0xf3bb62, dark * 0.1)
          .fillEllipse(snap(l.x), snap(l.y), 28, 12);
    this.drawNight(v, dark, t);
    if (dark > 0.45)
      for (const e of this.mystery.eyes) {
        if (
          this.lights().some(
            (l) => Math.hypot(e.x - l.x, e.y - l.y) < l.r * 0.9,
          ) ||
          Math.sin(t * 4 + e.phase) > 0.98
        )
          continue;
        const alpha =
            Math.min(1, e.age * 2, (e.life - e.age) * 2) *
            (0.5 + Math.sin(t * 1.7 + e.phase) * 0.18),
          x = snap(e.x),
          y = snap(e.y);
        eyes
          .fillStyle(0xbba66d, alpha * 0.25)
          .fillRect(x - 10, y - 2, 8, 6)
          .fillRect(x + 4, y - 2, 8, 6)
          .fillStyle(0xe9c981, alpha)
          .fillRect(x - 8, y, 4, 2)
          .fillRect(x + 6, y, 4, 2);
      }
    const phase = t % 85;
    if (dark > 0.45 && phase > 52 && phase < 63) {
      const x = 2210 + Math.sin(t * 0.4) * 12,
        y = 1500 + Math.sin(t * 0.7) * 8;
      if (
        this.accessible({ x, y }) &&
        near(x, y) &&
        Math.hypot(x - p.x, y - p.y) > 120
      )
        eyes
          .fillStyle(0x98cbb7, Math.min(1, phase - 52, 63 - phase) * 0.7)
          .fillRect(snap(x) - 4, snap(y) - 4, 8, 8)
          .fillStyle(0xe8e6ad, 0.8)
          .fillRect(snap(x) - 2, snap(y) - 2, 4, 4);
    }
    this.tint.clear();
    const dayPhase = c.state.worldTime / DAY_SECONDS;
    const sunset = Math.max(0, 1 - Math.abs(dayPhase - 0.49) / 0.09) * 0.13;
    if (sunset > 0)
      this.tint
        .fillStyle(0xd89660, sunset)
        .fillRect(0, 0, scene.scale.width, scene.scale.height);
    if (profile.rain > 0.01)
      this.tint
        .fillStyle(0x29414f, profile.rain * 0.09)
        .fillRect(0, 0, scene.scale.width, scene.scale.height);
    this.rings.clear();
    if (!c.regions && this.reveal.age < 18)
      this.rings
        .lineStyle(6, 0xf8dc8d, Math.min(1, (18 - this.reveal.age) / 3) * 0.8)
        .strokeCircle(1600, 1600, this.radius)
        .lineStyle(2, 0xbae0a1, 0.5)
        .strokeCircle(1600, 1600, this.reveal.from);
  }
  drawNight(v, dark, t) {
    this.shade
      .setDisplaySize(this.scene.scale.width, this.scene.scale.height)
      .setVisible(dark > 0.01);
    if (dark <= 0.01) {
      this.maskKey = "";
      return;
    }
    const factor = this.quality === "light" ? 4 : 2,
      w = Math.ceil(v.width / factor),
      h = Math.ceil(v.height / factor);
    const key = [
      w,
      h,
      Math.floor(t * (this.quality === "light" ? 6 : 10)),
      Math.floor(dark * 50),
      this.core.state.lanternLevel,
      this.core.state.campLevel,
    ].join(":");
    const jumped =
      !this.maskView ||
      Math.hypot(v.x - this.maskView.x, v.y - this.maskView.y) > v.width / 4;
    if (key === this.maskKey && !jumped) return;
    this.maskKey = key;
    this.maskView = { x: v.x, y: v.y };
    if (this.mask.width !== w || this.mask.height !== h)
      this.mask.setSize(w, h);
    const ctx = this.mask.getContext();
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = `rgba(4,12,20,${dark * 0.97})`;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "destination-out";
    for (const l of this.lights())
      ctx.drawImage(
        this.stamp,
        (l.x - v.x - l.r) / factor,
        (l.y - v.y - l.r) / factor,
        (l.r * 2) / factor,
        (l.r * 2) / factor,
      );
    ctx.globalCompositeOperation = "source-over";
    this.mask.refresh();
  }
  destroy() {
    this.scene.textures.remove("night-mask");
  }
}
