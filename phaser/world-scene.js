import { renderGeneratedPerson } from "./people-assets.js";
import { WorkerView } from "./worker-view.js";
import { createWorkerUi } from "./worker-ui.js";
import { createExplorationUi } from "./exploration-ui.js";
import { ExplorationView } from "./exploration-view.js";
import { shopAdvice } from "../game/first-days.js";
import { StackView } from "./stack-view.js";
import { BuyerView } from "./buyer-view.js";
import { DefenseView } from "./defense-view.js";
import { createDefenseUi } from "./defense-ui.js";
import { EnemyView } from "./enemy-view.js";
import { createSurvivalUi } from "./survival-ui.js";
import { stackOffset } from "../game/stack-layout.js";
import { LAYERS } from "./layers.js";
import { createRegionMap } from "./region-map.js";
import { RegionView } from "./region-view.js";
import { CampView } from "./camp-view.js";
import { HeroView } from "./hero-view.js";
import { ChoppingFeedback } from "./chopping-feedback.js";
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
    this.accumulator = 0;
    this.hudReady = false;
    this.boundaryRadius = null;
    this.expansionBanner = null;
    this.lastHudKey = null;
    this.assets = createAtlas(this);
    this.anims.resumeAll();
    this.core = createSimulation({
      regional: true,
      appearance: this.registry.get("heroAppearance"),
      emit: (type, event) => this.onModelEvent(type, event),
    });
    this.playerModel = this.core.player;
    this.merchantSite = this.core.world.merchant || CAMP.merchant;
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
    this.dressing = m.regional
      ? { campItems: m.campItems }
      : createWorldDressing({
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
    this.campView = new CampView(this);
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
      .setDepth(LAYERS.particles);
    this.heroView = new HeroView(this);
    this.player = this.heroView.player;
    this.axe = this.heroView.axe;
    this.feedback = new ChoppingFeedback(this);
    this.stackView = new StackView(this);
    this.cargo = this.stackView.logs;
    this.buyerView = new BuyerView(this);
    this.enemyView = new EnemyView(this);
    this.defenseView = new DefenseView(this);
    this.explorationView = new ExplorationView(this);
    this.workerView = new WorkerView(this);
    this.camera = this.cameras.main;
    this.camera
      .setBounds(
        this.core.world.bounds?.x || 0,
        this.core.world.bounds?.y || 0,
        this.core.world.bounds?.width || WORLD.width,
        this.core.world.bounds?.height || WORLD.height,
      )
      .startFollow(this.playerModel, true, 1, 1, 0, 160);
    this.camera.roundPixels = true;
    this.boundary = this.add.graphics().setDepth(LAYERS.border);
    this.audio = createForestAudio();
    this.atmosphere = new Atmosphere(this);
    this.bindInput();
    this.bindDialogs();
    this.regionMap = createRegionMap(this);
    this.returnCamp = () => this.core.navigateGuide("camp");
    document
      .querySelector("#campButton")
      .addEventListener("click", this.returnCamp);
    this.survivalUi = createSurvivalUi(this);
    this.defenseUi = createDefenseUi(this);
    this.explorationUi = createExplorationUi(this);
    this.workerUi = createWorkerUi(this);
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
  text(text, x, y, size = 12, color = "#f0e1ad", depth = LAYERS.labels) {
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
    if (this.core.regions) {
      this.regionView = new RegionView(this);
      return;
    }
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
      this.merchantSite.x,
      this.merchantSite.y,
    )
      .setInteractive({ pixelPerfect: true })
      .setData("site", "mysterious-merchant");
    this.merchant = this.addImage(
      "merchant",
      this.merchantSite.x,
      this.merchantSite.y + 36,
    )
      .setInteractive({ pixelPerfect: true })
      .setData("site", "mysterious-merchant");
    this.ancient = this.addImage(
      "ancient",
      this.core.world.ancientTree.x,
      this.core.world.ancientTree.y,
    )
      .setInteractive({ pixelPerfect: true })
      .setData("ancient", true)
      .setData("site", "ancient-roots");
    this.fire = this.add
      .sprite(CENTER.x, CENTER.y, "forest", "unlitFire")
      .setOrigin(
        this.assets.meta.get("unlitFire").originX,
        this.assets.meta.get("unlitFire").originY,
      )
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
      this.addImage(
        label === "ПРОДАТЬ" ? "camp.salePad" : "camp.buildPad",
        pad.x,
        pad.y,
        -1000,
      );
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
    this.merchantLabel = this.text(
      "ТОРГОВЕЦ",
      this.merchantSite.x,
      this.merchantSite.y - 222,
      12,
      "#e9d89c",
      this.merchantSite.y + 0.2,
    );
  }
  createActors() {
    if (this.core.regions) return;
    for (const tree of this.core.trees) {
      const key = `trees.${tree.type}.${tree.size}`,
        image = this.addImage(key, tree.x, tree.y)
          .setInteractive({ pixelPerfect: true })
          .setData("tree", tree);
      this.treeObjects.set(tree.id, { image, tree, key });
    }
  }
  bindInput() {
    this.fire
      .setInteractive({ pixelPerfect: true })
      .setData("site", "camp-kitchen");
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
      if (
        !this.core.paused &&
        this.core.exploration.fishing &&
        ["KeyE", "Space"].includes(event.code)
      ) {
        event.preventDefault();
        this.core.exploration.reel();
        return;
      }
      if (!this.core.paused && event.code === "KeyI") {
        event.preventDefault();
        this.explorationUi.openBag();
        return;
      }
      if (!this.core.paused && event.code === "KeyH") {
        event.preventDefault();
        this.workerUi.open();
        return;
      }
      if (!this.core.paused && event.code === "KeyB") {
        event.preventDefault();
        this.defenseUi.open();
        return;
      }
      if (!this.core.paused && event.code === "KeyJ") {
        event.preventDefault();
        this.survivalUi.open();
        return;
      }
      if (!this.core.paused && event.code === "KeyM") {
        event.preventDefault();
        this.regionMap.open();
        return;
      }
      if (!this.core.paused && event.code === "KeyE") {
        const clue = this.atmosphere.nearestClue();
        if (clue) {
          if (this.core.exploration.get(clue.id))
            this.core.exploration.request(clue.id);
          else this.openClue(clue);
        } else if (
          this.core.regions
            ?.frontiers()
            .some(
              (g) =>
                Math.hypot(g.x - this.playerModel.x, g.y - this.playerModel.y) <
                130,
            )
        ) {
          const gate = this.core.regions
            .frontiers()
            .find(
              (g) =>
                Math.hypot(g.x - this.playerModel.x, g.y - this.playerModel.y) <
                130,
            );
          this.core.setDestination(gate.x, gate.y);
        } else if (
          Math.hypot(
            this.playerModel.x - this.merchantSite.x,
            this.playerModel.y - this.merchantSite.y,
          ) < 150
        )
          this.core.exploration.request("mysterious-merchant");
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
        over.find((o) => o.getData("enemy")) ||
        over.find((o) => o.getData("shop")) ||
        over.find((o) => o.getData("workers")) ||
        over.find((o) => o.getData("site")) ||
        over.find((o) => o.getData("defense")) ||
        over.find((o) => o.getData("clue")) ||
        over.find((o) => o.getData("regionGate")) ||
        nearby ||
        over.find((o) => o.getData("tree") || o.getData("ancient"));
      if (object?.getData("workers")) {
        this.workerUi.open();
        return;
      }
      if (object?.getData("enemy")) {
        const id = object.getData("enemy");
        this.core.selectEnemy(id);
        this.core.tryAttack(id);
        return;
      }
      if (object?.getData("site")) {
        this.core.exploration.request(object.getData("site"));
        return;
      }
      if (object?.getData("defense")) {
        const id = object.getData("defense");
        if (!this.core.orderDefense(id))
          this.core.showNotice("Укрепление цело.");
        return;
      }
      if (object?.getData("shop")) {
        this.shop.open();
        return;
      }
      if (object?.getData("regionGate")) {
        const gate = object.getData("regionGate");
        this.core.setDestination(gate.x, gate.y);
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
        this.core.tryChop(tree.id);
        return;
      }
      this.core.setDestination(tree ? tree.x : p.x, tree ? tree.y + 42 : p.y);
    });
  }
  bindDialogs() {
    this.shop = createShop(this.core.state, {
      onOpen: () => this.pause("shop", true),
      purchase: (id) => this.core.purchaseUpgrade(id),
      recommendation: () => shopAdvice(this.core.state),
      onChange: () => {
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
    if (!this.core.readClue(clue.id)) return;
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
    const paused = this.pauseReasons.size > 0 || this.core.state.gameOver;
    if (paused) this.accumulator = 0;
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
      this.regionMap?.resume();
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
  readInput() {
    this.core.keys.clear();
    if (!this.core.paused)
      for (const [name, key] of Object.entries(this.keyboard))
        if (key.isDown) this.core.keys.add(name);
  }
  step(dt) {
    this.readInput();
    this.core.update(dt);
    this.atmosphere.update(dt);
    this.renderModel();
  }
  update(time, delta) {
    if (this.manual) {
      this.renderModel();
      return;
    }
    if (this.core.paused) {
      this.accumulator = 0;
      this.renderModel();
      return;
    }
    // 12 steps/frame absorbs a sustained 5 FPS without slowing the calendar.
    // A two-second backlog cap avoids a spiral after a suspended browser frame.
    this.accumulator = Math.min(2, this.accumulator + delta / 1000);
    this.readInput();
    let steps = 0;
    while (this.accumulator >= 1 / 60 && steps++ < 12 && !this.core.paused) {
      this.accumulator -= 1 / 60;
      this.core.update(1 / 60);
      this.atmosphere.update(1 / 60);
    }
    this.renderModel();
  }
  animatePerson(sprite, role, body, mood = "neutral") {
    if (renderGeneratedPerson(this, sprite, role, body, mood)) return;
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
    this.camera?.preRender();
    const c = this.core,
      s = c.state,
      p = c.player,
      t = c.elapsed;
    this.heroView.render();
    this.stackView.render();
    this.enemyView.render();
    this.syncTrees();
    this.syncBuyers();
    this.syncPiles();
    this.syncCamp();
    this.defenseView.render();
    this.explorationView.render();
    this.workerView.render();
    this.workerUi?.resume();
    this.explorationUi?.refresh();
    this.survivalUi?.resume();
    for (const [image, x, y] of [
      [this.hut, CAMP.hut.x, CAMP.hut.y],
      [this.tent, CAMP.tent.x, CAMP.tent.y],
      [this.merchantTent, this.merchantSite.x, this.merchantSite.y],
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
      s.campHealth < s.maxCampHealth
        ? `Ремонт ${s.campHealth}/${s.maxCampHealth} · 20 HP/бревно`
        : c.stages[s.campLevel]
          ? `${c.stages[s.campLevel].name} ${s.buildWood}/${c.stages[s.campLevel].cost}`
          : "Лагерь построен",
    );
    this.camera?.preRender();
    this.refreshView();
    this.atmosphere.render();
    this.campView.render();
    const openMerchant = this.core.accessible(this.merchantSite);
    this.merchantTent.setVisible(openMerchant);
    this.merchant.setVisible(openMerchant);
    this.merchantLabel?.setVisible(openMerchant);
    this.ancient.setVisible(this.core.accessible(this.core.world.ancientTree));
    this.feedback.render();
    const hudKey = [
      s.wood,
      s.maxWood,
      s.coins,
      s.campLevel,
      s.buildWood,
      c.notice,
      c.regions?.revision,
    ].join(":");
    if (hudKey !== this.lastHudKey) {
      this.lastHudKey = hudKey;
      document.querySelector("#wood").textContent = `${s.wood} / ${s.maxWood}`;
      document.querySelector("#coins").textContent = s.coins;
      document.querySelector("#shopButton").textContent =
        `Лавка · ${s.coins} монет`;
      document.querySelector("#campInfo").textContent = c.regions
        ? `Лагерь ${s.campLevel}/4 · Регионы ${s.unlockedRegions.length}/25`
        : `Лагерь ${s.campLevel}/4 · Радиус леса: ${c.forestRadius()}`;
      document.querySelector("#status").textContent =
        c.notice ||
        (s.wood >= s.maxWood
          ? "Руки заняты — продайте брёвна или вложите их в лагерь. Остаток ждёт на земле."
          : "Золотая площадка — продажа, голубая — строительство лагеря.");
    }
  }
  syncTrees() {
    const cameraView = this.camera?.worldView;
    if (this.core.regions && cameraView) {
      const margin = 420,
        view = {
          x: cameraView.x - margin,
          y: cameraView.y - margin,
          width: cameraView.width + margin * 2,
          height: cameraView.height + margin * 2,
        },
        wanted = new Set();
      for (const tree of this.core.world.treesNear(view))
        if (
          tree.x >= view.x &&
          tree.x <= view.x + view.width &&
          tree.y >= view.y &&
          tree.y <= view.y + view.height
        ) {
          wanted.add(tree.id);
          if (!this.treeObjects.has(tree.id)) {
            const key = `trees.${tree.type}.${tree.size}`,
              image = this.addImage(key, tree.x, tree.y)
                .setInteractive({ pixelPerfect: true })
                .setData("tree", tree);
            this.treeObjects.set(tree.id, { tree, key, image });
          }
        }
      for (const [id, entry] of this.treeObjects)
        if (!wanted.has(id)) {
          entry.image.destroy();
          this.treeObjects.delete(id);
        }
    }
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
        .setVisible(!view || this.nearView(tree, view, 420))
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
      if (
        !this.core.forestry.piles.has(id) ||
        !this.nearView(
          this.core.forestry.piles.get(id),
          this.camera.worldView,
          180,
        )
      ) {
        objects.forEach((o) => o.destroy());
        this.pileObjects.delete(id);
      }
    for (const [id, p] of this.core.forestry.piles) {
      if (!this.nearView(p, this.camera.worldView, 160)) continue;
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
    this.buyerView.render();
  }
  syncCamp() {
    const s = this.core.state,
      key = `${s.campLevel}:${s.buildWood}:${this.core.defenses?.revision}`;
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
    if (this.regionView) {
      this.regionView.sync(v);
      return;
    }
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
    if (type === "worker-hired") {
      this.core.showNotice(
        "Помощник нанят! Днём он добывает брёвна у древнего дуба. Управление командой — H.",
        7,
      );
      return;
    }
    if (type.startsWith("story-")) {
      this.survivalUi?.refreshBadge();
      if (type === "story-completed") {
        this.core.showNotice(
          `Глава «Чужой огонь» завершена! +${e.reward} монет.`,
          9,
        );
        this.float(`+${e.reward} монет`, CENTER.x, CENTER.y - 95, "#ffe296");
      } else if (type === "story-evidence")
        this.core.showNotice(
          `Найдена сюжетная улика: ${e.name}. Запись в дневнике.`,
          6,
        );
      else if (type === "story-progress")
        this.core.showNotice(`Чужой огонь · ${e.title}. Подробности — J.`, 6);
      return;
    }
    if (type === "site-ready") {
      this.explorationUi?.openSite(e.site);
      return;
    }
    if (type === "fish-caught") {
      this.explorationView?.caught();
      this.core.showNotice(
        "Окунь в сумке! Продайте торговцу или приготовьте у костра.",
        5,
      );
      return;
    }
    if (type === "fishing-ended") {
      this.core.showNotice(e.reason, 4);
      return;
    }
    if (type === "fish-bite") {
      this.core.showNotice("Клюёт! Нажмите «Подсечь», E или пробел.", 3);
      return;
    }
    if (type === "activity-completed") {
      if (e.action === "open-chest") {
        this.float(
          `+${e.loot.coins} монет · +1 реликвия`,
          e.site.x,
          e.site.y - 60,
          "#ffe296",
        );
        this.core.showNotice(
          "Печать снята. Сундук пуст; реликвию купит торговец на юге.",
          6,
        );
      } else if (e.action === "offer-logs") {
        this.float("+1 смола", e.site.x, e.site.y - 60, "#c3dfab");
        this.core.showNotice(
          "Корни приняли дар. Смола пригодится торговцу для лесной мази.",
          5,
        );
      }
      return;
    }
    if (type === "wave-ended") {
      const text =
        e.status === "won"
          ? `Налёт отражён! +${e.reward} монет`
          : e.status === "withdrawn"
            ? "Рассвет: враги отступили. Награды за налёт нет."
            : `Налёт завершён · сбежало: ${e.escaped} · +${e.reward} монет`;
      this.core?.showNotice(text, 9);
      if (e.reward)
        this.float(`+${e.reward} монет`, CENTER.x, CENTER.y - 90, "#ffe296");
      return;
    }
    if (type === "supplies-stolen" || type === "supplies-recovered") {
      this.core?.showNotice(
        type === "supplies-stolen"
          ? `Вор убегает! Унёс ${e.coins} монет. Догоните его!`
          : `Украденное возвращено: ${e.coins} монет`,
        6,
      );
      return;
    }
    if (type === "enemy-escaped") {
      this.core?.showNotice(`Вор скрылся. Потеряно ${e.coins} монет.`, 6);
      return;
    }
    if (type === "trap-triggered") {
      this.float("Ловушка! −3", e.trap.x, e.trap.y - 40, "#c6dba5");
      return;
    }
    if (type === "defense-changed" && e.topology) {
      this.float(
        e.section.hp ? "Укрепление готово" : "Пролом!",
        e.section.x,
        e.section.y - 45,
        "#eac08e",
      );
      return;
    }
    if (type === "night-warning") {
      this.audio?.watcherCue("waking", 0, 0);
      return;
    }
    if (type === "watcher-state") {
      const p = this.core.player,
        pan = Math.max(-0.85, Math.min(0.85, (e.x - p.x) / 400));
      this.audio?.watcherCue(
        e.phase,
        pan,
        Math.hypot(e.x - p.x, e.y - p.y),
        e.duration,
      );
      return;
    }
    if (type === "watcher-strike") {
      this.enemyView?.strike(e.area);
      return;
    }
    if (type === "watcher-left") {
      this.audio?.watcherCue("dawn", 0, 0);
      return;
    }
    if (type === "sunset-warning") {
      this.audio?.warning();
      return;
    }
    if (type === "attack") {
      this.audio?.hit();
      this.heroView?.hit();
      this.float(`−${e.damage}`, e.enemy.x, e.enemy.y - 70, "#e8bc8d");
      return;
    }
    if (type === "game-over") {
      this.survivalUi?.defeat(e);
      return;
    }
    if (type === "letter-received") {
      this.survivalUi?.refreshBadge();
      return;
    }
    if (type === "wave-started") {
      this.core?.showNotice?.(`Налётчики: ${e.count}`);
      return;
    }

    if (type === "region-open") {
      this.regionView?.opened(e.region);
      this.expansionBanner = { name: e.region.name };
      return;
    }
    if (type === "hit") {
      this.audio?.hit();
      this.heroView?.hit();
      this.feedback?.hit(e.tree);
      this.chips?.explode(
        this.effectsLight
          ? e.tree.hp === 0
            ? 4
            : 3
          : e.tree.hp === 0
            ? 12
            : 8,
        e.tree.x,
        e.tree.y - 12,
      );
      this.float(`−${e.damage}`, e.tree.x, e.tree.y - 55, "#f5e3b8");
    } else if (type === "fell") {
      this.feedback?.fell(e.tree);
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
    const label = this.text(text, x, y, 14, color, LAYERS.floating);
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
      image: this.addImage("log", event.start.x, event.start.y, LAYERS.flights),
    };
    this.flights.add(f);
    this.tweens.add({
      targets: f,
      progress: 1,
      duration: event.kind === "pickup" ? 780 : 550,
      onUpdate: () => {
        const slot = stackOffset(
          Math.min(Math.max(0, this.core.state.wood - 1), event.index ?? 0),
          this.core.state.wood,
        );
        const target =
          event.kind === "pickup"
            ? { x: this.playerModel.x + slot.x, y: this.playerModel.y + slot.y }
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
    document
      .querySelector("#campButton")
      .removeEventListener("click", this.returnCamp);
    this.survivalUi?.destroy();
    this.defenseUi?.destroy();
    this.explorationUi?.destroy();
    this.workerUi?.destroy();
    this.regionMap?.destroy();
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
