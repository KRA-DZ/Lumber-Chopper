import test from "node:test";
import assert from "node:assert/strict";
import { createSimulation } from "../game/simulation.js";
import { REGIONS } from "../game/regions.js";
import { regionTrails } from "../game/region-trails.js";
import { biomeDressing, BIOME_DETAIL_LIMIT } from "../game/biome-dressing.js";
import { sampleBiomeGround } from "../game/biome-terrain.js";
import { ambientCue } from "../game/biome-soundscape.js";

test("curved forest/swamp trails join all four borders and avoid the ancient tree and merchant bases", () => {
  const g = createSimulation({ regional: true, survival: false });
  for (const id of ["1:0", "0:1"]) {
    const r = REGIONS.find(r => r.id === id);
    g.regions.unlocked.add(id); g.world.generate(r);
  }
  g.nav.rebuildObstacles();
  for (const id of ["1:0", "0:1"]) {
    const r = REGIONS.find(r => r.id === id), paths = regionTrails(r);
    assert.deepEqual(paths[0][0], { x: r.x, y: r.cy });
    assert.deepEqual(paths[0].at(-1), { x: r.x + r.width, y: r.cy });
    assert.deepEqual(paths[1][0], { x: r.cx, y: r.y });
    assert.deepEqual(paths[1].at(-1), { x: r.cx, y: r.y + r.height });
    for (const path of paths) for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i];
      for (let n = 0; n <= 20; n++) {
        const x = a.x + (b.x - a.x) * n / 20, y = a.y + (b.y - a.y) * n / 20;
        if (g.regions.contains(x, y, 12)) {
          assert.ok(g.nav.isWalkable(x, y, 12), `${id}: ${x},${y}`);
          assert.ok(g.world.nearTrail({ x, y }, 4));
        }
      }
    }
    const details = g.world.biomeDetails.get(id);
    assert.ok(details.length > 3 && details.length <= BIOME_DETAIL_LIMIT);
    for (const p of details) {
      assert.ok(!g.world.nearTrail(p, 90));
      assert.ok(g.nav.isWalkable(p.x, p.y), `Small decor must stay passable: ${p.kind}`);
    }
    g.world.generate(r);
    assert.equal(g.world.biomeDetails.get(id), details, "No regeneration/duplicate props");
  }
});

test("dressing is deterministic, bounded, separated, and absent in other biomes or reserved ground", () => {
  const r = REGIONS.find(r => r.id === "0:1"), paths = regionTrails(r),
    props = biomeDressing(r, paths, () => true);
  assert.deepEqual(props, biomeDressing(r, paths, () => true));
  assert.equal(props.length, BIOME_DETAIL_LIMIT);
  assert.deepEqual(biomeDressing(r, paths, () => false), []);
  const field = REGIONS.find(r => r.biome === "field");
  assert.deepEqual(biomeDressing(field, regionTrails(field), () => true), []);
  for (const a of props) for (const b of props)
    if (a !== b) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= 130);
});

test("forest/swamp fringe preserves source PNG colours and deterministic world sampling", () => {
  const solid = rgb => {
    const data = new Uint8ClampedArray(64 * 64 * 4);
    for (let i = 0; i < data.length; i += 4) data.set([...rgb, 255], i);
    return data;
  }, materials = { forest: solid([20, 80, 10]), swamp: solid([30, 50, 70]), field: solid([150, 40, 100]) },
    seen = new Set();
  for (let y = 1400; y <= 1480; y++) for (let x = 540; x < 600; x++) {
    const rgb = sampleBiomeGround(materials, x, y);
    assert.ok(["20,80,10", "30,50,70"].includes(rgb.join(",")));
    assert.deepEqual(rgb, sampleBiomeGround(materials, x, y));
    seen.add(rgb.join(","));
  }
  assert.equal(seen.size, 2);
  assert.deepEqual(sampleBiomeGround(materials, 800, 800), [20, 80, 10]);
  // A third biome entering the corner must not abruptly replace the patchwork with an averaged colour.
  const corner = sampleBiomeGround(materials, 1329, 1440);
  assert.ok(Math.min(...[[20, 80, 10], [30, 50, 70]].map(rgb =>
    Math.hypot(...rgb.map((channel, i) => channel - corner[i])))) < 0.02);
});

test("soundscape distinguishes forest/swamp and pans real moving night enemies rather than dead or remote ones", () => {
  const core = { player: { x: 0, y: 0 }, world: { biomeAt: () => "forest" },
    nightAmount: () => 0, survival: { residents: [] } };
  assert.equal(ambientCue(core, () => .5).kind, "bird");
  core.world.biomeAt = () => "swamp";
  assert.equal(ambientCue(core, () => .5).kind, "frog");
  core.nightAmount = () => 1;
  core.survival.residents = [{ x: 20, y: 0, hp: 0, moving: true },
    { x: -210, y: 0, hp: 6, moving: true }, { x: 800, y: 0, hp: 6, moving: true }];
  const cue = ambientCue(core, () => .5);
  assert.equal(cue.kind, "steps"); assert.ok(cue.pan < 0 && cue.volume > 0);
  core.survival.residents[1].moving = false;
  assert.equal(ambientCue(core, () => .5).kind, "frog");
});
