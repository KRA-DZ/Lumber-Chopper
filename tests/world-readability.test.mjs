import test from "node:test";
import assert from "node:assert/strict";
import { crownCut, coversHero } from "../phaser/tree-occlusion.js";
import { selectHints, WorldHints } from "../phaser/world-hints.js";

test("crown boundary preserves the narrow trunk; hero overlap excludes carried logs and trees behind him", () => {
  const w = 20, h = 40, pixels = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = y < 26 ? 2 : 9; x < (y < 26 ? 18 : 11); x++)
      pixels[(y * w + x) * 4 + 3] = 255;
  assert.equal(crownCut(pixels, w, h), 26);
  const image = { visible: true, depth: 300, x: 100, y: 300,
    displayOriginX: 10, displayOriginY: 40, scaleX: 2, scaleY: 2,
    displayWidth: 40, displayHeight: 80 };
  assert.equal(coversHero(image, 26, { x: 100, y: 290 }), true);
  assert.equal(coversHero(image, 26, { x: 100, y: 320 }), false);
  assert.equal(coversHero(image, 26, { x: 100, y: 200 }), false);
  assert.equal(coversHero(image, 26, { x: 180, y: 290 }), false);
  image.visible = false;
  assert.equal(coversHero(image, 26, { x: 100, y: 290 }), false);
});

test("world captions prioritize danger/selection, reject collisions and offscreen captions, then prefer nearby", () => {
  const entry = (id, x, priority, distance = 20) => ({ id, priority, distance,
    bounds: { left: x, right: x + 40, top: 10, bottom: 30 } });
  const candidates = [entry("scenery", 20, 10), entry("selected", 20, 100),
    entry("watcher", 70, 110), entry("far", 120, 40, 100),
    entry("near", 170, 40, 10), entry("offscreen", 400, 120)];
  assert.deepEqual(selectHints(candidates, { x: 0, y: 0, width: 300, height: 200 }, 3)
    .map(e => e.id), ["watcher", "selected", "near"]);
});

test("captions and their bubble companions recover next frame; light quality limits visible captions to two", () => {
  const object = (x = 10) => ({ visible: true, x,
    setVisible(v) { this.visible = v; return this; },
    getBounds() { return { left: x, right: x + 20, top: 0, bottom: 20 }; } });
  const scene = { core: { player: { x: 0, y: 0 } }, effectsLight: true,
    camera: { worldView: { x: 0, y: 0, width: 500, height: 200 } } },
    hints = new WorldHints(scene), label = object(), bubble = object();
  hints.begin();
  hints.offer(label, { x: 1000, y: 0 }, { companions: [bubble] });
  hints.flush();
  assert.equal(label.visible, false);
  assert.equal(bubble.visible, false);
  hints.begin();
  hints.offer(label, { x: 10, y: 0 }, { priority: 100, companions: [bubble] });
  const other = object(80), third = object(140);
  hints.offer(other, { x: 20, y: 0 });
  hints.offer(third, { x: 30, y: 0 });
  hints.flush();
  assert.equal(label.visible && bubble.visible && other.visible, true);
  assert.equal(third.visible, false);
  assert.equal(hints.visibleCount, 2);
});
