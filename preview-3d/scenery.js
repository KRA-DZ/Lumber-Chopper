import * as THREE from "./vendor/three.module.min.js";
import { mat, box, mesh, rock } from "./models.js";
import { nightAmount } from "./time.js";

// Декор собран в инстансы: сотни листьев не создают сотни отдельных draw calls.
export function createScenery(scene, trees, pond) {
  const batches = new Map(),
    dummy = new THREE.Object3D();
  let seed = 5724;
  const random = () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  function instance(
    key,
    geometry,
    color,
    x,
    y,
    z,
    sx = 1,
    sy = sx,
    sz = sx,
    rx = 0,
    ry = 0,
    rz = 0,
  ) {
    if (!batches.has(key)) batches.set(key, { geometry, color, matrices: [] });
    dummy.position.set(x, y, z);
    dummy.scale.set(sx, sy, sz);
    dummy.rotation.set(rx, ry, rz);
    dummy.updateMatrix();
    batches.get(key).matrices.push(dummy.matrix.clone());
  }
  const disk = new THREE.CircleGeometry(1, 13),
    leaf = new THREE.ConeGeometry(0.1, 0.7, 3),
    stem = new THREE.CylinderGeometry(0.045, 0.065, 0.22, 5),
    cap = new THREE.SphereGeometry(0.19, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2);
  const patch = (key, color, x, z, sx, sz, y = 0.045) =>
    instance(
      key,
      disk,
      color,
      x,
      y,
      z,
      sx,
      sz,
      1,
      -Math.PI / 2,
      0,
      random() * 2,
    );
  patch("market-clearing", "#a5ad78", 9.5, 0.5, 3.6, 3.3);
  // Тропинки ведут от входа лагеря к очереди, пруду и поляне торговца.
  for (let i = 0; i < 23; i++) {
    patch(
      "path",
      "#a6a678",
      -3.8 + Math.sin(i * 0.32) * 0.3,
      5 + i * 0.6,
      1.7,
      0.65,
    );
    if (i < 14)
      patch("path", "#a6a678", 4 + i * 0.46, 3 - Math.sin(i * 0.2), 0.65, 1.15);
    if (i < 11)
      patch(
        "path",
        "#a6a678",
        -4.8 - i * 0.4,
        5.8 + Math.sin(i * 0.25) * 0.4,
        0.7,
        0.85,
      );
  }
  for (const t of trees.filter((t) => t.active))
    if (t.id % 3 === 0)
      patch("forest-floor", "#638756", t.x, t.z, 1.6, 1.2, 0.035);
  function decorativeSpot(x, z) {
    return (
      Math.hypot(x, z) > 8 &&
      ((x - pond.x) / 4.6) ** 2 + ((z - pond.z) / 3.5) ** 2 > 1 &&
      Math.hypot(x - 9.5, z - 0.5) > 4 &&
      Math.hypot(x - 15, z + 12) > 5 &&
      !(Math.abs(x + 3.8) < 2.5 && z > 5) &&
      !trees.some((t) => t.active && Math.hypot(x - t.x, z - t.z) < 1.2)
    );
  }
  for (let i = 0; i < 150; i++) {
    const a = random() * Math.PI * 2,
      r = 9 + random() * 32,
      x = Math.cos(a) * r,
      z = Math.sin(a) * r;
    if (!decorativeSpot(x, z)) continue;
    const size = 0.65 + random() * 0.6;
    if (i % 3) {
      for (let j = 0; j < 6; j++) {
        const angle = (j * Math.PI) / 3;
        instance(
          "fern",
          leaf,
          "#517854",
          x + Math.sin(angle) * 0.18,
          0.3 * size,
          z + Math.cos(angle) * 0.18,
          size,
          size,
          size,
          Math.cos(angle) * 0.65,
          0,
          -Math.sin(angle) * 0.65,
        );
      }
    } else {
      for (let j = 0; j < 3; j++) {
        const px = x + j * 0.25,
          pz = z + Math.sin(j * 2) * 0.2;
        instance("mushroom-stem", stem, "#e2d4ae", px, 0.12, pz, size);
        instance(
          i % 2 ? "mushroom-rust" : "mushroom-gold",
          cap,
          i % 2 ? "#b87954" : "#c3ae6c",
          px,
          0.23 * size,
          pz,
          size,
          size * 0.75,
          size,
        );
      }
    }
  }
  const bark = new THREE.CylinderGeometry(0.26, 0.32, 2.2, 7),
    end = new THREE.CircleGeometry(0.25, 7);
  for (const [x, z, a] of [
    [-15, 1, 0.5],
    [8, 16, -0.4],
    [-13, -17, 1.2],
    [24, 7, 0.2],
  ]) {
    instance(
      "fallen-bark",
      bark,
      "#7c6042",
      x,
      0.28,
      z,
      1,
      1,
      1,
      Math.PI / 2,
      0,
      -a,
    );
    instance(
      "fallen-end",
      end,
      "#c6a677",
      x + Math.sin(a) * 1.11,
      0.28,
      z + Math.cos(a) * 1.11,
      1,
      1,
      1,
      0,
      a,
    );
  }
  for (const { geometry, color, matrices } of batches.values()) {
    const batch = new THREE.InstancedMesh(
      geometry,
      mat(color, { side: THREE.DoubleSide }),
      matrices.length,
    );
    matrices.forEach((m, i) => batch.setMatrixAt(i, m));
    batch.receiveShadow = true;
    batch.castShadow = geometry !== disk;
    batch.computeBoundingSphere();
    scene.add(batch);
  }
  // Разрушенная арка — ориентир для будущей истории. Никаких врагов/награды пока нет.
  const ruin = new THREE.Group();
  ruin.position.set(-17, 0, -8);
  scene.add(ruin);
  for (const x of [-1.4, 1.4]) {
    for (let i = 0; i < 6; i++) {
      const stone = box(
        ruin,
        i % 2 ? "#879183" : "#99a08b",
        x,
        0.35 + i * 0.6,
        0,
        0.8,
        0.54,
        0.7,
      );
      stone.rotation.y = Math.sin(i + x) * 0.08;
    }
    rock(ruin, x + 0.35, 0.65, 0.3, "#7c8e70");
  }
  const lintel = box(ruin, "#899180", 0, 3.9, 0, 3.6, 0.55, 0.8);
  lintel.rotation.z = 0.04;
  const runes = [];
  for (const x of [-1.4, 1.4])
    for (let i = 0; i < 3; i++) {
      const rune = mesh(
        new THREE.OctahedronGeometry(0.08),
        "#aadbc3",
        ruin,
        x,
        0.8 + i * 0.45,
        0.37,
        { emissive: "#83c6ad", emissiveIntensity: 0 },
      );
      runes.push(rune);
    }
  const moteMaterial = new THREE.MeshBasicMaterial({
    color: "#cce8a5",
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const motes = new THREE.InstancedMesh(
    new THREE.OctahedronGeometry(0.045),
    moteMaterial,
    22,
  );
  motes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  motes.frustumCulled = false;
  scene.add(motes);
  const moteSpots = Array.from({ length: 22 }, (_, i) => ({
    x: i < 12 ? pond.x + Math.sin(i * 2.4) * 4.5 : -17 + Math.sin(i * 2) * 3,
    z: i < 12 ? pond.z + Math.cos(i * 2.1) * 3 : -8 + Math.cos(i) * 2,
    phase: random() * 10,
  }));
  function update(elapsed, time, radius) {
    const darkness = nightAmount(time);
    ruin.visible = Math.hypot(17, 8) < radius;
    runes.forEach(
      (r) =>
        (r.material.emissiveIntensity =
          darkness * (0.7 + Math.sin(elapsed * 0.7) * 0.25)),
    );
    motes.visible = darkness > 0.1;
    moteMaterial.opacity = darkness * 0.85;
    moteSpots.forEach((s, i) => {
      dummy.position.set(
        s.x + Math.sin(elapsed * 0.3 + s.phase) * 0.6,
        0.8 + Math.sin(elapsed * 0.8 + i) * 0.4,
        s.z + Math.cos(elapsed * 0.25 + s.phase) * 0.6,
      );
      dummy.rotation.set(0, elapsed, 0);
      dummy.scale.setScalar(0.6 + Math.sin(elapsed * 1.5 + i) * 0.4);
      dummy.updateMatrix();
      motes.setMatrixAt(i, dummy.matrix);
    });
    motes.instanceMatrix.needsUpdate = true;
  }
  return {
    ruin,
    motes,
    update,
    blocked: (x, z) =>
      [-18.4, -15.6].some((px) => Math.hypot(x - px, z + 8) < 0.58),
  };
}
