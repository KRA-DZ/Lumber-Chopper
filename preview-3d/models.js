import * as THREE from "./vendor/three.module.min.js";
const materials = new Map();
export function mat(color, extra = {}) {
  const key = color + JSON.stringify(extra);
  if (!materials.has(key))
    materials.set(
      key,
      new THREE.MeshStandardMaterial({
        color,
        flatShading: true,
        roughness: 1,
        ...extra,
      }),
    );
  return materials.get(key);
}
export function mesh(geo, color, parent, x = 0, y = 0, z = 0, extra = {}) {
  const m = new THREE.Mesh(geo, mat(color, extra));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}
export function box(parent, color, x, y, z, w, h, d) {
  return mesh(new THREE.BoxGeometry(w, h, d), color, parent, x, y, z);
}
export function rock(parent, x, z, size = 1, color = "#89948b") {
  const m = mesh(
    new THREE.DodecahedronGeometry(size, 0),
    color,
    parent,
    x,
    size * 0.3,
    z,
  );
  m.scale.set(1, 0.65, 0.8);
  m.rotation.set(0.2, x * 3, z);
  return m;
}
export function log(parent, x, y, z, scale = 1) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  const bark = mesh(
    new THREE.CylinderGeometry(0.18, 0.2, 1.03, 7),
    "#956742",
    g,
  );
  bark.rotation.z = Math.PI / 2;
  const end = mesh(
    new THREE.CylinderGeometry(0.155, 0.155, 0.02, 7),
    "#dfba7e",
    g,
    0.522,
    0,
    0,
  );
  end.rotation.z = Math.PI / 2;
  g.scale.setScalar(scale);
  return g;
}
export function tree(type, x, z, index) {
  const root = new THREE.Group();
  root.position.set(x, 0, z);
  const canopy = new THREE.Group();
  root.add(canopy);
  let hp = 4;
  const trunk = mesh(
    new THREE.CylinderGeometry(
      type === "birch" ? 0.11 : 0.18,
      0.25,
      type === "birch" ? 2.4 : 2.1,
      6,
    ),
    type === "birch" ? "#e6dfbf" : "#79593c",
    root,
    0,
    1.05,
    0,
  );
  if (type === "pine") {
    hp = 4;
    for (let i = 0; i < 3; i++)
      mesh(
        new THREE.ConeGeometry(1.15 - i * 0.25, 1.9 - i * 0.15, 5),
        ["#3e6755", "#4d7b5e", "#638767"][i],
        canopy,
        0,
        2.1 + i * 0.75,
        0,
      ).rotation.y = index * 0.4;
  } else {
    hp = 3;
    const shades =
      type === "birch"
        ? ["#8eaa6b", "#a7bd7e", "#c0cd96"]
        : ["#5d855b", "#759a65", "#90ab73"];
    for (let i = 0; i < 3; i++) {
      const leaf = mesh(
        new THREE.IcosahedronGeometry(0.93, 0),
        shades[i],
        canopy,
        Math.sin(i * 2.8) * 0.5,
        2.5 + i * 0.45,
        Math.cos(i * 2.8) * 0.4,
      );
      leaf.scale.set(1.12, 1.1, 1);
    }
    if (type === "birch")
      for (let i = 0; i < 5; i++) {
        const mark = box(
          canopy,
          "#61695a",
          0.08,
          0.5 + i * 0.35,
          0.105,
          0.16,
          0.045,
          0.1,
        );
        mark.rotation.y = i;
      }
  }
  const stump = mesh(
    new THREE.CylinderGeometry(0.23, 0.27, 0.27, 7),
    "#c8a46b",
    root,
    0,
    0.135,
    0,
  );
  stump.visible = false;
  return {
    id: index,
    root,
    canopy,
    trunk,
    stump,
    x,
    z,
    hp,
    maxHp: hp,
    shake: 0,
    scale: 1,
  };
}
export function character({ coat = "#b85c3b" } = {}) {
  const root = new THREE.Group(),
    body = new THREE.Group();
  root.add(body);
  const shirt = mesh(
    new THREE.CylinderGeometry(0.26, 0.3, 0.55, 6),
    coat,
    body,
    0,
    0.87,
    0,
  );
  const head = mesh(
    new THREE.IcosahedronGeometry(0.31, 1),
    "#dcb78c",
    body,
    0,
    1.4,
    0,
  );
  mesh(
    new THREE.CylinderGeometry(0.3, 0.3, 0.12, 8),
    "#b99d65",
    body,
    0,
    1.61,
    0,
  );
  const brim = mesh(
    new THREE.CylinderGeometry(0.39, 0.39, 0.04, 8),
    "#d3b57a",
    body,
    0,
    1.55,
    0,
  );
  brim.scale.z = 0.62;
  box(body, "#486666", 0, 0.75, 0.22, 0.36, 0.42, 0.08);
  for (const x of [-0.13, 0.13])
    box(body, "#c1b68b", x, 0.92, 0.265, 0.035, 0.35, 0.02);
  const legs = [];
  for (const x of [-0.14, 0.14]) {
    const p = new THREE.Group();
    p.position.set(x, 0.64, 0);
    body.add(p);
    box(p, "#394940", 0, -0.21, 0, 0.18, 0.42, 0.2);
    box(p, "#493f30", 0, -0.5, 0.07, 0.22, 0.15, 0.31);
    legs.push(p);
  }
  const arm = new THREE.Group();
  arm.position.set(-0.32, 1.05, 0);
  body.add(arm);
  box(arm, coat, 0, -0.18, 0, 0.17, 0.38, 0.19);
  mesh(new THREE.IcosahedronGeometry(0.12, 0), "#e6c99e", arm, 0, -0.4, 0);
  const axe = new THREE.Group();
  axe.position.set(0.34, 1.05, 0);
  body.add(axe);
  box(axe, coat, 0, -0.14, 0, 0.17, 0.32, 0.19);
  mesh(new THREE.IcosahedronGeometry(0.12, 0), "#e6c99e", axe, 0, -0.3, 0.1);
  box(axe, "#8a633d", 0, -0.26, 0.32, 0.055, 0.065, 0.72);
  const blade = box(axe, "#b8c6bd", 0.12, -0.26, 0.64, 0.27, 0.32, 0.075);
  blade.rotation.z = 0.2;
  const face = new THREE.Group();
  body.add(face);
  const eyes = [],
    brows = [];
  for (const x of [-0.09, 0.09]) {
    const eye = mesh(
      new THREE.SphereGeometry(0.035, 6, 4),
      "#293d37",
      face,
      x,
      1.43,
      0.295,
    );
    eyes.push(eye);
    mesh(
      new THREE.SphereGeometry(0.012, 4, 3),
      "#fbf1ce",
      face,
      x - 0.007,
      1.445,
      0.32,
    );
    const brow = box(face, "#715136", x, 1.5, 0.3, 0.085, 0.022, 0.025);
    brows.push(brow);
  }
  const smile = mesh(
    new THREE.TorusGeometry(0.065, 0.012, 3, 10, Math.PI),
    "#78533c",
    face,
    0,
    1.34,
    0.31,
  );
  smile.rotation.z = Math.PI;
  const surprise = mesh(
    new THREE.TorusGeometry(0.035, 0.014, 4, 10),
    "#78533c",
    face,
    0,
    1.34,
    0.31,
  );
  surprise.visible = false;
  mesh(new THREE.SphereGeometry(0.045, 6, 4), "#d2a375", face, 0, 1.37, 0.32);
  face.traverse((m) => {
    if (m.isMesh) {
      m.material = new THREE.MeshBasicMaterial({ color: m.material.color });
      m.castShadow = false;
      m.receiveShadow = false;
    }
  });
  function animateFace(time, mood = "happy") {
    const blink = Math.sin(time * 1.4) > 0.99;
    eyes.forEach((e) => (e.scale.y = blink ? 0.1 : 1));
    brows.forEach(
      (b, i) => (b.rotation.z = mood === "focused" ? (i ? -0.25 : 0.25) : 0),
    );
    smile.visible = mood !== "surprised";
    surprise.visible = mood === "surprised";
  }
  const cargo = new THREE.Group();
  cargo.position.set(0, 1.05, -0.22);
  body.add(cargo);
  return { root, body, legs, arm, axe, cargo, face, animateFace };
}
function trianglePrism(width, height, depth) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(0, height);
  shape.lineTo(width / 2, 0);
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    steps: 1,
  });
}
export function camp(parent) {
  const tent = new THREE.Group();
  parent.add(tent);
  tent.position.set(0, 0, -3.5);
  mesh(trianglePrism(3.9, 2.6, 3.3), "#b69c6e", tent, 0, 0, -1.65);
  const door = mesh(
    new THREE.PlaneGeometry(1.35, 1.85),
    "#394e43",
    tent,
    0,
    0.94,
    1.66,
  );
  const opening = mesh(
    trianglePrism(1.65, 2.15, 0.015),
    "#344b40",
    tent,
    0,
    0,
    1.665,
  );
  door.visible = false;
  for (const x of [-2.3, 2.3])
    box(tent, "#796642", x, 0.15, 1.9, 0.12, 0.3, 0.12);
  const fire = new THREE.Group();
  parent.add(fire);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    rock(fire, Math.cos(a) * 0.85, Math.sin(a) * 0.85, 0.23, "#8a9181");
  }
  log(fire, 0, 0.17, 0, 1.2);
  const l = log(fire, 0, 0.24, 0, 1.15);
  l.rotation.y = 1.5;
  const flames = [];
  for (let i = 0; i < 3; i++) {
    const f = mesh(
      new THREE.ConeGeometry(0.36 - i * 0.09, 0.95 - i * 0.16, 5),
      ["#e98f3c", "#f4b348", "#ffe1a0"][i],
      fire,
      i * 0.08,
      0.7 + i * 0.08,
      0,
      {
        emissive: ["#c65b20", "#f39a32", "#ffcd70"][i],
        emissiveIntensity: 0.8,
      },
    );
    flames.push(f);
  }
  const pad = mesh(
    new THREE.CylinderGeometry(1.35, 1.4, 0.12, 8),
    "#d3bf85",
    parent,
    -3.8,
    0.06,
    4.4,
  );
  const stall = new THREE.Group();
  stall.position.set(-4.2, 0, 1.7);
  parent.add(stall);
  box(stall, "#926c44", 0, 0.6, 0, 2.8, 1.2, 1.2);
  for (const x of [-1.3, 1.3]) box(stall, "#745c3e", x, 1.55, 0, 0.12, 2, 0.12);
  const roof = mesh(
    trianglePrism(3.4, 0.9, 1.9),
    "#c2a15f",
    stall,
    0,
    2.2,
    -0.95,
  );
  return { tent, flames, pad, fire, stall };
}
