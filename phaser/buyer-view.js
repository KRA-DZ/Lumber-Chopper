const snap = (v) => Math.round(v / 2) * 2;
export class BuyerView {
  constructor(scene) {
    this.scene = scene;
  }
  render() {
    const scene = this.scene;
    for (const [id, a] of scene.customerObjects)
      if (!scene.core.buyers.some((b) => b.id === id)) {
        a.sprite.destroy();
        a.cart?.destroy();
        a.logs.forEach((i) => i.destroy());
        a.label.destroy();
        a.bubble.destroy();
        a.orderIcon.destroy();
        scene.customerObjects.delete(id);
      }
    for (const b of scene.core.buyers) {
      let a = scene.customerObjects.get(b.id);
      if (!a) {
        a = {
          sprite: scene.add
            .sprite(b.x, b.y, "forest", "person.buyer1-walk-down-0")
            .setOrigin(0.5, 44 / 46)
            .setScale(2),
          logs: [],
          bubble: scene.add.graphics().setDepth(b.y + 0.15),
          orderIcon: scene
            .addImage("log", b.x, b.y - 114, b.y + 0.2)
            .setScale(0.45),
          cart:
            b.kind === "cart"
              ? scene.addImage("cart", b.x + 44, b.y + 10)
              : null,
          label: scene.text("", b.x, b.y + 28, 11),
        };
        scene.customerObjects.set(b.id, a);
      }
      a.sprite.setPosition(snap(b.x), snap(b.y));
      scene.animatePerson(
        a.sprite,
        b.appearance,
        b,
        b.thanks > 0 ? "happy" : "neutral",
      );
      a.cart?.setPosition(snap(b.x + 44), snap(b.y + 10)).setDepth(b.y - 0.01);
      while (a.logs.length < b.load) a.logs.push(scene.addImage("log", 0, 0));
      for (let i = 0; i < a.logs.length; i++) {
        const hidden = [...scene.flights].some(
          (f) => f.target?.follow === b && f.target.slot === i,
        );
        a.logs[i]
          .setVisible(i < b.load && !hidden)
          .setPosition(
            snap(b.x + (b.kind === "cart" ? 30 + (i % 2) * 24 : 0)),
            snap(
              b.y +
                (b.kind === "cart" ? -28 - Math.floor(i / 2) * 9 : -4 - i * 9),
            ),
          )
          .setDepth(b.y + 0.05 + i * 0.0001);
      }
      const nearby =
        Math.hypot(b.x - scene.playerModel.x, b.y - scene.playerModel.y) <
          280 || b.slot === 0;
      const greeting =
        b.thanks > 0
          ? "Спасибо!"
          : b.action === "greet" && b.actionTimer > 0
            ? "Привет!"
            : "Заказ";
      const y = b.y - (b.kind === "cart" ? 125 : 110);
      a.bubble
        .clear()
        .setDepth(b.y + 0.15)
        .setVisible(nearby);
      if (nearby)
        a.bubble
          .fillStyle(0x344638, 0.95)
          .fillRoundedRect(b.x - 52, y - 22, 104, 48, 5)
          .lineStyle(2, 0xc3b780)
          .strokeRoundedRect(b.x - 52, y - 22, 104, 48, 5);
      a.orderIcon
        .setPosition(b.x - 24, y + 7)
        .setDepth(b.y + 0.2)
        .setVisible(nearby);
      a.label
        .setPosition(b.x, y - 10)
        .setDepth(b.y + 0.2)
        .setText(`${greeting}\n  ещё ${Math.max(0, b.capacity - b.load)}`)
        .setVisible(nearby);
    }
  }
}
