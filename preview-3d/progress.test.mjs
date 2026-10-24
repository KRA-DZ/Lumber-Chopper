import { test } from "node:test";
import assert from "node:assert/strict";
import { defaults, loadProgress, saveProgress, SAVE_KEY } from "./progress.js";
function memory() {
  const data = new Map();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => data.set(k, v),
  };
}
test("2D resources and camp are copied without changing the legacy save", () => {
  const storage = memory(),
    legacy = {
      version: 4,
      wood: 7,
      maxWood: 40,
      coins: 321,
      cargoValue: 84,
      campLevel: 2,
      buildWood: 11,
      upgradeCost: 50,
    };
  const raw = JSON.stringify(legacy);
  storage.setItem("lumber-chopper-v1", raw);
  const imported = loadProgress(storage);
  assert.equal(imported.source, "2d");
  assert.equal(imported.state.capacity, 40);
  assert.equal(imported.state.buildWood, 11);
  assert.equal(imported.state.cargoValue, 84);
  assert.equal(storage.getItem("lumber-chopper-v1"), raw);
});
test("3D save wins on subsequent visits and preserves position and damaged tree HP", () => {
  const storage = memory(),
    state = { ...defaults(), coins: 99, campLevel: 3, buildWood: 12 };
  saveProgress(storage, state, { x: 20, z: -5 }, [
    { id: 1, hp: 0, maxHp: 4 },
    { id: 2, hp: 3, maxHp: 4 },
    { id: 3, hp: 4, maxHp: 4 },
  ]);
  storage.setItem(
    "lumber-chopper-v1",
    JSON.stringify({ version: 4, coins: 999 }),
  );
  const restored = loadProgress(storage);
  assert.equal(restored.source, "3d");
  assert.deepEqual(restored.state, state);
  assert.deepEqual(restored.position, { x: 20, z: -5 });
  assert.deepEqual(restored.trees, [
    { id: 1, hp: 0 },
    { id: 2, hp: 3 },
  ]);
});
test("corrupt 3D data is backed up before a fresh session is offered", () => {
  const storage = memory();
  storage.setItem(SAVE_KEY, "broken");
  const restored = loadProgress(storage);
  assert.equal(restored.source, "error");
  assert.equal(storage.getItem(SAVE_KEY + "-backup"), "broken");
  assert.deepEqual(restored.state, defaults());
});
test("unavailable browser storage does not prevent starting the game", () => {
  assert.equal(loadProgress(undefined).source, "error");
});
test("existing 3D saves acquire the clock without losing resources or camp", () => {
  const storage = memory();
  const state = { ...defaults(), coins: 50, campLevel: 2, buildWood: 7 };
  delete state.worldTime;
  storage.setItem(SAVE_KEY, JSON.stringify({ version: 1, state }));
  const restored = loadProgress(storage);
  assert.equal(restored.state.worldTime, 240);
  assert.equal(restored.state.coins, 50);
  assert.equal(restored.state.campLevel, 2);
  assert.equal(restored.state.buildWood, 7);
});
