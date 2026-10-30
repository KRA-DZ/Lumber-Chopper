import { WORKERS } from "../game/workers.js";
import { stackOffset } from "../game/stack-layout.js";
const snap = (v) => Math.round(v / 2) * 2;
// At most three people, 24 carried logs and a single stock label; existing atlas and animations.
export class WorkerView {
  constructor(scene) {
    this.scene = scene;
    this.objects = new Map();
    this.depot = scene
      .addImage("workers.depot", WORKERS.depot.x, WORKERS.depot.y)
      .setInteractive({ pixelPerfect: true })
      .setData("workers", true);
    this.label = scene.text("", WORKERS.depot.x, WORKERS.depot.y + 26, 11);
    this.stock = Array.from({ length: 6 }, () =>
      scene.addImage("log", 0, 0).setScale(0.65),
    );
    this.labelKey = "";
  }
  render() {
    const scene = this.scene,
      system = scene.core.workers,
      d = system.data,
      visible = scene.core.state.campLevel >= 2;
    this.depot.setVisible(visible);
    this.depot.input.enabled = visible;
    this.label.setVisible(visible);
    const key = `${d.stock.length}:${system.crew.length}:${d.autoSell}`;
    if (key !== this.labelKey) {
      this.labelKey = key;
      this.label.setText(
        `СКЛАД ${d.stock.length}/${WORKERS.stockLimit} · ${system.crew.length}/3\n${d.autoSell ? "Продажа" : "Запас для стройки"} · H`,
      );
    }
    this.stock.forEach((log, i) =>
      log
        .setVisible(visible && i < d.stock.length)
        .setPosition(
          WORKERS.depot.x + 12 + (i % 2) * 24,
          WORKERS.depot.y - 8 - Math.floor(i / 2) * 9,
        )
        .setDepth(WORKERS.depot.y + 0.1 + i * 0.001),
    );
    for (const w of system.crew) {
      let a = this.objects.get(w.id);
      if (!a) {
        a = {
          sprite: scene.add
            .sprite(w.x, w.y, "forest", "person.worker3-walk-down-0")
            .setOrigin(0.5, 44 / 46)
            .setScale(2),
          axe: scene.addImage("axes.0.0", w.x, w.y),
          logs: Array.from({ length: 8 }, () => scene.addImage("log", 0, 0)),
          label: scene.text(w.name, w.x, w.y + 20, 11),
        };
        this.objects.set(w.id, a);
      }
      const nearby = scene.nearView(w, scene.camera.worldView, 180);
      a.sprite.setVisible(nearby);
      a.axe.setVisible(nearby && w.phase === "cutting" && !scene.assets.people);
      a.label.setVisible(nearby);
      a.logs.forEach((log, i) => {
        log.setVisible(nearby && i < w.cargo.length);
        if (nearby && i < w.cargo.length) {
          const slot = stackOffset(i, w.cargo.length);
          log
            .setPosition(
              snap(
                w.x +
                  slot.x +
                  (w.moving
                    ? Math.sin(scene.core.elapsed * 10 - i * 0.3) * 3
                    : 0),
              ),
              snap(w.y + slot.y),
            )
            .setDepth(w.y + 0.04 + i * 0.001);
        }
      });
      if (!nearby) continue;
      const bob =
        w.moving && Math.floor(scene.core.elapsed * 12) % 4 < 2 ? -2 : 0;
      a.sprite.setPosition(snap(w.x), snap(w.y + bob));
      scene.animatePerson(a.sprite, w.appearance, w, "neutral");
      a.axe
        .setPosition(snap(w.x + 18), snap(w.y - 34))
        .setRotation(w.swing > 0 ? -1 : 0.3)
        .setDepth(w.y + 0.02);
      a.label.setPosition(snap(w.x), snap(w.y + 22)).setDepth(w.y + 0.2);
    }
  }
}
