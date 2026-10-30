import { sprite } from "../pixel-art.js";
import { HERO_APPEARANCES, normalizeAppearance } from "../game/appearances.js";
export function preloadPeople(scene) {
  scene.load.json("people.manifest", "./src/assets/people/manifest.json");
  scene.load.image("people.source", "./src/assets/people/people.png");
}
export function retainPeople(scene) {
  const manifest = scene.cache.json.get("people.manifest");
  if (!manifest?.frames || !scene.textures.exists("people.source"))
    throw Error("Generated people assets failed to load");
  scene.registry.set("peoplePack", {
    manifest,
    image: scene.textures.get("people.source").getSourceImage(),
  });
  scene.textures.remove("people.source");
}
export function applyPeopleFrames(scene, sources) {
  const pack = scene.registry.get("peoplePack");
  if (!pack) return null;
  const role =
      HERO_APPEARANCES[
        normalizeAppearance(scene.registry.get("heroAppearance"))
      ].role,
    cached = new Map();
  const get = (id) => {
    if (cached.has(id)) return cached.get(id);
    const f = pack.manifest.frames[id];
    if (!f) throw Error(`Missing character frame: ${id}`);
    const image = sprite(f.width, f.height, ...f.anchor, (p) =>
      p.g.drawImage(
        pack.image,
        f.x,
        f.y,
        f.width,
        f.height,
        0,
        0,
        f.width,
        f.height,
      ),
    );
    cached.set(id, image);
    return image;
  };
  for (const id of Object.keys(pack.manifest.frames))
    if (!id.startsWith("hero")) sources.set(`person.${id}`, get(id));
  for (const dir of ["down", "up", "side"]) {
    for (let i = 0; i < 8; i++) {
      const walk = get(`${role}-walk-${dir}-${i % 4}`),
        carry = get(`${role}-carry-${dir}-${i % 4}`);
      sources.set(`characters.player.${dir}.${i}`, walk);
      for (const mood of ["happy", "tired", "focused"])
        sources.set(`people.player.${mood}.${dir}.${i}`, walk);
      for (const mood of ["carry", "heavy"])
        sources.set(`hero.${mood}.${dir}.${i}`, carry);
    }
    for (let tier = 0; tier < 6; tier++)
      for (let phase = 0; phase < 6; phase++) {
        const frame = get(
          `${role}-strike-${dir}-${Math.floor(phase / 2)}-tier${tier}`,
        );
        sources.set(`hero.strike.${tier}.${dir}.${phase}`, frame);
        if (tier === 0) sources.set(`hero.strike.${dir}.${phase}`, frame);
      }
    for (let i = 0; i < 2; i++)
      sources.set(`hero.cheer.${dir}.${i}`, get(`${role}-gesture-cheer`));
  }
  for (const mood of ["blink", "yawn"])
    sources.set(`idle.player.${mood}`, get(`${role}-gesture-rest`));
  sources.set("idle.player.cheer", get(`${role}-gesture-cheer`));
  sources.set("merchant", get("merchant-idle"));
  for (const action of ["idle", "adjust", "read", "look", "peek", "greet"])
    for (let i = 0; i < 2; i++)
      sources.set(`merchant.${action}.${i}`, get(`merchant-${action}`));
  return { role, manifest: pack.manifest };
}
export function renderGeneratedPerson(
  scene,
  sprite,
  role,
  body,
  mood = "neutral",
) {
  const pack = scene.assets.people;
  if (!pack?.manifest.walkFrames[role]) return false;
  const dir =
      body.direction === "up"
        ? "up"
        : ["left", "right"].includes(body.direction)
          ? "side"
          : "down",
    t = scene.core.elapsed;
  let id,
    front = false;
  if (role.startsWith("worker") && body.swing > 0)
    id = `${role}-strike-${dir}-${Math.min(2, Math.floor((0.3 - body.swing) / 0.1))}`;
  else if (role.startsWith("worker") && body.phase === "cutting")
    id = `${role}-strike-${dir}-2`;
  else if (!body.moving && (body.thanks > 0 || mood === "happy")) {
    id = `${role}-gesture-cheer`;
    front = true;
  } else if (!body.moving && body.action === "greet" && body.actionTimer > 0) {
    id = `${role}-gesture-greet`;
    front = true;
  } else if (
    !body.moving &&
    (body.phase === "resting" ||
      (scene.core.cycle.isNight && Math.floor(t + body.id) % 17 < 2))
  ) {
    id = `${role}-gesture-rest`;
    front = true;
  } else {
    const action = body.cargo?.length ? "carry" : "walk",
      count =
        action === "carry"
          ? pack.manifest.carryFrames[role]
          : pack.manifest.walkFrames[role],
      sequence = count === 3 ? [0, 2, 1, 2] : [0, 1, 2, 3],
      frame = body.moving ? sequence[Math.floor(t * 8) % 4] : count - 1;
    id = `${role}-${action}-${dir}-${frame}`;
  }
  sprite.stop();
  const key = `person.${id}`;
  if (sprite.frame.name !== key) scene.assets.setFrame(sprite, key);
  sprite.setFlipX(!front && body.direction === "left").setDepth(body.y);
  return true;
}
