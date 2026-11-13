import { sprite } from "../pixel-art.js";
import { HERO_APPEARANCES, normalizeAppearance } from "../game/appearances.js";
import {heroColorKey} from '../game/hero-colors.js';
import {paintHeroFrame} from './hero-color-art.js';
export function preloadPeople(scene) {
  scene.load.json("people.manifest", "./src/assets/people/manifest.json");
  scene.load.image("people.source", "./src/assets/people/people.png");
  scene.load.image("people.materials", "./src/assets/people/hero-materials.png");
}
export function retainPeople(scene) {
  const manifest = scene.cache.json.get("people.manifest");
  if (!manifest?.frames || !scene.textures.exists("people.source"))
    throw Error("Generated people assets failed to load");
  if(!scene.textures.exists('people.materials'))throw Error('Hero material masks failed to load');
  const canvas=document.createElement('canvas');[canvas.width,canvas.height]=manifest.size;
  const ctx=canvas.getContext('2d');ctx.drawImage(scene.textures.get('people.materials').getSourceImage(),0,0);
  const rgba=ctx.getImageData(0,0,canvas.width,canvas.height).data,materials=new Uint8Array(canvas.width*canvas.height);
  for(let i=0;i<materials.length;i++)materials[i]=Math.round(rgba[i*4]/85);
  scene.registry.set("peoplePack", {
    manifest,
    materials,
    image: scene.textures.get("people.source").getSourceImage(),
  });
  scene.textures.remove("people.source");
  scene.textures.remove('people.materials');
}
export function applyPeopleFrames(scene, sources) {
  const pack = scene.registry.get("peoplePack");
  if (!pack) return null;
  const choices=scene.registry.get('heroChoices')||[],role =
      HERO_APPEARANCES[
        normalizeAppearance(choices[0]?.appearance||scene.registry.get("heroAppearance"))
      ].role,
    cached = new Map();
  const get = (id,colors=null) => {
    const cacheKey=id+':'+heroColorKey(colors);
    if (cached.has(cacheKey)) return cached.get(cacheKey);
    const f = pack.manifest.frames[id];
    if (!f) throw Error(`Missing character frame: ${id}`);
    const image = sprite(f.width, f.height, ...f.anchor, (p) => colors ? paintHeroFrame(p.g,pack,id,colors) : p.g.drawImage(
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
    cached.set(cacheKey, image);
    return image;
  };
  for (const id of Object.keys(pack.manifest.frames))
    if (!id.startsWith("hero")) sources.set(`person.${id}`, get(id));
  function heroFrames(role, prefix = "",colors=null) {
  const heroGet=id=>get(id,colors);
  const put = (key, value) => sources.set(prefix + key, value);
  for (const dir of ["down", "up", "side"]) {
    for (let i = 0; i < 8; i++) {
      const walk = heroGet(`${role}-walk-${dir}-${i % 4}`),
        carry = heroGet(`${role}-carry-${dir}-${i % 4}`);
      put(`characters.player.${dir}.${i}`, walk);
      for (const mood of ["happy", "tired", "focused"])
        put(`people.player.${mood}.${dir}.${i}`, walk);
      for (const mood of ["carry", "heavy"])
        put(`hero.${mood}.${dir}.${i}`, carry);
    }
    for (let tier = 0; tier < 6; tier++)
      for (let phase = 0; phase < 6; phase++) {
        const frame = heroGet(
          `${role}-strike-${dir}-${Math.floor(phase / 2)}-tier${tier}`,
        );
        put(`hero.strike.${tier}.${dir}.${phase}`, frame);
        if (tier === 0) put(`hero.strike.${dir}.${phase}`, frame);
      }
    for (let i = 0; i < 2; i++)
      put(`hero.cheer.${dir}.${i}`, heroGet(`${role}-gesture-cheer`));
  }
  for (const mood of ["blink", "yawn"])
    put(`idle.player.${mood}`, heroGet(`${role}-gesture-rest`));
  put("idle.player.cheer", heroGet(`${role}-gesture-cheer`));
  }
  heroFrames(role,'',choices[0]?.colors);
  if (scene.registry.get("playerCount") === 2)
    heroFrames(choices[1]?.appearance?HERO_APPEARANCES[normalizeAppearance(choices[1].appearance)].role:role === HERO_APPEARANCES.traveler.role ? HERO_APPEARANCES.woodcutter.role : HERO_APPEARANCES.traveler.role, "coop2.",choices[1]?.colors);
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
    const action = body.cargo?.length || body.stoneCargo ? "carry" : "walk",
      count =
        dir === "side"
          ? (action === "carry"
              ? pack.manifest.sideCarryFrames?.[role]
              : pack.manifest.sideFrames?.[role]) ||
            pack.manifest.walkFrames[role]
          : action === "carry"
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
