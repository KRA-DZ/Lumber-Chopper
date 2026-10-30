import { applyPeopleFrames } from "./people-assets.js";
import { biomeEnemyFrames } from "./biome-assets.js";
import { createWorkerArt } from "./art/worker-art.js";
import { createStoryArt } from "./art/story-art.js";
import { createExplorationArt } from "./art/exploration-art.js";
import { createSurvivalArt } from "./art/survival-art.js";
import { applyImportedArt, IMPORTED_ASSETS } from "./imported-art.js";
import { createCampArt } from "./art/camp-art.js";
import { HERO_WALK_FRAMES, STRIKE_MS } from "./art/hero-motion.js";
import { createForestArt } from "./art/forest-art.js";
import { createEnvironment } from "../environment.js";
import { sprite } from "../pixel-art.js";
import { createWorldArt } from "../world-art.js";

// Это загрузчик исходных спрайтов, а не отрисовка игры в одну Canvas-текстуру.
// Каждый кадр атласа доступен как обычный Phaser Image/Sprite.
export function createAtlas(scene) {
  if (scene.textures.exists("forest")) scene.textures.remove("forest");
  const art = applyImportedArt(scene, createForestArt()),
    worldArt = createWorldArt(),
    sources = new Map(),
    meta = new Map();
  function collect(object, path = "") {
    if (object?.bitmap) {
      sources.set(path, object);
      return;
    }
    if (!object || typeof object !== "object") return;
    for (const [key, value] of Object.entries(object))
      collect(value, path ? `${path}.${key}` : key);
  }
  collect(art.sprites);

  // Wind is baked once as integer row shifts; trunks and collision stay fixed.
  const sway = createEnvironment(art);
  for (const type of ["oak", "birch", "spruce", "dead"])
    for (let size = 0; size < 3; size++)
      for (const side of [-1, 1]) {
        const time = side === 1 ? 1 : 2.5;
        sources.set(
          `wind.${type}.${size}.${side}`,
          sway.treeSprite(
            { legacyIndex: 0 },
            art.sprites.trees[type][size],
            time,
          ),
        );
      }
  for (const action of ["idle", "adjust", "read", "look", "peek", "greet"])
    for (let i = 0; i < 2; i++)
      sources.set(`merchant.${action}.${i}`, art.merchantPose(action, i));
  for (const role of ["player", "buyerA", "buyerB"])
    for (const mood of ["blink", "yawn"])
      sources.set(`idle.${role}.${mood}`, art.person(role, "down", 0, mood));
  for (const role of ["player", "buyerA", "buyerB"])
    sources.set(
      `idle.${role}.cheer`,
      art.person(role, "down", 0, "happy", "cheer"),
    );
  for (const type of ["fern", "flowers", "mushroom"])
    for (let variant = 0; variant < 2; variant++)
      for (const side of [-1, 1])
        sources.set(
          `plant.${type}.${variant}.${side}`,
          sway.plantSprite(
            art.sprites.details[type][variant],
            side === 1 ? 1 : 3,
            0,
          ),
        );
  collect(worldArt, "world");
  collect(createCampArt(), "camp");
  collect(createSurvivalArt(), "survival");
  collect(createExplorationArt(), "exploration");
  collect(createStoryArt(), "story");
  collect(createWorkerArt(), "workers");
  for (const role of ["player", "buyerA", "buyerB"])
    for (const mood of role === "player"
      ? ["happy", "tired", "focused"]
      : ["happy"])
      for (const dir of ["down", "up", "side"])
        for (let f = 0; f < (role === "player" ? HERO_WALK_FRAMES : 4); f++)
          sources.set(
            `people.${role}.${mood}.${dir}.${f}`,
            art.person(role, dir, f, mood),
          );
  for (const dir of ["up", "down", "side"]) {
    for (const mode of ["carry", "heavy"])
      for (let f = 0; f < HERO_WALK_FRAMES; f++)
        sources.set(
          `hero.${mode}.${dir}.${f}`,
          art.person(
            "player",
            dir,
            f,
            mode === "heavy" ? "tired" : "neutral",
            "carry",
          ),
        );
    for (let f = 0; f < 6; f++)
      sources.set(
        `hero.strike.${dir}.${f}`,
        art.person("player", dir, f, "focused", "chop"),
      );
    for (let f = 0; f < 2; f++)
      sources.set(
        `hero.cheer.${dir}.${f}`,
        art.person("player", dir, f, "happy", "cheer"),
      );
    for (let tier = 0; tier < art.sprites.axes.length; tier++)
      for (let f = 0; f < 6; f++)
        sources.set(
          `tools.swing.${tier}.${dir}.${f}`,
          art.swingTool(tier, dir, f),
        );
  }
  sources.set(
    "chip",
    sprite(4, 2, 2, 1, (p) => p.rect(0, 0, 4, 2, "#d9ae72")),
  );
  for (const [key, frame] of Object.entries(biomeEnemyFrames(scene)))
    sources.set(key, frame);
  const people = applyPeopleFrames(scene, sources);
  let x = 2,
    y = 2,
    row = 0;
  const frames = [],
    packed = new Map();
  for (const [key, s] of [...sources].sort(
    (a, b) => b[1].height - a[1].height,
  )) {
    if (packed.has(s.bitmap)) {
      frames.push({ ...packed.get(s.bitmap), key });
      continue;
    }
    if (x + s.width + 2 > 2048) {
      x = 2;
      y += row + 2;
      row = 0;
    }
    frames.push({ key, s, x, y });
    packed.set(s.bitmap, { s, x, y });
    x += s.width + 2;
    row = Math.max(row, s.height);
  }
  const height = 2 ** Math.ceil(Math.log2(y + row + 2));
  if (height > 2048) throw new Error("Sprite atlas overflow");
  const texture = scene.textures.createCanvas("forest", 2048, height),
    ctx = texture.getContext();
  ctx.imageSmoothingEnabled = false;
  for (const { key, s, x, y } of frames) {
    ctx.drawImage(s.bitmap, x, y);
    texture.add(key, 0, x, y, s.width, s.height);
    meta.set(key, {
      originX: s.ax / s.width,
      originY: s.ay / s.height,
      width: s.width,
      height: s.height,
    });
  }
  texture.refresh();
  texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  // Keep decoded PNG images in the registry for scene restarts, release the six
  // original GPU textures after their scaled pixels have entered the one atlas.
  for (const name of IMPORTED_ASSETS)
    if (scene.textures.exists(`import.${name}`))
      scene.textures.remove(`import.${name}`);
  function image(key, x, y, depth = y) {
    const m = meta.get(key);
    return scene.add
      .image(x, y, "forest", key)
      .setOrigin(m.originX, m.originY)
      .setScale(2)
      .setDepth(depth);
  }
  function setFrame(object, key) {
    const m = meta.get(key);
    object.setFrame(key).setOrigin(m.originX, m.originY);
    return object;
  }
  for (const role of ["player", "buyerA", "buyerB"])
    for (const mood of [
      "neutral",
      ...(role === "player" ? ["happy", "tired", "focused"] : ["happy"]),
    ])
      for (const dir of ["up", "down", "side"]) {
        const prefix =
          mood === "neutral"
            ? `characters.${role}.${dir}`
            : `people.${role}.${mood}.${dir}`;
        scene.anims.create({
          key: `walk.${role}.${mood}.${dir}`,
          frames: Array.from(
            { length: role === "player" ? HERO_WALK_FRAMES : 4 },
            (_, i) => ({
              key: "forest",
              frame: `${prefix}.${i}`,
            }),
          ),
          frameRate: role === "player" ? 12 : 9,
          repeat: -1,
        });
      }
  for (const mode of ["carry", "heavy"])
    for (const dir of ["up", "down", "side"])
      scene.anims.create({
        key: `walk.player.${mode}.${dir}`,
        frames: Array.from({ length: HERO_WALK_FRAMES }, (_, i) => ({
          key: "forest",
          frame: `hero.${mode}.${dir}.${i}`,
        })),
        frameRate: 12,
        repeat: -1,
      });
  for (let tier = 0; tier < art.sprites.axes.length; tier++)
    for (const dir of ["side", "up", "down"])
      scene.anims.create({
        key: `chop.${tier}${dir === "side" ? "" : `.${dir}`}`,
        frames: Array.from({ length: 6 }, (_, i) => ({
          key: "forest",
          frame: `tools.swing.${tier}.${dir}.${i}`,
        })),
        duration: STRIKE_MS,
      });
  return { art, worldArt, meta, image, setFrame, people };
}
