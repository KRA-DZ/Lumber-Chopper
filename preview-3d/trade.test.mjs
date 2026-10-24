import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "./vendor/three.module.min.js";
import { createTrade } from "./trade.js";
import { DAY_SECONDS, clockText, shopOpen, normalizedTime } from "./time.js";
const makeShop = () =>
  createTrade(
    { THREE, scene: new THREE.Scene() },
    {
      pathTo: (t) => [t],
      moveBody: (b, x, z) => {
        b.x += x;
        b.z += z;
      },
    },
  );
test("twenty-minute clock opens mornings and closes at 18:00", () => {
  assert.equal(DAY_SECONDS, 1200);
  assert.equal(clockText(600), "18:00");
  assert.equal(clockText(900), "00:00");
  assert.equal(shopOpen(240), true);
  assert.equal(shopOpen(600), false);
  assert.equal(normalizedTime(1201), 1);
});
test("customers wait and build a five-person daytime queue", () => {
  const s = makeShop();
  for (let i = 0; i < 2400; i++) s.update(0.1, 240, 0);
  assert.equal(s.buyers.length, 5);
  assert.equal(s.buyers.filter((b) => b.phase === "queued").length, 4);
  assert.equal(s.active(240).slot, 0);
  assert.ok(s.active(240).wait > 90);
});
test("a full cart leaves only after the minimum stay, then the next customer advances", () => {
  const s = makeShop();
  for (let i = 0; i < 300; i++) s.update(0.1, 240, 0);
  const first = s.buyers[0];
  for (let i = 0; i < 40; i++) s.receive(first);
  assert.equal(first.load, 40);
  assert.equal(first.cargo.children.length, 12);
  s.update(0.1, 240, 0);
  assert.equal(first.phase, "waiting");
  for (let i = 0; i < 1000; i++) s.update(0.1, 240, 0);
  assert.ok(!s.buyers.includes(first));
  assert.ok(s.active(240));
});
test("evening stops trade and clears the queue without spawning at night", () => {
  const s = makeShop();
  for (let i = 0; i < 2400; i++) s.update(0.1, 240, 0);
  s.update(0.1, 600, 0);
  assert.equal(s.active(600), null);
  assert.ok(s.buyers.every((b) => b.phase === "leaving"));
  for (let i = 0; i < 800; i++) s.update(0.1, 900, 0);
  assert.equal(s.buyers.length, 0);
  s.update(0.1, 240, 0);
  assert.equal(s.buyers.length, 1);
});
