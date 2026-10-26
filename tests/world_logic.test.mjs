import { test } from "node:test";
import assert from "node:assert/strict";
import { weatherAt, createWeather, WEATHER_LIMITS } from "../weather.js";
import { createExpansion } from "../expansion.js";
import { FOREST_SITES, inClearing } from "../world.js";

test("weather follows the 10-minute world clock with a dry day between showers", () => {
  assert.equal(weatherAt(120, 600).rain, 0);
  assert.equal(weatherAt(235, 600, 0).rain, 1);
  assert.equal(weatherAt(235, 600, 1).rain, 0);
  assert.ok(weatherAt(33, 600).mist > 0.9);
  assert.ok(weatherAt(290, 600).wet > 0);
  assert.equal(weatherAt(350, 600).wet, 0);
});
test("tracks classify water edges, dry paths and grass, stay bounded and expire", () => {
  const weather = createWeather({
    art: {},
    sprites: {},
    pond: { x: 0, y: 0 },
    springs: [],
    center: { x: 1000, y: 1000 },
    inWater: (x) => x < 0,
    nearTrail: (p) => p.y === 50,
  });
  assert.equal(weather.surfaceAt(12, 100), "water");
  assert.equal(weather.surfaceAt(100, 50), "dust");
  assert.equal(weather.surfaceAt(100, 100), "grass");
  const player = { x: 100, y: 100, moving: true },
    state = { worldTime: 120, coins: 5, wood: 7 };
  weather.update(0, state, 600, 0, [], player);
  assert.equal(weather.tracks.length, 0);
  for (let i = 0; i < 200; i++) {
    player.x += 24;
    weather.update(0.01, state, 600, 0, [], player);
  }
  assert.ok(
    weather.tracks.length > 0 && weather.tracks.length <= WEATHER_LIMITS.tracks,
  );
  weather.setQuality("light");
  assert.ok(weather.tracks.length <= 16);
  assert.ok(weather.rainCount < WEATHER_LIMITS.rain);
  player.moving = false;
  weather.update(4, state, 600, 0, [], player);
  assert.equal(weather.tracks.length, 0);
  assert.deepEqual(state, { worldTime: 120, coins: 5, wood: 7 });
});
test("canopy drips appear only while trees remain wet and pools clean up", () => {
  const weather = createWeather({
    art: {},
    sprites: {},
    pond: {},
    springs: [],
    center: { x: 0, y: 0 },
    inWater: () => false,
    nearTrail: () => false,
  });
  const player = { x: 100, y: 100, moving: false },
    trees = [{ x: 100, y: 100, hp: 4, type: "oak" }];
  for (let i = 0; i < 1000; i++)
    weather.update(0.1, { worldTime: 290 }, 600, 0, trees, player);
  assert.ok(
    weather.drips.length > 0 && weather.drips.length <= WEATHER_LIMITS.drips,
  );
  for (let i = 0; i < 100; i++)
    weather.update(0.1, { worldTime: 350 }, 600, 0, trees, player);
  assert.equal(weather.drips.length, 0);
});
test("territory reveal eases towards the physical radius, caps events and expires", () => {
  const expansion = createExpansion({
    center: { x: 1600, y: 1600 },
    radii: [900, 1040, 1180, 1320, 1450],
  });
  expansion.open(900, 1040);
  expansion.update(0.2, 1);
  assert.ok(expansion.radius > 900 && expansion.radius < 1040);
  assert.equal(expansion.banner.to, 1040);
  expansion.update(0, 1);
  assert.equal(expansion.rings.length, 1);
  for (let i = 0; i < 200; i++) expansion.update(0.1, 1);
  assert.equal(expansion.radius, 1040);
  assert.equal(expansion.banner, null);
  assert.equal(expansion.rings.length, 0);
  expansion.update(0, 4);
  assert.equal(expansion.radius, 1450);
});
test("hand-placed sites reserve clearings in more than the starting circle", () => {
  assert.equal(
    new Set(FOREST_SITES.map((s) => s.id)).size,
    FOREST_SITES.length,
  );
  assert.ok(FOREST_SITES.every((s) => inClearing(s.x, s.y)));
  assert.ok(
    FOREST_SITES.some((s) => Math.hypot(s.x - 1600, s.y - 1600) > 1040),
  );
  for (const type of ["spring", "log", "arch", "camp", "logging"])
    assert.ok(FOREST_SITES.some((s) => s.type === type));
});
