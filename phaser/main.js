import { WorldScene } from "./world-scene.js";
import { HudScene } from "./hud-scene.js";

if (!window.Phaser) throw new Error("Local Phaser library failed to load");
class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }
  create() {
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
