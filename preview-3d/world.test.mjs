import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "./vendor/three.module.min.js";
import { createCameraRig, CAMERA_LIMITS } from "./camera.js";
import { createRenderBatches } from "./render-batches.js";
import { box } from "./models.js";
import { createWeather, weatherAt } from "./weather.js";
import { createWildlife } from "./wildlife.js";
import { normalizeDiscoveries } from "./discoveries.js";

test("perspective camera keeps its heading and strictly limits overview zoom", () => {
  const rig = createCameraRig();
  rig.resize(1280, 720);
  rig.follow(new THREE.Vector3(0, 0, 6), 0, true);
  const orientation = rig.camera.quaternion.clone();
  for (let i = 0; i < 100; i++) rig.follow(new THREE.Vector3(i, 0, -i), 0.03);
  assert.ok(orientation.angleTo(rig.camera.quaternion) < 1e-6);
  assert.equal(rig.camera.isPerspectiveCamera, true);
  rig.zoom(1000);
  assert.equal(rig.distance, CAMERA_LIMITS.max);
  rig.zoom(-1000);
  assert.equal(rig.distance, CAMERA_LIMITS.min);
  rig.resize(390, 620);
  assert.equal(rig.camera.fov, 50);
});

test("colored boxes share one render batch while visibility and picking stay independent", () => {
  const scene = new THREE.Scene(),
    root = new THREE.Group();
  scene.add(root);
  const first = box(root, "#ff0000", 0, 0, 0, 2, 3, 4),
    second = box(root, "#00ff00", 5, 0, 0, 1, 1, 1);
  assert.equal(first.geometry, second.geometry);
  const bounds = new THREE.Box3().setFromObject(first);
  assert.deepEqual(bounds.getSize(new THREE.Vector3()).toArray(), [2, 3, 4]);
  const batches = createRenderBatches(scene);
  scene.updateMatrixWorld(true);
  batches.update();
  assert.equal(batches.groups.size, 1);
  const batch = [...batches.groups.values()][0].batch;
  assert.equal(batch.count, 2);
  assert.equal(first.layers.mask, 2);
  const ray = new THREE.Raycaster(
    new THREE.Vector3(0, 0, 8),
    new THREE.Vector3(0, 0, -1),
  );
  ray.layers.enable(1);
  assert.ok(ray.intersectObject(first).length > 0);
  root.visible = false;
  batches.update();
  assert.equal(batch.count, 0);
});

test("changing light intensity reuses batches instead of allocating a group per frame", () => {
  const scene = new THREE.Scene(),
    m = box(scene, "#d9ba7c", 0, 0, 0, 1, 1, 1);
  m.material = m.material.clone();
  m.material.emissive.set("#ffcc66");
  const batches = createRenderBatches(scene);
  scene.updateMatrixWorld(true);
  for (let i = 0; i < 1000; i++) {
    m.material.emissiveIntensity = i / 1000;
    batches.update();
  }
  assert.equal(batches.groups.size, 1);
});

test("weather stays bounded, uses fixed buffers, and low quality reduces local rain", () => {
  for (let time = -1200; time < 2400; time += 13) {
    const w = weatherAt(time);
    assert.ok(w.rain >= 0 && w.rain <= 1 && w.cloud >= 0 && w.cloud <= 1);
  }
  const w = createWeather(new THREE.Scene(), { x: -9, z: 4, rx: 3.9, rz: 2.8 });
  const buffer = w.rain.geometry.attributes.position.array;
  w.cycle();
  w.update(0, 1, 240, { x: 10, z: 10 });
  assert.equal(w.current.rain, 1);
  assert.equal(w.rain.geometry.drawRange.count, 400);
  w.setLow(true);
  w.update(0.1, 2, 240, { x: 10, z: 10 });
  assert.equal(w.rain.geometry.drawRange.count, 160);
  assert.equal(w.rain.geometry.attributes.position.array, buffer);
  for (let i = 0; i < 80; i++) {
    assert.ok(Math.abs(buffer[i * 6] - 10) <= 10);
    assert.ok(Math.abs(buffer[i * 6 + 2] - 10) <= 9);
  }
});

test("nearby birds take flight, wildlife is capped, and low mode limits active animals", () => {
  const wildlife = createWildlife(
    new THREE.Scene(),
    {
      freePoint: (x, z) => ({ x, z }),
      walkable: () => true,
      moveBody: (a, x, z) => {
        a.x += x;
        a.z += z;
      },
    },
    { bird() {} },
  );
  const bird = wildlife.animals.find((a) => a.kind === "bird");
  wildlife.update(0, 0, 240, bird);
  assert.equal(bird.mode, "resting");
  wildlife.update(0.1, 0.1, 240, { x: bird.x + 0.5, z: bird.z });
  assert.equal(bird.mode, "flying");
  wildlife.setLow(true);
  wildlife.update(0.1, 0.2, 240, { x: 0, z: 0 });
  assert.equal(wildlife.animals.length, 8);
  assert.equal(wildlife.animals.filter((a) => a.enabled).length, 6);
});

test("discovery saves accept only known unique landmarks", () => {
  assert.deepEqual(
    normalizeDiscoveries(["well", "well", "unknown", 3, "arch"]),
    ["well", "arch"],
  );
  assert.deepEqual(normalizeDiscoveries(null), []);
});
