import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyUpgrades,
  buyUpgrade,
  upgradeOffer,
  AXE_TIERS,
  SHOP_IDS,
} from "../economy.js";
import { createForestry, growthStage, treeYield } from "../forestry.js";
import { scatterDetails } from "../world.js";
import { createMystery } from "../mystery.js";
function state() {
  const s = { coins: 0, cargo: [], cargoValue: 0, wood: 0 };
  applyUpgrades(s);
  return s;
}
test("a large tree drops three logs, two fit in the hands, leftovers wait without disappearing", () => {
  const s = state(),
    f = createForestry(s),
    t = { id: "oak", hp: 0, maxHp: 6, size: 2, value: 12, x: 0, y: 0 };
  assert.equal(f.fell(t, 0), 3);
  assert.equal(f.fell(t, 0), 0);
  const player = { x: 20, y: 25 };
  f.collect(0, player);
  assert.equal(s.wood, 0);
  for (let i = 0; i < 10; i++) f.collect(0.2, player);
  assert.equal(s.wood, 2);
  assert.equal(s.cargoValue, 24);
  assert.equal(f.piles.get(t.id).count, 1);
  assert.equal(f.takeCargo(), 12);
  f.collect(0.2, player);
  assert.equal(f.piles.size, 0);
  assert.equal(s.wood, 2);
  assert.equal(f.takeCargo() + f.takeCargo() + 12, 36);
  assert.equal(f.takeCargo(), null);
  assert.equal(s.cargoValue, 0);
  assert.equal(treeYield({ size: 0 }), 2);
});
test("growth follows calendar days, restores once on day three and keeps old ground stock", () => {
  const s = state(),
    f = createForestry(s),
    t = { id: "one", x: 0, y: 0, hp: 0, maxHp: 4, size: 0, value: 10 };
  f.fell(t, 5);
  assert.equal(growthStage(t, 5), 0);
  assert.equal(growthStage(t, 6), 1);
  assert.equal(growthStage(t, 7), 2);
  assert.equal(f.updateGrowth([t], 7), false);
  assert.equal(t.hp, 0);
  assert.equal(f.updateGrowth([t], 8), true);
  assert.equal(t.hp, 4);
  assert.equal(t.cutDay, null);
  assert.equal(f.updateGrowth([t], 8), false);
  t.hp = 0;
  f.fell(t, 8);
  assert.equal(f.piles.size, 1);
  assert.equal(f.piles.get(t.id).count, 4);
  assert.equal(f.fell({ workerOnly: true, hp: 0 }, 8), 0);
});
test("mixed cargo sells exact top-log values, without proportional rounding", () => {
  const s = state(),
    f = createForestry(s);
  f.addCargo(10);
  f.addCargo(15);
  assert.equal(f.addCargo(12), false);
  assert.deepEqual(s.cargo, [10, 15]);
  s.coins += f.takeCargo();
  assert.equal(s.coins, 15);
  assert.equal(s.cargoValue, 10);
  s.coins += f.takeCargo();
  assert.equal(s.coins, 25);
  assert.equal(s.wood, 0);
});
test("shop charges only affordable purchases, carries grow gradually and higher axes improve cadence", () => {
  const s = state();
  assert.equal(s.maxWood, 2);
  assert.equal(upgradeOffer(s, "carry").price, 20);
  assert.equal(buyUpgrade(s, "carry"), false);
  s.coins = 20;
  assert.equal(buyUpgrade(s, "carry"), true);
  assert.equal(s.coins, 0);
  assert.equal(s.maxWood, 4);
  assert.equal(upgradeOffer(s, "carry").price, 31);
  assert.equal(buyUpgrade(s, "missing"), false);
  s.coins = 1e12;
  for (const id of SHOP_IDS) {
    let previous = 0;
    while (!upgradeOffer(s, id).maxed) {
      const offer = upgradeOffer(s, id);
      assert.ok(offer.price >= previous);
      previous = offer.price;
      assert.equal(buyUpgrade(s, id), true);
    }
    const balance = s.coins;
    assert.equal(buyUpgrade(s, id), false);
    assert.equal(s.coins, balance);
  }
  assert.equal(s.maxWood, 82);
  assert.equal(s.axePower, AXE_TIERS.at(-1).power);
  assert.ok(s.autoInterval < 0.85 && s.runSpeed > 200 && s.pickupRadius > 68);
});
test("scenery positions are deterministic scatter, without periodic rows or type cycles", () => {
  const a = scatterDetails({ allowed: () => true }),
    b = scatterDetails({ allowed: () => true });
  assert.deepEqual(a, b);
  assert.equal(a.length, 230);
  const rows = new Map();
  for (const p of a) {
    const row = Math.floor(p.y / 12);
    rows.set(row, (rows.get(row) || 0) + 1);
  }
  assert.ok(Math.max(...rows.values()) < 9);
  assert.ok(a.slice(1).some((p, i) => p.type === a[i].type));
  assert.ok(
    a.some((p) => p.variant === 1 && p.type === "rock") &&
      a.some((p) => p.variant === 0 && p.type === "rock"),
  );
});
test("eyes stay bounded, avoid light and disappear at sunrise", () => {
  const m = createMystery(),
    scene = {
      darkness: 1,
      player: { x: 500, y: 500 },
      view: { x: 20, y: 20, width: 960, height: 688 },
      lights: [{ x: 500, y: 480, r: 140 }],
      center: { x: 500, y: 500 },
      radius: 1000,
    };
  let seen = 0;
  for (let i = 0; i < 2000; i++) {
    m.update(0.1, scene);
    seen += m.eyes.length;
    assert.ok(m.eyes.length <= 3);
    assert.ok(m.eyes.every((e) => Math.hypot(e.x - 500, e.y - 480) >= 126));
  }
  assert.ok(seen > 0);
  m.update(0.1, { ...scene, darkness: 0 });
  assert.equal(m.eyes.length, 0);
});
