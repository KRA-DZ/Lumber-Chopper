import { preloadBiomeAssets, retainBiomeAssets } from "./biome-assets.js";
import { IMPORTED_ASSETS } from "./imported-art.js";
import { WorldScene } from "./world-scene.js";
import { HudScene } from "./hud-scene.js";

if (!window.Phaser) throw new Error("Local Phaser library failed to load");
class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }
  preload() {
    preloadBiomeAssets(this);
    this.usePng =
      new URLSearchParams(location.search).get("art") !== "procedural";
    if (!this.usePng) return;
    this.load.json("import.manifest", "./src/assets/manifest.json");
    for (const name of IMPORTED_ASSETS)
      this.load.image(`import.${name}`, `./src/assets/${name}.png`);
  }
  create() {
    retainBiomeAssets(this);
    if (this.usePng) {
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
    }
    this.scene.start("World");
  }
}
const mobile = () => window.innerWidth < 600;
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game-viewport",
  width: mobile() ? 512 : 960,
  height: mobile() ? 704 : 688,
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
  const width = mobile() ? 512 : 960,
    height = mobile() ? 704 : 688;
  if (game.scale.width !== width || game.scale.height !== height)
    game.scale.resize(width, height);
  game.scale.refresh();
}
window.addEventListener("resize", resize);
game.events.once(Phaser.Core.Events.DESTROY, () =>
  window.removeEventListener("resize", resize),
);
// В пробной сборке, как и в основной, каждая загрузка начинает новую сессию.
try {
  localStorage.removeItem("lumber-chopper-v1");
} catch {
  /* Storage is optional. */
}
