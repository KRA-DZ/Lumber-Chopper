// One reusable control for keyboard and touch; resources/progress belong to the model.
export class RepairControl {
  constructor(scene) {
    this.scene = scene;
    this.bar = scene.add.graphics();
    this.button = scene.add
      .text(0, 0, "", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#fff0bd",
        backgroundColor: "#52462e",
        padding: { x: 14, y: 12 },
        align: "center",
      })
      .setOrigin(0.5, 1)
      .setInteractive({ useHandCursor: true });
    this.button.on("pointerdown", (pointer, x, y, event) => {
      event.stopPropagation();
      if (pointer.button === 0 && !scene.world.core.paused)
        scene.world.core.setDefenseRepairHeld(true);
    });
    this.release = () => scene.world.core.setDefenseRepairHeld(false);
    this.button.on("pointerout", this.release);
    scene.input.on("pointerup", this.release);
    scene.input.on("gameout", this.release);
    scene.events.once("shutdown", () => {
      this.release();
      scene.input.off("pointerup", this.release);
      scene.input.off("gameout", this.release);
    });
  }
  refresh() {
    const s = this.scene,
      c = s.world.core,
      section = c.nearestDefenseRepair();
    const visible = !!section && !c.paused && !c.state.gameOver;
    this.button.setVisible(visible);
    this.bar.clear();
    if (!visible) return;
    const work = c.defenseRepair;
    const effect =
      section.kind === "barricade" && !section.hp
        ? `Восстановление ${section.wood}/${section.cost} брёвен`
        : "1 бревно → до 20 HP";
    this.button
      .setPosition(
        s.scale.width / 2,
        s.guideButton.y - s.guideButton.height - 12,
      )
      .setText(
        c.state.wood
          ? `Удерживайте: ремонт · R\n${effect} · в руках ${c.state.wood}`
          : "Ремонт · нужны брёвна",
      );
    const x = this.button.x - this.button.width / 2,
      y = this.button.y - 5;
    this.bar
      .fillStyle(0x292f24)
      .fillRect(x + 6, y, this.button.width - 12, 4)
      .fillStyle(0xe5c87e)
      .fillRect(x + 6, y, (this.button.width - 12) * (work?.progress || 0), 4);
  }
}
