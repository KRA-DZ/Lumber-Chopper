import { createSimulation } from "../game/simulation.js";
import { CENTER, WORLD, DAY_SECONDS } from "../game/config.js";
import { CAMP } from "../pixel-art.js";
import { createWorldDressing } from "../world.js";
import { bakeConstruction } from "./construction-view.js";
import { Atmosphere } from "./atmosphere.js";
import { createForestAudio } from "./forest-audio.js";
import { growthStage } from "../forestry.js";
import { createShop } from "../shop.js";
import { createAtlas } from "./atlas.js";
import { TerrainLayer } from "./terrain-layer.js";

const snap = (v) => Math.round(v / 2) * 2;
export class WorldScene extends Phaser.Scene {
  constructor() {
    super("World");
    this.manual = false;
  }
  create() {
    this.manual = false;
    this.hudReady = false;
    this.boundaryRadius = null;
    this.expansionBanner = null;
    this.lastHudKey = null;
    this.assets = createAtlas(this);
    this.anims.resumeAll();
    this.core = createSimulation({
      emit: (type, event) => this.onModelEvent(type, event),
    });
    this.playerModel = this.core.player;
    this.terrain = new TerrainLayer(this, this.core.world);
    this.staticObjects = [];
    this.treeObjects = new Map();
    this.customerObjects = new Map();
    this.pileObjects = new Map();
    this.flights = new Set();
    this.cargo = [];
    this.falls = [];
    this.labels = [];
    this.pauseReasons = new Set();
    this.lastCampKey = "";
    const { art, worldArt } = this.assets,
      m = this.core.world;
    this.dressing = createWorldDressing({
      art,
      sprites: worldArt,
      trees: m.trees,
      center: CENTER,
      ancientTree: m.ancientTree,
      nearTrail: m.nearTrail,
      inWater: m.inWater,
    });
    this.createScenery();
    this.createCamp();
    this.createActors();
    this.chips = this.add
      .particles(0, 0, "forest", {
        frame: "chip",
        lifespan: 550,
        speed: { min: 30, max: 110 },
        angle: { min: 200, max: 340 },
        gravityY: 180,
        scale: 2,
        emitting: false,
        maxAliveParticles: 64,
      })
      .setDepth(5000);
    this.player = this.add
      .sprite(1600, 1720, "forest", "characters.player.down.0")
      .setOrigin(0.5, 44 / 46)
      .setScale(2);
    this.axe = this.add
      .sprite(1620, 1704, "forest", "axes.0.0")
      .setOrigin(0.5, 19 / 24)
      .setScale(2);
    this.camera = this.cameras.main;
    this.camera
      .setBounds(0, 0, WORLD.width, WORLD.height)
      .startFollow(this.playerModel, true, 1, 1, 0, 160);
    this.camera.roundPixels = true;
    this.boundary = this.add.graphics().setDepth(4900);
    this.audio = createForestAudio();
    this.atmosphere = new Atmosphere(this);
    this.bindInput();
    this.bindDialogs();
    this.scene.launch("Hud", { world: this });
    document.querySelector("#loading")?.remove();
    this.renderModel();
    this.game.events.on(Phaser.Core.Events.BLUR, this.onBlur, this);
    this.game.events.on(Phaser.Core.Events.FOCUS, this.onFocus, this);
    this.game.events.on(Phaser.Core.Events.HIDDEN, this.onHidden, this);
    this.game.events.on(Phaser.Core.Events.VISIBLE, this.onVisible, this);
    this.events.once("shutdown", () => this.cleanup());
    window.lumberPhaser = {
      game: this.game,
      scene: this,
      core: this.core,
      shop: this.shop,
      assets: this.assets,
      step: (dt) => {
        this.step(dt);
        this.scene.get("Hud").refresh();
      },
      get renderer() {
        return this.game.renderer.type === Phaser.WEBGL ? "WebGL" : "Canvas";
      },
    };
  }
  addImage(key, x, y, depth = y) {
    return this.assets.image(key, snap(x), snap(y), depth);
  }
  text(text, x, y, size = 12, color = "#f0e1ad", depth = 4500) {
    return this.add
      .text(snap(x), snap(y), text, {
        fontFamily: "monospace",
        fontSize: `${size}px`,
        color,
        stroke: "#203b2b",
        strokeThickness: 1,
      })
      .setOrigin(0.5)
      .setDepth(depth);
  }
  sceneryKey(p) {
    if (p.type === "sapling") return `world.saplings.${p.variant || 0}`;
    if (p.type === "clothes") return "world.clothes.0";
    return this.assets.meta.has(`world.${p.type}`)
      ? `world.${p.type}`
      : `details.${p.type}.${p.variant || 0}`;
  }
  createScenery() {
    for (const group of [
      this.dressing.ground,
      this.dressing.plants,
      this.dressing.siteItems,
      this.dressing.details,
    ])
      for (const p of group) {
        const image = this.addImage(
          this.sceneryKey(p),
          p.x,
          p.y,
          group === this.dressing.ground ? -5000 : p.y,
        );
        this.staticObjects.push({ image, p });
      }
    for (const p of this.core.world.landmarks) {
      let key = {
        arch: "world.arch",
        spring: "world.spring",
        log: "world.log",
        camp: "oldTent",
        wagon: "cart",
        logging: "world.log",
      }[p.type];
      if (key)
        this.staticObjects.push({ image: this.addImage(key, p.x, p.y), p });
      else {
        const g = this.add.graphics().setDepth(p.y);
        if (p.type === "ruins")
          for (let c = 0; c < 5; c++)
            for (let r = 0; r < (c === 2 ? 1 : 3); r++) {
              const x = snap(p.x - 50 + c * 22 + (r % 2) * 4),
                y = snap(p.y - r * 18 - 18);
              g.fillStyle(0x53604b).fillRect(x, y, 20, 16);
              g.fillStyle(0x9eaa86).fillRect(x + 2, y + 2, 16, 10);
            }
        else {
          g.fillStyle(0x60452d).fillRect(p.x - 26, p.y - 30, 52, 36);
          g.fillStyle(0xbe914e).fillRect(p.x - 24, p.y - 28, 48, 14);
          g.fillStyle(0xdab56c)
            .fillRect(p.x - 17, p.y - 29, 4, 34)
            .fillRect(p.x + 15, p.y - 29, 4, 34);
        }
        this.staticObjects.push({ image: g, p });
      }
    }
    const b = this.core.world.bridge,
      g = this.add.graphics().setDepth(-4000);
    g.fillStyle(0x655038).fillRect(b.x - 94, b.y - 36, 188, 72);
    for (let i = 0; i < 15; i++)
      g.fillStyle(i % 2 ? 0xba8b4d : 0xc69b5b).fillRect(
        snap(b.x - 90 + i * 12),
        b.y - 32,
        10,
        64,
      );
    for (const sy of [-1, 1])
      g.fillStyle(0x785330).fillRect(b.x - 90, b.y + sy * 31, 180, 4);
  }
  createCamp() {
    this.stall = this.addImage("stall", CAMP.stall.x, CAMP.stall.y)
      .setInteractive({ pixelPerfect: true })
      .setData("shop", true);
    this.merchantTent = this.addImage(
      "merchantTent",
      CAMP.merchant.x,
      CAMP.merchant.y,
    )
      .setInteractive({ pixelPerfect: true })
      .setData("shop", true);
    this.merchant = this.addImage(
      "merchant",
      CAMP.merchant.x,
      CAMP.merchant.y + 36,
    );
    this.ancient = this.addImage(
      "ancient",
      this.core.world.ancientTree.x,
      this.core.world.ancientTree.y,
    )
      .setInteractive({ pixelPerfect: true })
      .setData("ancient", true);
    this.fire = this.add
      .sprite(CENTER.x, CENTER.y, "forest", "unlitFire")
      .setOrigin(0.5, 34 / 40)
      .setScale(2)
      .setDepth(CENTER.y + 8);
    this.anims.create({
      key: "fire.loop",
      frames: [0, 1, 2].map((i) => ({ key: "forest", frame: `fire.${i}` })),
      frameRate: 7,
      repeat: -1,
    });
    this.tent = this.addImage("tent", CAMP.tent.x, CAMP.tent.y).setVisible(
      false,
    );
    this.hut = this.addImage("house", CAMP.hut.x, CAMP.hut.y).setVisible(false);
    if (this.textures.exists("construction"))
      this.textures.remove("construction");
    this.partialTexture = this.textures.createCanvas("construction", 192, 192);
    this.partialTexture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.partial = this.add
      .image(0, 0, "construction")
      .setOrigin(0.5, 176 / 192)
      .setScale(2)
      .setVisible(false);
    this.campDecor = [];
    this.fences = [];
    for (const p of this.dressing.campItems)
      this.campDecor.push({
        image: this.addImage(this.sceneryKey(p), p.x, p.y).setVisible(false),
        p,
      });
    for (const [pad, label, color] of [
      [this.core.sale, "ПРОДАТЬ", 0xcbaa58],
      [this.core.build, "СТРОИТЬ", 0x82b3a4],
    ]) {
      this.add
        .rectangle(pad.x, pad.y, 98, 58, color)
        .setStrokeStyle(4, 0x7a7148)
        .setDepth(-1000);
      this.text(label, pad.x, pad.y, 13, "#415235", -999);
    }
    this.saleLabel = this.text(
      "",
      this.core.sale.x,
      this.core.sale.y + 54,
      11,
      "#304c35",
    );
    this.buildLabel = this.text(
      "",
      this.core.build.x,
      this.core.build.y + 54,
      12,
      "#304c35",
    );
    this.text(
      "ЛЕСНАЯ ЛАВКА",
      CAMP.stall.x,
      CAMP.stall.y - 22,
      11,
      "#4c3928",
      CAMP.stall.y + 0.1,
    );
    this.text(
      "ТОРГОВЕЦ",
      CAMP.merchant.x,
      CAMP.merchant.y - 222,
      12,
      "#e9d89c",
      CAMP.merchant.y + 0.2,
    );
  }
  createActors() {
    for (const tree of this.core.trees) {
      const key = `trees.${tree.type}.${tree.size}`,
        image = this.addImage(key, tree.x, tree.y)
          .setInteractive({ pixelPerfect: true })
          .setData("tree", tree);
      this.treeObjects.set(tree.id, { image, tree, key });
    }
  }
  bindInput() {
    this.input.setTopOnly(false);
    const codes = Phaser.Input.Keyboard.KeyCodes;
    this.keyMap = {
      KeyW: codes.W,
      KeyA: codes.A,
      KeyS: codes.S,
      KeyD: codes.D,
      ArrowUp: codes.UP,
      ArrowLeft: codes.LEFT,
      ArrowDown: codes.DOWN,
      ArrowRight: codes.RIGHT,
    };
    this.keyboard = {};
    for (const [name, code] of Object.entries(this.keyMap))
      this.keyboard[name] = this.input.keyboard.addKey(code, false, false);
    this.input.keyboard.on("keydown", (event) => {
      if (!this.core.paused && event.code === "KeyE") {
        const clue = this.atmosphere.nearestClue();
        if (clue) this.openClue(clue);
        else if (
          Math.hypot(
            this.playerModel.x - CAMP.merchant.x,
            this.playerModel.y - CAMP.merchant.y,
          ) < 150
        )
          this.shop.open();
      }
      if (!this.core.paused && event.code in this.keyMap)
        event.preventDefault();
    });
    this.input.on("pointerdown", (pointer, over) => {
      if (this.core.paused || pointer.button !== 0) return;
      const size = this.scale.width < 600 ? 100 : 144;
      if (pointer.x > this.scale.width - size - 20 && pointer.y < size + 52)
        return;
      const nearby = over
        .filter(
          (o) =>
            o.getData("tree") &&
            Math.hypot(
              o.getData("tree").x - this.playerModel.x,
              o.getData("tree").y - this.playerModel.y,
            ) < 72,
        )
        .sort(
          (a, b) =>
            Math.hypot(a.x - this.playerModel.x, a.y - this.playerModel.y) -
            Math.hypot(b.x - this.playerModel.x, b.y - this.playerModel.y),
        )[0];
      const object =
        over.find((o) => o.getData("shop")) ||
        over.find((o) => o.getData("clue")) ||
        nearby ||
        over.find((o) => o.getData("tree") || o.getData("ancient"));
      if (object?.getData("shop")) {
        this.shop.open();
        return;
      }
      if (object?.getData("clue")) {
        const clue = object.getData("clue");
        if (
          Math.hypot(clue.x - this.playerModel.x, clue.y - this.playerModel.y) <
          140
        )
          this.openClue(clue);
        else this.core.setDestination(clue.x, clue.y + 24);
        return;
      }
      const p = this.camera.getWorldPoint(pointer.x, pointer.y),
        tree = object?.getData("tree");
      if (object?.getData("ancient")) {
        this.core.setDestination(
          this.core.world.ancientTree.x,
          this.core.world.ancientTree.y + 90,
        );
        return;
      }
      if (
        tree &&
        Math.hypot(tree.x - this.playerModel.x, tree.y - this.playerModel.y) <
          72
      ) {
        if (this.playerModel.clickTimer <= 0) {
          this.core.hitTree(tree);
          this.playerModel.clickTimer = this.core.state.clickInterval;
        }
        return;
      }
      this.core.setDestination(tree ? tree.x : p.x, tree ? tree.y + 42 : p.y);
    });
  }
  bindDialogs() {
    this.shop = createShop(this.core.state, {
      onOpen: () => this.pause("shop", true),
      onChange: () => {
        this.playerModel.speed = this.core.state.runSpeed;
        this.renderModel();
      },
    });
    this.closeShop = () => this.pause("shop", false);
    document
      .querySelector("#shopDialog")
      .addEventListener("close", this.closeShop);
    this.openShop = () => this.shop.open();
    document
      .querySelector("#shopButton")
      .addEventListener("click", this.openShop);
    this.effectsLight = false;
    document.querySelector("#effectsBtn").textContent = "Эффекты: полные";
    document.querySelector("#effectsBtn").setAttribute("aria-pressed", "false");
    document.querySelector("#sound").textContent = "Включить звуки леса";
    document.querySelector("#sound").setAttribute("aria-pressed", "false");
    this.toggleEffects = () => {
      this.effectsLight = !this.effectsLight;
      this.atmosphere.setQuality(this.effectsLight ? "light" : "full");
      const b = document.querySelector("#effectsBtn");
      b.textContent = this.effectsLight ? "Эффекты: лёгкие" : "Эффекты: полные";
      b.setAttribute("aria-pressed", String(this.effectsLight));
    };
    document
      .querySelector("#effectsBtn")
      .addEventListener("click", this.toggleEffects);
    this.toggleSound = async () => {
      const b = document.querySelector("#sound");
      try {
        await this.audio.toggle();
        b.textContent = this.audio.enabled
          ? "Звуки леса: вкл"
          : "Включить звуки леса";
        b.setAttribute("aria-pressed", String(this.audio.enabled));
      } catch {
        b.textContent = "Звук недоступен";
      }
    };
    document
      .querySelector("#sound")
      .addEventListener("click", this.toggleSound);
    this.closeClue = () => this.pause("clue", false);
    this.dismissClue = () => document.querySelector("#clueDialog").close();
    document
      .querySelector("#clueDialog")
      .addEventListener("close", this.closeClue);
    document
      .querySelector("#clueClose")
      .addEventListener("click", this.dismissClue);
  }
  openClue(clue) {
    this.atmosphere.mystery.read.add(clue.id);
    document.querySelector("#clueTitle").textContent = clue.name;
    document.querySelector("#clueText").textContent = clue.text;
    this.pause("clue", true);
    if (!document.querySelector("#clueDialog").open)
      document.querySelector("#clueDialog").showModal();
  }
  pause(reason, active) {
    if (active) this.pauseReasons.add(reason);
    else this.pauseReasons.delete(reason);
    const paused = this.pauseReasons.size > 0;
    this.core.paused = paused;
    const hud = this.scene.get("Hud");
    if (hud?.tweens) {
      if (paused) hud.tweens.pauseAll();
      else hud.tweens.resumeAll();
    }
    this.audio?.setPaused(paused);
    this.input.keyboard.resetKeys();
    if (paused) {
      this.chips?.pause();
      this.tweens.pauseAll();
      this.anims.pauseAll();
    } else {
      this.chips?.resume();
      this.tweens.resumeAll();
      this.anims.resumeAll();
    }
  }
  onBlur() {
    this.pause("blur", true);
  }
  onFocus() {
    this.pause("blur", false);
  }
  onHidden() {
    this.pause("hidden", true);
  }
  onVisible() {
    this.pause("hidden", false);
  }
  step(dt) {
    this.core.keys.clear();
    if (!this.core.paused)
      for (const [name, key] of Object.entries(this.keyboard))
        if (key.isDown) this.core.keys.add(name);
    this.core.update(dt);
    this.atmosphere.update(dt);
    this.renderModel();
  }
  update(time, delta) {
    if (!this.manual) this.step(Math.min(delta / 1000, 0.05));
    else this.renderModel();
  }
  animatePerson(sprite, role, body, mood = "neutral") {
    const dir =
      body.direction === "up"
        ? "up"
        : ["left", "right"].includes(body.direction)
          ? "side"
          : "down";
    const prefix =
      mood === "neutral"
        ? `characters.${role}.${dir}`
        : `people.${role}.${mood}.${dir}`;
    if (body.moving) sprite.play(`walk.${role}.${mood}.${dir}`, true);
    else {
      sprite.stop();
      sprite.setFrame(`${prefix}.0`);
      if (
        dir === "down" &&
        mood === "neutral" &&
        Math.floor(this.core.elapsed * 10 + (body.id ?? 0)) % 53 < 2
      )
        sprite.setFrame(`idle.${role}.blink`);
      if (
        (role !== "player" && body.thanks > 0) ||
        (role === "player" && body.celebration > 0)
      )
        sprite.setFrame(`idle.${role}.cheer`);
      else if (
        role !== "player" &&
        this.core.nightAmount() > 0.6 &&
        Math.floor(this.core.elapsed + (body.id ?? 0)) % 17 < 2
      )
        sprite.setFrame(`idle.${role}.yawn`);
    }
    sprite.setFlipX(body.direction === "left").setDepth(body.y);
  }
  renderModel() {
    const c = this.core,
      s = c.state,
      p = c.player,
      t = c.elapsed;
    this.player.setPosition(
      snap(p.x),
      snap(p.y) -
        (p.moving
          ? (Math.floor(t * 9) % 2) * 2
          : p.celebration > 0
            ? (Math.floor(t * 7) % 2) * 4
            : 0),
    );
    this.animatePerson(
      this.player,
      "player",
      p,
      p.swing > 0
        ? "focused"
        : p.celebration > 0
          ? "happy"
          : s.wood / s.maxWood > 0.75
            ? "tired"
            : "neutral",
    );
    if (p.swing <= 0) {
      this.axe.stop();
      this.axe.setFrame(`axes.${s.axeLevel}.0`);
    }
    this.axe
      .setPosition(
        snap(p.x + (p.direction === "left" ? -20 : 20)),
        snap(p.y - 16),
      )
      .setFlipX(p.direction === "left")
      .setDepth(p.y + 0.03);
    const count = Math.min(s.wood, 40);
    while (this.cargo.length < count)
      this.cargo.push(this.addImage("log", 0, 0));
    for (let i = 0; i < this.cargo.length; i++) {
      const hidden = [...this.flights].some(
          (f) => f.kind === "pickup" && f.index === i,
        ),
        height = i / Math.max(1, count - 1),
        load = Math.min(s.wood / 20, 1.5);
      this.cargo[i]
        .setVisible(i < count && !hidden)
        .setPosition(
          snap(
            p.x +
              (p.moving
                ? Math.sin(t * 9 - height * 1.8) * (2 + height * 11) * load
                : 0),
          ),
          snap(p.y - 4 - i * 9),
        )
        .setDepth(p.y + 0.04 + i * 0.0001);
    }
    this.syncTrees();
    this.syncBuyers();
    this.syncPiles();
    this.syncCamp();
    for (const [image, x, y] of [
      [this.hut, CAMP.hut.x, CAMP.hut.y],
      [this.tent, CAMP.tent.x, CAMP.tent.y],
      [this.merchantTent, CAMP.merchant.x, CAMP.merchant.y],
    ])
      image.setAlpha(
        p.y < y &&
          p.y > y - image.displayHeight &&
          Math.abs(p.x - x) < image.displayWidth * 0.4
          ? 0.48
          : 1,
      );
    const buyer = c.activeBuyer();
    this.saleLabel.setText(
      buyer
        ? `${buyer.kind === "cart" ? "Тележка" : "Покупатель"} ${buyer.load}/${buyer.capacity}`
        : s.worldTime / DAY_SECONDS >= 0.5
          ? "До утра закрыто"
          : "Ждём покупателя",
    );
    this.buildLabel.setText(
      c.stages[s.campLevel]
        ? `${c.stages[s.campLevel].name} ${s.buildWood}/${c.stages[s.campLevel].cost}`
        : "Лагерь построен",
    );
    this.camera?.preRender();
    this.refreshView();
    this.atmosphere.render();
    const hudKey = [
      s.wood,
      s.maxWood,
      s.coins,
      s.campLevel,
      s.buildWood,
      c.notice,
    ].join(":");
    if (hudKey !== this.lastHudKey) {
      this.lastHudKey = hudKey;
      document.querySelector("#wood").textContent = `${s.wood} / ${s.maxWood}`;
      document.querySelector("#coins").textContent = s.coins;
      document.querySelector("#shopButton").textContent =
        `Лавка · ${s.coins} монет`;
      document.querySelector("#campInfo").textContent =
        `Лагерь ${s.campLevel}/4 · Радиус леса: ${c.forestRadius()}`;
      document.querySelector("#status").textContent =
        c.notice ||
        (s.wood >= s.maxWood
          ? "Руки заняты — продайте брёвна или вложите их в лагерь. Остаток ждёт на земле."
          : "Золотая площадка — продажа, голубая — строительство лагеря.");
    }
  }
  syncTrees() {
    const p = this.playerModel,
      view = this.camera?.worldView;
    for (const { image, tree, key } of this.treeObjects.values()) {
      const stage = growthStage(tree, this.core.dayNumber),
        frame =
          stage === 0
            ? "stump"
            : stage === 1
              ? `world.saplings.${tree.legacyIndex % 2}`
              : stage === 3 &&
                  !tree.shake &&
                  tree.type !== "dead" &&
                  !this.effectsLight
                ? (() => {
                    const phase = [0, 1, 0, -1][
                      Math.floor(
                        this.core.elapsed * 1.4 + tree.legacyIndex * 0.7,
                      ) % 4
                    ];
                    return phase
                      ? `wind.${tree.type}.${tree.size}.${phase}`
                      : key;
                  })()
                : key;
      if (image.frame.name !== frame) this.assets.setFrame(image, frame);
      image
        .setScale(stage === 1 || stage === 2 ? 1 : 2)
        .setPosition(
          snap(tree.x + (tree.shake ? Math.sin(tree.shake * 90) * 4 : 0)),
          snap(tree.y),
        );
      image.input.enabled = tree.hp > 0 && this.core.treeAccessible(tree);
      image
        .setVisible(!view || this.nearView(tree, view, 270))
        .setAlpha(
          tree.hp > 0 &&
            p.y < tree.y &&
            p.y > tree.y - image.displayHeight + 20 &&
            Math.abs(p.x - tree.x) < image.displayWidth * 0.4
            ? 0.45
            : 1,
        );
    }
  }
  syncPiles() {
    for (const [id, objects] of this.pileObjects)
      if (!this.core.forestry.piles.has(id)) {
        objects.forEach((o) => o.destroy());
        this.pileObjects.delete(id);
      }
    for (const [id, p] of this.core.forestry.piles) {
      if (!this.pileObjects.has(id))
        this.pileObjects.set(id, [
          this.addImage("log", p.x - 7, p.y, p.y),
          this.addImage("log", p.x + 9, p.y - 7, p.y + 0.001),
          this.addImage("log", p.x - 7, p.y - 14, p.y + 0.002),
          this.text("", p.x, p.y + 22, 12),
        ]);
      const a = this.pileObjects.get(id);
      for (let i = 0; i < 3; i++) a[i].setVisible(i < p.count);
      a[3]
        .setText(`×${p.count}`)
        .setVisible(
          Math.hypot(p.x - this.playerModel.x, p.y - this.playerModel.y) < 160,
        );
    }
  }
  syncBuyers() {
    for (const [id, a] of this.customerObjects)
      if (!this.core.buyers.some((b) => b.id === id)) {
        a.sprite.destroy();
        a.cart?.destroy();
        a.logs.forEach((i) => i.destroy());
        a.label.destroy();
        this.customerObjects.delete(id);
      }
    for (const b of this.core.buyers) {
      let a = this.customerObjects.get(b.id);
      if (!a) {
        a = {
          sprite: this.add
            .sprite(b.x, b.y, "forest", "characters.buyerA.down.0")
            .setOrigin(0.5, 44 / 46)
            .setScale(2),
          logs: [],
          cart:
            b.kind === "cart"
              ? this.addImage("cart", b.x + 44, b.y + 10)
              : null,
          label: this.text("", b.x, b.y + 28, 11),
        };
        this.customerObjects.set(b.id, a);
      }
      a.sprite.setPosition(snap(b.x), snap(b.y));
      this.animatePerson(
        a.sprite,
        b.kind === "walker" ? "buyerA" : "buyerB",
        b,
        b.thanks > 0 ? "happy" : "neutral",
      );
      a.cart?.setPosition(snap(b.x + 44), snap(b.y + 10)).setDepth(b.y - 0.01);
      while (a.logs.length < b.load) a.logs.push(this.addImage("log", 0, 0));
      for (let i = 0; i < a.logs.length; i++) {
        const hidden = [...this.flights].some(
          (f) => f.target?.follow === b && f.target.slot === i,
        );
        a.logs[i]
          .setVisible(i < b.load && !hidden)
          .setPosition(
            snap(b.x + (b.kind === "cart" ? 30 + (i % 2) * 24 : 0)),
            snap(
              b.y +
                (b.kind === "cart" ? -28 - Math.floor(i / 2) * 9 : -4 - i * 9),
            ),
          )
          .setDepth(b.y + 0.05 + i * 0.0001);
      }
      a.label
        .setPosition(snap(b.x), snap(b.y + 28))
        .setText(`${b.load}/${b.capacity}`)
        .setVisible(
          Math.hypot(b.x - this.playerModel.x, b.y - this.playerModel.y) < 180,
        );
    }
  }
  syncCamp() {
    const s = this.core.state,
      key = `${s.campLevel}:${s.buildWood}`;
    if (key === this.lastCampKey) return;
    this.lastCampKey = key;
    this.fire.setVisible(s.campLevel > 0);
    if (s.campLevel > 0) this.fire.play("fire.loop", true);
    this.tent.setVisible(s.campLevel >= 2 && s.campLevel < 4);
    this.hut.setVisible(s.campLevel === 4);
    this.partial.setVisible(s.buildWood > 0 && s.campLevel !== 2);
    if (this.partial.visible) {
      const site = bakeConstruction(
        this.partialTexture.getContext(),
        this.assets.art,
        s,
      );
      this.partialTexture.refresh();
      this.partial.setPosition(site.x, site.y).setDepth(site.y);
    }
    for (const f of this.fences) f.destroy();
    this.fences = [];
    for (const [a, b] of this.core.nav.campFenceSegments()) {
      const g = this.add.graphics().setDepth((a.y + b.y) / 2);
      for (const rise of [23, 11])
        g.lineStyle(6, 0x5c432b)
          .lineBetween(snap(a.x), snap(a.y - rise), snap(b.x), snap(b.y - rise))
          .lineStyle(2, 0xcba064)
          .lineBetween(
            snap(a.x),
            snap(a.y - rise),
            snap(b.x),
            snap(b.y - rise),
          );
      this.fences.push(g);
    }
    for (const p of this.core.nav.campFencePosts())
      this.fences.push(this.addImage("fence", p.x, p.y, p.y + 1));
    for (const { image, p } of this.campDecor)
      image.setVisible(s.campLevel >= p.min && s.campLevel <= (p.max ?? 4));
  }
  nearView(p, v, margin = 120) {
    return (
      p.x > v.x - margin &&
      p.x < v.right + margin &&
      p.y > v.y - margin &&
      p.y < v.bottom + margin
    );
  }
  refreshView() {
    if (!this.camera) return;
    const v = this.camera.worldView;
    this.terrain.update({ x: v.x, y: v.y, width: v.width, height: v.height });
    for (const { image, p } of this.staticObjects)
      image.setVisible(
        this.nearView(p, v, 160) &&
          (!p.tree || p.tree.hp <= 0 || p.tree.legacyIndex % 2 !== 0),
      );
    const radius = Math.round(this.atmosphere.radius / 2) * 2;
    if (radius !== this.boundaryRadius) {
      this.boundaryRadius = radius;
      const g = this.boundary.clear().fillStyle(0x142f29, 0.91);
      for (let i = 0; i < 96; i++) {
        const a = (i / 96) * Math.PI * 2,
          b = ((i + 1) / 96) * Math.PI * 2;
        g.fillPoints(
          [
            { x: 1600 + Math.cos(a) * radius, y: 1600 + Math.sin(a) * radius },
            { x: 1600 + Math.cos(a) * 4800, y: 1600 + Math.sin(a) * 4800 },
            { x: 1600 + Math.cos(b) * 4800, y: 1600 + Math.sin(b) * 4800 },
            { x: 1600 + Math.cos(b) * radius, y: 1600 + Math.sin(b) * radius },
          ],
          true,
        );
      }
      g.lineStyle(4, 0xe4d28c, 0.8).strokeCircle(1600, 1600, radius);
    }
  }
  onModelEvent(type, e) {
    if (type === "hit") {
      this.audio?.hit();
      this.axe?.play(`chop.${this.core.state.axeLevel}`);
      this.chips?.explode(this.effectsLight ? 3 : 8, e.tree.x, e.tree.y - 12);
      this.float(`−${e.damage}`, e.tree.x, e.tree.y - 55, "#f5e3b8");
    } else if (type === "fell") {
      if (this.falls.length >= 4) {
        const oldest = this.falls.shift();
        this.tweens.killTweensOf(oldest);
        oldest.destroy();
      }
      const image = this.addImage(
        `trees.${e.tree.type}.${e.tree.size}`,
        e.tree.x,
        e.tree.y,
        e.tree.y + 0.001,
      );
      this.falls.push(image);
      this.tweens.add({
        targets: image,
        angle: this.playerModel.x < e.tree.x ? 86 : -86,
        duration: 720,
        ease: "Cubic.easeIn",
        onComplete: () =>
          this.tweens.add({
            targets: image,
            alpha: 0,
            duration: 280,
            onComplete: () => {
              this.falls = this.falls.filter((i) => i !== image);
              image.destroy();
            },
          }),
      });
    } else if (type === "pickup")
      this.fly({ kind: "pickup", index: e.index, start: e.pile });
    else if (type === "transfer") {
      this.fly(e);
      if (e.kind === "sell") this.audio?.sale();
    } else if (type === "text") this.float(e.text, e.x, e.y, e.color);
    else if (type === "expansion") {
      this.expansionBanner = e;
      this.atmosphere?.expand(e);
    }
  }
  float(text, x, y, color = "#f5e3b8") {
    if (this.labels.length >= 32) {
      const old = this.labels.shift();
      this.tweens.killTweensOf(old);
      old.destroy();
    }
    const label = this.text(text, x, y, 14, color, 5100);
    this.labels.push(label);
    this.tweens.add({
      targets: label,
      y: y - 38,
      alpha: 0,
      duration: 1000,
      onComplete: () => {
        this.labels = this.labels.filter((l) => l !== label);
        label.destroy();
      },
    });
  }
  fly(event) {
    if (this.flights.size >= 16) {
      const oldest = this.flights.values().next().value;
      this.tweens.killTweensOf(oldest);
      oldest.image.destroy();
      this.flights.delete(oldest);
    }
    const f = {
      ...event,
      progress: 0,
      image: this.addImage("log", event.start.x, event.start.y, 5050),
    };
    this.flights.add(f);
    this.tweens.add({
      targets: f,
      progress: 1,
      duration: event.kind === "pickup" ? 780 : 550,
      onUpdate: () => {
        const target =
          event.kind === "pickup"
            ? {
                x: this.playerModel.x,
                y:
                  this.playerModel.y -
                  4 -
                  Math.min(
                    39,
                    Math.max(0, this.core.state.wood - 1),
                    event.index,
                  ) *
                    9,
              }
            : event.target.follow
              ? {
                  x: event.target.follow.x + event.target.dx,
                  y: event.target.follow.y + event.target.dy,
                }
              : event.target;
        const t = Phaser.Math.Easing.Sine.InOut(f.progress);
        f.image.setPosition(
          snap(event.start.x + (target.x - event.start.x) * t),
          snap(
            event.start.y +
              (target.y - event.start.y) * t -
              Math.sin(f.progress * Math.PI) * 26,
          ),
        );
      },
      onComplete: () => {
        f.image.destroy();
        this.flights.delete(f);
      },
    });
  }
  cleanup() {
    this.game.events.off(Phaser.Core.Events.BLUR, this.onBlur, this);
    this.game.events.off(Phaser.Core.Events.FOCUS, this.onFocus, this);
    this.game.events.off(Phaser.Core.Events.HIDDEN, this.onHidden, this);
    this.game.events.off(Phaser.Core.Events.VISIBLE, this.onVisible, this);
    document
      .querySelector("#shopDialog")
      .removeEventListener("close", this.closeShop);
    document
      .querySelector("#shopButton")
      .removeEventListener("click", this.openShop);
    document
      .querySelector("#effectsBtn")
      .removeEventListener("click", this.toggleEffects);
    document.querySelector("#shopDialog").close();
    document
      .querySelector("#sound")
      .removeEventListener("click", this.toggleSound);
    document
      .querySelector("#clueDialog")
      .removeEventListener("close", this.closeClue);
    document
      .querySelector("#clueClose")
      .removeEventListener("click", this.dismissClue);
    document.querySelector("#clueDialog").close();
    this.audio.destroy();
    this.atmosphere.destroy();
    this.textures.remove("construction");
    this.shop.destroy();
    this.terrain.destroy();
    this.scene.stop("Hud");
    for (const key of Object.keys(this.anims.anims.entries))
      if (
        key.startsWith("walk.") ||
        key.startsWith("chop.") ||
        key === "fire.loop"
      )
        this.anims.remove(key);
    delete window.lumberPhaser;
  }
}
