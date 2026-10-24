import * as THREE from "./vendor/three.module.min.js";
import { box, mesh, rock, log } from "./models.js";
export const SITES = Object.freeze([
  { id: "old-camp", name: "Забытая стоянка", x: 11, z: 12, clear: 1.8 },
  { id: "well", name: "Старый колодец", x: -12, z: -12, clear: 1.7 },
  { id: "wagon", name: "Заросшая повозка", x: 21, z: 6, clear: 1.8 },
  { id: "falls", name: "Тихий водопад", x: -18, z: 15, clear: 2.8 },
  { id: "arch", name: "Древняя арка", x: -17, z: -8, clear: 2.7 },
]);
export const normalizeDiscoveries = (value) =>
  Array.isArray(value)
    ? [...new Set(value.filter((id) => SITES.some((s) => s.id === id)))]
    : [];
export function createDiscoveries(scene) {
  const sites = SITES.map((site) => {
    const root = new THREE.Group();
    root.position.set(site.x, 0, site.z);
    scene.add(root);
    const ground = mesh(
      new THREE.CircleGeometry(site.clear + 0.8, 13),
      "#83966a",
      root,
      0,
      0.047,
      0,
    );
    ground.rotation.x = -Math.PI / 2;
    ground.castShadow = false;
    return { ...site, root };
  });
  const camp = sites[0].root;
  box(camp, "#8b8c68", 0, 1.5, 0, 2.3, 0.1, 2).rotation.x = 0.48;
  for (const x of [-1, 1]) box(camp, "#795f40", x, 0.95, 0.8, 0.09, 1.9, 0.09);
  box(camp, "#748271", 0, 0.12, 0, 1.1, 0.2, 1.8);
  for (let i = 0; i < 7; i++) {
    const a = (i * Math.PI * 2) / 7;
    rock(camp, Math.cos(a) * 0.65, 2.2 + Math.sin(a) * 0.65, 0.15);
  }
  const charcoal = log(camp, 0, 0.1, 2.2, 0.65);
  charcoal.traverse((m) => {
    if (m.isMesh) {
      m.material = m.material.clone();
      m.material.color.set("#536050");
    }
  });
  const well = sites[1].root;
  mesh(
    new THREE.CylinderGeometry(0.78, 0.9, 0.7, 10, 1, true),
    "#8d9588",
    well,
    0,
    0.35,
    0,
    { side: THREE.DoubleSide },
  );
  mesh(
    new THREE.CircleGeometry(0.72, 12),
    "#385c60",
    well,
    0,
    0.15,
    0,
  ).rotation.x = -Math.PI / 2;
  mesh(
    new THREE.TorusGeometry(0.8, 0.12, 4, 10),
    "#b2b39b",
    well,
    0,
    0.75,
    0,
  ).rotation.x = -Math.PI / 2;
  for (const x of [-1, 1]) box(well, "#8b724b", x, 1.2, 0, 0.12, 2.4, 0.12);
  box(well, "#687c68", 0, 2.3, 0, 2.7, 0.17, 1.7).rotation.z = -0.08;
  box(well, "#a68e62", 0, 1.3, 0, 2.1, 0.12, 0.12);
  box(well, "#b6ab80", 0, 1.25, 0.05, 0.025, 1.2, 0.025);
  const wagon = sites[2].root;
  wagon.rotation.y = -0.35;
  box(wagon, "#876f4c", 0, 0.65, 0, 2.4, 0.16, 1.5);
  for (const z of [-0.7, 0.7])
    for (let i = 0; i < 3; i++)
      box(wagon, "#a28b5d", 0, 0.9 + i * 0.25, z, 2.4, 0.18, 0.09);
  for (const x of [-0.85, 0.85])
    for (const z of [-0.88, 0.88]) {
      mesh(
        new THREE.TorusGeometry(0.48, 0.09, 4, 9),
        "#5f6049",
        wagon,
        x,
        0.48,
        z,
      ).rotation.z = x;
      box(wagon, "#8c815b", x, 0.48, z, 0.06, 0.8, 0.06);
    }
  box(wagon, "#876f4c", 1.9, 0.4, 0, 1.6, 0.12, 0.12);
  for (let i = 0; i < 4; i++)
    box(
      wagon,
      "#648258",
      -0.8 + i * 0.55,
      1.1,
      0.77,
      0.1,
      0.8,
      0.06,
    ).rotation.z = Math.sin(i) * 0.3;
  const falls = sites[3].root;
  for (const [x, z, size] of [
    [-1.4, 0, 1.3],
    [1.4, 0, 1.2],
    [-0.6, -0.5, 1.7],
    [0.8, -0.6, 1.8],
  ])
    rock(falls, x, z, size, "#879889").scale.y *= 2;
  const pool = mesh(
    new THREE.CircleGeometry(1, 16),
    "#609992",
    falls,
    0,
    0.08,
    1.6,
    { roughness: 0.4 },
  );
  pool.rotation.x = -Math.PI / 2;
  pool.scale.set(2.3, 1.6, 1);
  pool.castShadow = false;
  const sheet = mesh(
    new THREE.PlaneGeometry(0.85, 2.5),
    "#97c7bd",
    falls,
    0,
    1.35,
    0.35,
    { side: THREE.DoubleSide, roughness: 0.45 },
  );
  const streams = Array.from({ length: 6 }, (_, i) =>
    box(falls, "#c2dfcd", -0.32 + (i % 3) * 0.31, 1, 0.37, 0.045, 0.36, 0.02),
  );
  const rings = Array.from({ length: 3 }, (_, i) => {
    const r = mesh(
      new THREE.RingGeometry(0.85, 0.9, 16),
      "#b6dacc",
      falls,
      0,
      0.09 + i * 0.001,
      1.6,
      { transparent: true, opacity: 0.3, side: THREE.DoubleSide },
    );
    r.rotation.x = -Math.PI / 2;
    r.castShadow = false;
    return r;
  });
  // Арку рисует scenery.js; здесь она участвует в открытиях и сохранениях.
  sites[4].root.visible = false;
  function update(elapsed, radius) {
    for (const s of sites)
      if (s.id !== "arch") s.root.visible = Math.hypot(s.x, s.z) < radius - 1;
    streams.forEach(
      (s, i) => (s.position.y = 2.5 - ((elapsed * 1.5 + i * 0.43) % 2.3)),
    );
    rings.forEach((r, i) =>
      r.scale.setScalar(0.2 + ((elapsed * 0.4 + i / 3) % 1) * 1.8),
    );
    sheet.scale.x = 1 + Math.sin(elapsed * 4) * 0.025;
  }
  function blocked(x, z, radius) {
    return sites.some((s) => {
      if (Math.hypot(s.x, s.z) >= radius - 1) return false;
      const dx = x - s.x,
        dz = z - s.z;
      if (s.id === "well") return Math.hypot(dx, dz) < 1.15;
      if (s.id === "old-camp") return Math.abs(dx) < 1.3 && Math.abs(dz) < 1.1;
      if (s.id === "wagon") return Math.hypot(dx / 1.65, dz / 1.2) < 1;
      if (s.id === "falls") return Math.hypot(dx / 2.55, (dz - 1.3) / 2.4) < 1;
      return false;
    });
  }
  return { sites, update, blocked };
}
