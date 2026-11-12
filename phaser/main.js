import {preloadPlants,retainPlants} from "./plants-assets.js";
import { preloadPeople, retainPeople } from "./people-assets.js";
import { preloadTrees, retainTrees } from "./tree-assets.js";
import { preloadCamp, retainCamp } from "./camp-assets.js";
import { preloadItems, retainItems } from "./item-assets.js";
import { preloadLootItems, retainLootItems } from "./loot-item-assets.js";
import { preloadDecor, retainDecor } from "./decor-assets.js";
import { preloadFortress, retainFortress } from "./fortress-assets.js";
import { preloadSawmill, retainSawmill } from "./sawmill-assets.js";
import { selectHero } from "./hero-selection.js";
import { preloadBiomeAssets, retainBiomeAssets } from "./biome-assets.js";
import { IMPORTED_ASSETS } from "./imported-art.js";
import { WorldScene } from "./world-scene.js";
import { HudScene } from "./hud-scene.js";
import { viewportSize, initializeDock } from "./viewport.js";

if (!window.Phaser) throw new Error("Local Phaser library failed to load");
class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }
  preload() {
    preloadBiomeAssets(this);
    preloadPeople(this);
    preloadTrees(this);
    preloadCamp(this);
    preloadItems(this);
    preloadLootItems(this);
    preloadDecor(this);
    preloadPlants(this);
    preloadFortress(this);
    preloadSawmill(this);
    this.load.json("import.manifest", "./src/assets/manifest.json");
    for (const name of IMPORTED_ASSETS)
      this.load.image(`import.${name}`, `./src/assets/${name}.png`);
  }
  create() {
    retainBiomeAssets(this);
    retainPeople(this);
    retainTrees(this);
    retainCamp(this);
    retainItems(this);
    retainLootItems(this);
    retainDecor(this);
    retainPlants(this);
    retainFortress(this);
    retainSawmill(this);
    const manifest = this.cache.json.get("import.manifest");
    if (
      !manifest ||
      IMPORTED_ASSETS.some(
        (name) =>
          !manifest.assets?.[name] || !this.textures.exists(`import.${name}`),
      )
    ) {
      document.querySelector("#loading").textContent =
        "Не удалось загрузить PNG-ассеты. Обновите папку src/assets и откройте игру через HTTP-сервер.";
      return;
    }
    this.registry.set("importedPack", {
      manifest,
      images: Object.fromEntries(
        IMPORTED_ASSETS.map((name) => [
          name,
          this.textures.get(`import.${name}`).getSourceImage(),
        ]),
      ),
    });
    selectHero(this, () => this.scene.start("World"));
  }
}
const initialSize = viewportSize(window.innerWidth, window.innerHeight);
const disposeDock = initializeDock();
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game-viewport",
  ...initialSize,
  backgroundColor: "#203b2b",
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  render: { antialias: false, pixelArt: true, roundPixels: true },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  fps: { target: 60 },
  audio: { noAudio: true },
  scene: [BootScene, WorldScene, HudScene],
});
function resize() {
  const {width, height} = viewportSize(window.innerWidth, window.innerHeight);
  game.scale.setParentSize(window.innerWidth, window.innerHeight);
  if (game.scale.width !== width || game.scale.height !== height)
    game.scale.setGameSize(width, height);
}
window.addEventListener("resize", resize);
game.events.once(Phaser.Core.Events.DESTROY, () => {
  window.removeEventListener("resize", resize);
  disposeDock();
});
// В пробной сборке, как и в основной, каждая загрузка начинает новую сессию.
try {
  localStorage.removeItem("lumber-chopper-v1");
} catch {
  /* Storage is optional. */
}
