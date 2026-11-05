export const HINT_LIMITS = Object.freeze({ full: 4, light: 2 });

export function selectHints(candidates, view, limit) {
  const selected = [];
  for (const entry of candidates.sort((a, b) => b.priority - a.priority || a.distance - b.distance)) {
    if (selected.length === limit) break;
    const b = entry.bounds;
    if (b.right < view.x || b.left > view.x + view.width ||
        b.bottom < view.y || b.top > view.y + view.height) continue;
    if (selected.some(({ bounds: a }) => b.left < a.right + 6 && b.right > a.left - 6 &&
      b.top < a.bottom + 6 && b.bottom > a.top - 6)) continue;
    selected.push(entry);
  }
  return selected;
}

// Only world captions share this budget. HUD, HP bars and attack warnings stay independent.
export class WorldHints {
  constructor(scene) {
    this.scene = scene;
    this.candidates = [];
    this.visibleCount = 0;
  }
  begin() {
    this.candidates.length = 0;
  }
  offer(label, point, { eligible = true, range = 180, priority = 10, companions = [] } = {}) {
    label.setVisible(false);
    for (const object of companions) object.setVisible(false);
    const players = this.scene.core.actors?.map(a => a.player) || [this.scene.core.player],
      distance = Math.min(...players.map(p => Math.hypot(p.x - point.x, p.y - point.y)));
    if (!eligible || distance > range) return;
    this.candidates.push({ label, companions, distance, priority, bounds: label.getBounds() });
  }
  flush() {
    const selected = [...new Set((this.scene.coopCamera?.views() || [this.scene.camera.worldView]).flatMap(view =>
      selectHints(this.candidates, view, this.scene.effectsLight ? HINT_LIMITS.light : HINT_LIMITS.full)))];
    for (const { label, companions } of selected) {
      label.setVisible(true);
      for (const object of companions) object.setVisible(true);
    }
    this.visibleCount = selected.length;
  }
}
