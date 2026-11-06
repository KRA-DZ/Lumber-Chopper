export class CoopCamera {
  constructor(scene) {
    this.scene = scene;
    this.first = scene.camera.stopFollow();
    this.second = scene.cameras.add(0, 0, 1, 1).setName("player-two");
    const b = scene.core.world.bounds;
    this.second.setBounds(b.x, b.y, b.width, b.height);
    this.second.roundPixels = true;
    this.split = false;
    this.layout = "";
    scene.atmosphere.attachCamera(this.second);
  }
  update() {
    const s = this.scene, [a, b] = s.core.actors.map(c => c.player),
      w = s.scale.width, h = s.scale.height,
      separation = Math.max(Math.abs(a.x - b.x) / (w * .65), Math.abs(a.y - b.y) / (h * .58));
    if (a.room || b.room || a.menuOpen || b.menuOpen) this.split = true;
    else if (!this.split && separation > 1) this.split = true;
    else if (this.split && separation < .72) this.split = false;
    const vertical = w >= h, key = `${this.split}:${w}:${h}`;
    if (key !== this.layout) {
      this.layout = key;
      this.first.setViewport(0, 0, this.split && vertical ? Math.floor(w / 2) : w,
        this.split && !vertical ? Math.floor(h / 2) : h);
      this.second.setViewport(vertical ? Math.floor(w / 2) : 0, vertical ? 0 : Math.floor(h / 2),
        vertical ? Math.ceil(w / 2) : w, vertical ? h : Math.ceil(h / 2));
      this.second.visible = this.split;
    }
    this.first.centerOn(this.split ? a.x : (a.x + b.x) / 2, (this.split ? a.y : (a.y + b.y) / 2) - 80);
    this.second.centerOn(b.x, b.y - 80);
    for (const camera of this.cameras()) camera.preRender();
  }
  cameras() { return this.split ? [this.first, this.second] : [this.first]; }
  views() { return this.cameras().map(c => c.worldView); }
  actorAt(pointer) {
    return this.split ? (pointer.x >= this.second.x && pointer.y >= this.second.y ? 1 : 0) : this.scene.core.activeActor;
  }
  destroy() { this.scene.cameras.remove(this.second); }
}
