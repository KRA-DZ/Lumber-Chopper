import { hasCampBuilding } from "../game/camp-projects.js";
import { WORKERS } from "../game/workers.js";
import { stackOffset } from "../game/stack-layout.js";
import { WORKER_ROLES, workerRole } from "../game/worker-jobs.js";
const snap = (v) => Math.round(v / 2) * 2;
// At most four people, 32 log sprites and bounded stone stacks; reuse the existing atlas.
export class WorkerView {
  constructor(scene) {
    this.scene = scene;
    this.objects = new Map();
    this.depot = scene
      .addImage("workers.depot", WORKERS.depot.x, WORKERS.depot.y)
      .setData("workers", true);
    // The generated empty rack has holes; its whole small frame stays clickable.
    if (scene.assets.camp) this.depot.setInteractive();
    else this.depot.setInteractive({ pixelPerfect: true });
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
      visible = hasCampBuilding(scene.core.state,"tent");
    this.depot.setVisible(visible);
    this.depot.input.enabled = visible;
    this.label.setVisible(visible);
    const key = `${d.stock.length}:${system.crew.length}:${system.slots()}:${d.autoSell}:${d.logTarget}`;
    if (key !== this.labelKey) {
      this.labelKey = key;
      this.label.setText(
        `СКЛАД ${d.stock.length}/${WORKERS.stockLimit} · ${system.crew.length}/${system.slots()}\n${d.logTarget==="store"?"В общий склад":d.autoSell ? "Продажа" : "Запас для стройки"} · H`,
      );
    }
    scene.worldHints.offer(this.label, WORKERS.depot, { eligible: visible, priority: 50 });
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
          stones:Array.from({length:4},()=>scene.addImage("details.rock.0",0,0).setScale(1.5)),
          label: scene.text(w.name, w.x, w.y + 20, 11),
        };
        this.objects.set(w.id, a);
      }
      const nearby = scene.nearView(w, scene.camera.worldView, 180);
      a.sprite.setVisible(nearby);
      a.axe.setVisible(nearby && w.phase === "cutting" && !scene.assets.people);
      a.label.setVisible(nearby);
      a.stones.forEach((stone,i)=>stone.setVisible(nearby&&i<Math.ceil(w.stoneCargo/4)).setPosition(snap(w.x+(i%2)*16-8),snap(w.y-50-Math.floor(i/2)*14)).setDepth(w.y+.05+i*.001));
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
        !scene.assets.people &&
        w.moving &&
        Math.floor(scene.core.elapsed * 12) % 4 < 2
          ? -2
          : 0;
      a.sprite.setPosition(snap(w.x), snap(w.y + bob));
      scene.animatePerson(a.sprite, w.appearance, w, "neutral");
      a.axe
        .setPosition(snap(w.x + 18), snap(w.y - 34))
        .setRotation(w.swing > 0 ? -1 : 0.3)
        .setDepth(w.y + 0.02);
      a.label.setText(`${w.name} · ${WORKER_ROLES[workerRole(w)].name}`).setPosition(snap(w.x), snap(w.y + 22)).setDepth(w.y + 0.2);
      scene.worldHints.offer(a.label, w, { eligible: nearby, range: 140, priority: 20 });
    }
  }
}
