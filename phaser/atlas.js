import { createPixelArt, sprite } from "../pixel-art.js";
import { createWorldArt } from "../world-art.js";

// Это загрузчик исходных спрайтов, а не отрисовка игры в одну Canvas-текстуру.
// Каждый кадр атласа доступен как обычный Phaser Image/Sprite.
export function createAtlas(scene) {
  if (scene.textures.exists("forest")) scene.textures.remove("forest");
  const art = createPixelArt(),
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
  collect(worldArt, "world");
  for (const role of ["player", "buyerA", "buyerB"])
    for (const mood of role === "player"
      ? ["happy", "tired", "focused"]
      : ["happy"])
      for (const dir of ["down", "up", "side"])
        for (let f = 0; f < 4; f++)
          sources.set(
            `people.${role}.${mood}.${dir}.${f}`,
            art.person(role, dir, f, mood),
          );
  sources.set(
    "chip",
    sprite(4, 2, 2, 1, (p) => p.rect(0, 0, 4, 2, "#d9ae72")),
  );
  let x = 2,
    y = 2,
    row = 0;
  const frames = [];
  for (const [key, s] of sources) {
    if (x + s.width + 2 > 1024) {
      x = 2;
      y += row + 2;
      row = 0;
    }
    frames.push({ key, s, x, y });
    x += s.width + 2;
    row = Math.max(row, s.height);
  }
  const height = 2 ** Math.ceil(Math.log2(y + row + 2));
  if (height > 2048) throw new Error("Sprite atlas overflow");
  const texture = scene.textures.createCanvas("forest", 1024, height),
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
          frames: Array.from({ length: 4 }, (_, i) => ({
            key: "forest",
            frame: `${prefix}.${i}`,
          })),
          frameRate: 9,
          repeat: -1,
        });
      }
  for (let tier = 0; tier < art.sprites.axes.length; tier++)
    scene.anims.create({
      key: `chop.${tier}`,
      frames: [0, 1, 2].map((i) => ({
        key: "forest",
        frame: `axes.${tier}.${i}`,
      })),
      duration: 320,
    });
  return { art, worldArt, meta, image, setFrame };
}
