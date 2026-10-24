import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "./vendor/three.module.min.js";
import { normalizeStyle, engravingSize, createEngraving } from "./engraving.js";

test("only the explicit experimental style opts into engraving", () => {
  assert.equal(normalizeStyle("engraving"), "engraving");
  for (const value of [null, undefined, "", "lowpoly", "anything-else"])
    assert.equal(normalizeStyle(value), "lowpoly");
});
test("engraving buffers preserve aspect and cap resolution in both quality modes", () => {
  assert.deepEqual(engravingSize(2800, 1600, false), {
    width: 1400,
    height: 800,
  });
  assert.deepEqual(engravingSize(2800, 1600, true), {
    width: 900,
    height: 514,
  });
  assert.deepEqual(engravingSize(390, 640, true), { width: 390, height: 640 });
  assert.deepEqual(engravingSize(0, 0, false), { width: 1, height: 1 });
});
test("low-poly draws directly and disabling engraving releases its buffer", () => {
  const calls = [],
    originalTarget = {};
  const renderer = {
    target: originalTarget,
    toneMappingExposure: 1.08,
    extensions: { has: () => true },
    getDrawingBufferSize: (v) => v.set(2000, 1200),
    getRenderTarget() {
      return this.target;
    },
    setRenderTarget(t) {
      this.target = t;
    },
  };
  const pass = createEngraving(renderer, (...args) => calls.push(args)),
    scene = new THREE.Scene(),
    camera = new THREE.Camera();
  pass.render(scene, camera);
  assert.equal(calls.length, 1);
  assert.equal(pass.target, null);
  pass.setEnabled(true);
  pass.render(scene, camera);
  assert.equal(calls.length, 3);
  assert.equal(renderer.target, originalTarget);
  assert.equal(pass.target.width, 1400);
  let disposed = false;
  pass.target.addEventListener("dispose", () => (disposed = true));
  pass.setEnabled(false);
  assert.equal(disposed, true);
  assert.equal(pass.target, null);
  pass.render(scene, camera);
  assert.equal(calls.length, 4);
});
test("render target is restored if the experimental render fails", () => {
  const renderer = {
    target: null,
    toneMappingExposure: 1,
    extensions: { has: () => false },
    getDrawingBufferSize: (v) => v.set(300, 200),
    getRenderTarget() {
      return this.target;
    },
    setRenderTarget(t) {
      this.target = t;
    },
  };
  const pass = createEngraving(renderer, () => {
    throw Error("test draw failure");
  });
  pass.setEnabled(true);
  assert.throws(
    () => pass.render(new THREE.Scene(), new THREE.Camera()),
    /test draw failure/,
  );
  assert.equal(renderer.target, null);
  assert.equal(pass.target.texture.type, THREE.UnsignedByteType);
});
