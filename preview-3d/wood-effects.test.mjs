import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "./vendor/three.module.min.js";
import { tree } from "./models.js";
import { createWoodEffects } from "./wood-effects.js";

test("falling tree ignores circular picking metadata and keeps shared geometry alive", () => {
  const scene = new THREE.Scene(),
    t = tree("birch", 2, 3, 1),
    fx = createWoodEffects(scene),
    player = { x: 0, z: 3 };
  t.root.traverse((m) => (m.userData.tree = t));
  let geometryDisposed = false,
    sourceMaterialDisposed = false;
  t.trunk.geometry.addEventListener("dispose", () => (geometryDisposed = true));
  t.trunk.material.addEventListener(
    "dispose",
    () => (sourceMaterialDisposed = true),
  );
  fx.strike(t, player);
  fx.fell(t, player);
  const falling = fx.falls[0].root,
    flying = fx.flights[0].root;
  assert.equal(falling.parent, scene);
  fx.update(0.3, player, 3);
  assert.ok(falling.quaternion.angleTo(new THREE.Quaternion()) > 0);
  assert.ok(flying.position.y > 1);
  fx.update(1, player, 3);
  assert.equal(falling.parent, null);
  assert.equal(flying.parent, null);
  assert.equal(fx.falls.length, 0);
  assert.equal(fx.flights.length, 0);
  assert.equal(fx.chips.length, 0);
  assert.equal(fx.chipMesh.count, 0);
  assert.equal(geometryDisposed, false);
  assert.equal(sourceMaterialDisposed, false);
  assert.equal(t.hp, t.maxHp); // FX cannot grant resources or modify tree HP.
});

test("repeated strikes cap debris and falling copies, then clean up", () => {
  const scene = new THREE.Scene(),
    t = tree("pine", 0, 0, 1),
    fx = createWoodEffects(scene),
    player = { x: 0, z: 1 };
  for (let i = 0; i < 30; i++) {
    fx.strike(t, player);
    fx.fell(t, player);
  }
  assert.equal(fx.chips.length, 64);
  assert.equal(fx.falls.length, 4);
  assert.equal(fx.flights.length, 12);
  fx.update(2, player, 3);
  assert.equal(scene.children.length, 2); // Reusable debris and the hidden completion ring.
  assert.equal(scene.children.filter((m) => m.visible).length, 1);
});
