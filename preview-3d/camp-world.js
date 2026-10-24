import * as THREE from "./vendor/three.module.min.js";
import { box, mesh, tree, camp } from "./models.js";
import { RADII } from "./progress.js";
export const BUILD_PAD = { x: 4.7, z: 4.5, radius: 1.4 };
export const ANCIENT = { x: 15, z: -12, radius: 1.6 };
export const MERCHANT = { x: 9.5, z: 0.5, scale: 1.12 };
export function createCampWorld(scene, campsite) {
  function caption(text, x, z) {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 96;
    const g = c.getContext("2d");
    g.fillStyle = "#e1d5ad";
    g.fillRect(0, 0, 512, 96);
    g.strokeStyle = "#75674c";
    g.lineWidth = 7;
    g.strokeRect(3, 3, 506, 90);
    g.fillStyle = "#3d4e39";
    g.font = "bold 36px Georgia";
    g.textAlign = "center";
    g.fillText(text, 256, 61);
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture }));
    label.position.set(x, 0.65, z);
    label.scale.set(3.5, 0.65, 1);
    scene.add(label);
    return label;
  }
  caption("ПРОДАТЬ", -3.8, 6.2);
  caption("СТРОИТЬ", BUILD_PAD.x, BUILD_PAD.z + 1.8);
  caption("ВЕЛИКОЕ ДЕРЕВО", ANCIENT.x, ANCIENT.z + 3);
  const buildPad = mesh(
    new THREE.CylinderGeometry(1.4, 1.5, 0.12, 8),
    "#8dbbb0",
    scene,
    BUILD_PAD.x,
    0.06,
    BUILD_PAD.z,
  );
  // Крыша, стены и окно появляются только на четвёртой стадии.
  const hut = new THREE.Group();
  hut.position.set(0, 0, -4);
  hut.scale.setScalar(1.12);
  scene.add(hut);
  box(hut, "#9d784d", 0, 1.2, 0, 4.4, 2.4, 3.2);
  for (let i = 0; i < 7; i++)
    box(
      hut,
      i % 2 ? "#ac8858" : "#89653f",
      0,
      0.25 + i * 0.32,
      1.64,
      4.6,
      0.26,
      0.2,
    );
  const roof = mesh(
    new THREE.ConeGeometry(3.5, 2, 4),
    "#566252",
    hut,
    0,
    3.35,
    0,
  );
  roof.rotation.y = Math.PI / 4;
  roof.scale.z = 0.85;
  box(hut, "#4f513a", -0.65, 0.95, 1.79, 1, 1.9, 0.1);
  const windowGlow = box(hut, "#e8bd72", 1.1, 1.45, 1.79, 0.8, 0.8, 0.12);
  box(hut, "#78623f", 1.1, 1.45, 1.87, 0.06, 0.8, 0.05);
  box(hut, "#78623f", 1.1, 1.45, 1.87, 0.8, 0.06, 0.05);
  box(hut, "#737568", 1.2, 3.8, -0.55, 0.55, 1.3, 0.55);
  box(hut, "#586255", 1.2, 4.48, -0.55, 0.7, 0.15, 0.7);
  const fence = new THREE.Group();
  scene.add(fence);
  const fencePosts = [];
  const fenceSegments = [];
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    if (Math.sin(a) > 0.55) continue;
    const p = { x: Math.cos(a) * 7, z: Math.sin(a) * 7 };
    fencePosts.push(p);
    box(fence, "#a08455", p.x, 0.55, p.z, 0.18, 1.1, 0.18);
    const next = ((i + 1) / 28) * Math.PI * 2;
    if (Math.sin(next) <= 0.55) {
      const q = { x: Math.cos(next) * 7, z: Math.sin(next) * 7 },
        rail = box(
          fence,
          "#b99b69",
          (p.x + q.x) / 2,
          0.65,
          (p.z + q.z) / 2,
          0.1,
          0.15,
          Math.hypot(q.x - p.x, q.z - p.z),
        );
      fenceSegments.push([p, q]);
      rail.rotation.y = Math.atan2(q.x - p.x, q.z - p.z);
    }
  }
  const giant = tree("oak", ANCIENT.x, ANCIENT.z, -1);
  giant.root.scale.setScalar(3.8);
  giant.workerOnly = true;
  giant.root.traverse((m) => (m.userData.ancient = true));
  scene.add(giant.root);
  const clearing = mesh(
    new THREE.CircleGeometry(5, 15),
    "#a4ae7d",
    scene,
    ANCIENT.x,
    0.025,
    ANCIENT.z,
  );
  clearing.rotation.x = -Math.PI / 2;
  // Палатка торговца сделана из той же геометрии ткани; второй костёр/лавку не создаём.
  const merchantTent = campsite.tent.clone();
  merchantTent.position.set(MERCHANT.x, 0, MERCHANT.z);
  merchantTent.scale.setScalar(MERCHANT.scale);
  merchantTent.traverse((m) => {
    if (m.isMesh) {
      m.material = m.material.clone();
      m.material.color.lerp(new THREE.Color("#706b8d"), 0.65);
    }
  });
  scene.add(merchantTent);
  const merchant = new THREE.Group();
  merchant.position.set(MERCHANT.x, 0, MERCHANT.z + 2.2);
  merchant.scale.setScalar(1.75);
  scene.add(merchant);
  mesh(new THREE.ConeGeometry(0.4, 1.15, 6), "#4b4b65", merchant, 0, 0.58, 0);
  mesh(new THREE.ConeGeometry(0.3, 0.55, 6), "#5c5875", merchant, 0, 1.18, 0);
  box(merchant, "#233b3c", 0, 1.1, 0.25, 0.3, 0.25, 0.03);
  for (const x of [-0.08, 0.08])
    mesh(
      new THREE.IcosahedronGeometry(0.025, 0),
      "#e9cd83",
      merchant,
      x,
      1.13,
      0.28,
      { emissive: "#e9cd83" },
    );
  const boundary = mesh(
    new THREE.TorusGeometry(1, 0.004, 3, 120),
    "#dece9b",
    scene,
    0,
    0.04,
    0,
  );
  boundary.rotation.x = -Math.PI / 2;
  boundary.castShadow = false;
  const buildGroups = [campsite.fire, campsite.tent, fence, hut];
  const parts = buildGroups.map((root) => {
    root.updateMatrixWorld(true);
    const list = [];
    root.traverse((m) => {
      if (m.isMesh && m.visible) {
        const bounds = new THREE.Box3().setFromObject(m);
        list.push({
          m,
          position: m.position.clone(),
          scale: m.scale.clone(),
          height: bounds.max.y,
        });
      }
    });
    return list.sort((a, b) => a.height - b.height);
  });
  let progressLevel = -1,
    reveal = 0;
  function resetParts() {
    for (const list of parts)
      for (const p of list) {
        p.m.visible = true;
        p.m.position.copy(p.position);
        p.m.scale.copy(p.scale);
      }
  }
  let level = -1;
  function apply(next) {
    if (level === next) return;
    resetParts();
    level = next;
    campsite.fire.visible = next >= 1;
    campsite.tent.visible = next >= 2 && next < 4;
    fence.visible = next >= 3;
    hut.visible = next >= 4;
    boundary.scale.setScalar(RADII[next]);
  }
  function updateConstruction(next, paid, cost, dt) {
    if (progressLevel !== next) {
      resetParts();
      progressLevel = next;
      reveal = paid / Math.max(1, cost);
    }
    const ratio = paid / Math.max(1, cost);
    reveal += (ratio - reveal) * (dt === 0 ? 1 : 1 - Math.exp(-dt * 9));
    if (next >= 4) return;
    buildGroups[next].visible = paid > 0;
    if (next === 3 && paid > 0) campsite.tent.visible = false;
    parts[next].forEach((p, i, list) => {
      const amount = THREE.MathUtils.clamp(reveal * list.length - i, 0, 1);
      p.m.visible = amount > 0.001;
      p.m.scale.copy(p.scale);
      p.m.scale.y *= Math.max(0.01, amount);
      p.m.position.copy(p.position);
      p.m.position.y -= (1 - amount) * 0.15;
    });
  }
  function constructionTarget(next) {
    return [
      { x: 0, z: 0, y: 0.8 },
      { x: 0, z: -3.5, y: 1.6 },
      { x: 5, z: -2.5, y: 0.7 },
      { x: 0, z: -4, y: 1.7 },
    ][Math.min(3, next)];
  }
  function blocked(x, z, next) {
    if (Math.hypot(x - ANCIENT.x, z - ANCIENT.z) < ANCIENT.radius + 0.25)
      return true;
    // Скруглённые основания вместо угловатых стеновых прямоугольников.
    const rounded = (cx, cz, halfX, halfZ) =>
      Math.hypot(
        Math.max(0, Math.abs(x - cx) - halfX + 0.3),
        Math.max(0, Math.abs(z - cz) - halfZ + 0.3),
      ) < 0.3;
    if (rounded(MERCHANT.x, MERCHANT.z, 2.2, 2.05)) return true;
    if (next >= 2 && rounded(0, next >= 4 ? -4 : -3.5, 2.7, 2.2)) return true;
    if (next >= 1 && Math.hypot(x, z) < 1) return true;
    if (next >= 3 && fencePosts.some((p) => Math.hypot(x - p.x, z - p.z) < 0.3))
      return true;
    if (
      next >= 3 &&
      fenceSegments.some(([a, b]) => {
        const dx = b.x - a.x,
          dz = b.z - a.z,
          t = Math.max(
            0,
            Math.min(
              1,
              ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz),
            ),
          );
        return Math.hypot(x - a.x - dx * t, z - a.z - dz * t) < 0.28;
      })
    )
      return true;
    return false;
  }
  return {
    apply,
    updateConstruction,
    constructionTarget,
    blocked,
    buildPad,
    hut,
    windowGlow,
    fence,
    merchant,
    merchantTent,
    merchantCloth: merchantTent.children[0],
    giant,
    boundary,
  };
}
