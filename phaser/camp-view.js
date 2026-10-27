import { CAMP } from "../pixel-art.js";
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export class CampView {
  constructor(scene) {
    this.scene = scene;
    this.g = scene.add.graphics().setDepth(-850);
    this.props = [];
    for (const [key, x, y, min] of [
      ["dishes", 1530, 1605, 1],
      ["mat", CAMP.tent.x, CAMP.tent.y + 23, 2],
      ["crate", 1355, 1510, 2],
      ["crate", 1885, 1645, 3],
      ["flowers", CAMP.hut.x - 100, CAMP.hut.y + 15, 4],
      ["flowers", CAMP.hut.x + 100, CAMP.hut.y + 15, 4],
    ])
      this.props.push({ key, min, image: scene.addImage(`camp.${key}`, x, y) });
    for (const [kind, pad, title] of [
      ["sale", scene.core.sale, "Продажа"],
      ["build", scene.core.build, "Стройка"],
    ]) {
      scene.addImage(
        `camp.${kind}Sign`,
        pad.x + (kind === "sale" ? -76 : 76),
        pad.y - 16,
      );
      scene.text(
        title,
        pad.x + (kind === "sale" ? -68 : 84),
        pad.y - 63,
        11,
        "#fff0c5",
        pad.y + 0.1,
      );
    }
  }
  render() {
    const c = this.scene.core,
      s = c.state,
      p = c.player,
      g = this.g.clear();
    for (const prop of this.props) {
      prop.image.setVisible(s.campLevel >= prop.min);
      if (prop.key === "mat")
        prop.image.setPosition(
          s.campLevel === 4 ? CAMP.hut.x : CAMP.tent.x,
          s.campLevel === 4 ? CAMP.hut.y + 23 : CAMP.tent.y + 23,
        );
    }
    for (const [pad, color] of [
      [c.sale, 0xf3cf77],
      [c.build, 0xb4ddcc],
    ]) {
      const near = dist(p, pad) < 210,
        standing = dist(p, pad) < pad.radius;
      if (near)
        g.lineStyle(
          standing ? 4 : 2,
          color,
          standing ? 0.95 : 0.45,
        ).strokeRoundedRect(pad.x - 63, pad.y - 37, 126, 74, 8);
    }
    const stage = c.stages[s.campLevel];
    if (stage && dist(p, c.build) < 240) {
      const x = c.build.x - 44,
        y = c.build.y + 36;
      g.fillStyle(0x304b3c, 0.95)
        .fillRect(x - 2, y - 2, 92, 10)
        .fillStyle(0x598575)
        .fillRect(x, y, 88, 6)
        .fillStyle(0xc4ddad)
        .fillRect(x, y, (88 * s.buildWood) / stage.cost, 6);
    }
  }
}
