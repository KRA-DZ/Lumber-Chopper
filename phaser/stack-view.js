import { stackOffset } from "../game/stack-layout.js";
const snap = (v) => Math.round(v / 2) * 2;
export class StackView {
  constructor(scene) {
    this.scene = scene;
    this.logs = [];
  }
  render() {
    const { core: c, flights, heroView } = this.scene,
      { player: p, state: s, elapsed: t } = c;
    const count = s.cargo.length,
      hidden = new Set();
    for (const f of flights) if (f.kind === "pickup") hidden.add(f.index);
    while (this.logs.length < count)
      this.logs.push(this.scene.addImage("log", 0, 0));
    this.logs.forEach((log, i) => {
      const slot = stackOffset(i, count),
        height = (i % 28) / 27,
        load = Math.min(count / 20, 1.5);
      log
        .setVisible(i < count && !hidden.has(i))
        .setPosition(
          snap(
            p.x +
              slot.x +
              (p.moving
                ? Math.sin(t * 9 - height * 1.8) * (2 + height * 11) * load
                : 0),
          ),
          snap(
            p.y +
              slot.y +
              heroView.bob +
              (p.moving ? Math.sin(t * 12) * (1 + load) : 0),
          ),
        )
        .setDepth(p.y + 0.04 + i * 0.0001);
    });
  }
}
