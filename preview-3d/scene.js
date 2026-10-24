import * as THREE from "./vendor/three.module.min.js";
import { mesh, rock, tree, camp, box } from "./models.js";
import { nightAmount } from "./time.js";
export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#b9c6b6");
  scene.fog = new THREE.Fog("#b9c6b6", 85, 150);
  const camera = new THREE.OrthographicCamera(-20, 20, 16, -16, 0.1, 200);
  camera.position.set(25, 43, 29);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight("#ecedcf", "#456459", 2.1));
  const sun = new THREE.DirectionalLight("#fff1ca", 3.1);
  sun.position.set(-15, 28, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, {
    left: -26,
    right: 26,
    top: 26,
    bottom: -26,
    near: 1,
    far: 70,
  });
  sun.shadow.normalBias = 0.04;
  sun.shadow.bias = -0.00015;
  scene.add(sun);
  const earth = mesh(
    new THREE.CylinderGeometry(46, 46.2, 1.9, 64),
    "#768b60",
    scene,
    0,
    -1,
    0,
  );
  earth.receiveShadow = true;
  const grass = mesh(
    new THREE.CylinderGeometry(45.9, 45.9, 0.06, 64),
    "#6f945f",
    scene,
    0,
    -0.015,
    0,
  );
  const clearing = mesh(
    new THREE.CircleGeometry(7.4, 17),
    "#a5ad78",
    scene,
    0,
    0.022,
    0,
  );
  clearing.rotation.x = -Math.PI / 2;
  const center = mesh(
    new THREE.CircleGeometry(5.8, 13),
    "#b5ac7f",
    scene,
    0,
    0.03,
    0,
  );
  center.rotation.x = -Math.PI / 2;
  center.rotation.z = 0.3;
  // A faceted pool is a real surface, with shallows and gently animated highlights.
  const pond = { x: -9, z: 4, rx: 3.9, rz: 2.8 };
  const bank = mesh(
    new THREE.CylinderGeometry(1, 1, 0.08, 14),
    "#b8b188",
    scene,
    pond.x,
    0.015,
    pond.z,
  );
  bank.scale.set(pond.rx + 0.3, 1, pond.rz + 0.3);
  const water = mesh(
    new THREE.CircleGeometry(1, 14),
    "#658f8e",
    scene,
    pond.x,
    0.065,
    pond.z,
    { roughness: 0.36, metalness: 0.1 },
  );
  water.rotation.x = -Math.PI / 2;
  water.scale.set(pond.rx, pond.rz, 1);
  const ripples = [];
  for (let i = 0; i < 6; i++) {
    const r = mesh(
      new THREE.RingGeometry(0.23, 0.25, 16),
      "#bdd5bd",
      scene,
      pond.x + Math.sin(i * 4) * 2.4,
      0.075,
      pond.z + Math.cos(i * 3) * 1.5,
      { transparent: true, opacity: 0.45, side: THREE.DoubleSide },
    );
    r.rotation.x = -Math.PI / 2;
    ripples.push(r);
  }
  const bridge = new THREE.Group();
  bridge.position.set(-9.2, 0.05, 6.5);
  bridge.rotation.y = 0.15;
  scene.add(bridge);
  for (let i = 0; i < 12; i++)
    box(
      bridge,
      i % 2 ? "#ae8856" : "#bc9964",
      -2.2 + i * 0.4,
      0.18,
      0,
      0.36,
      0.16,
      1.4,
    );
  for (const x of [-2.4, 2.4])
    for (const z of [-0.7, 0.7])
      box(bridge, "#836641", x, 0.5, z, 0.16, 0.95, 0.16);
  const fireLight = new THREE.PointLight("#ffb64e", 12, 9, 2);
  fireLight.position.set(0, 1.1, 0);
  scene.add(fireLight);
  const campsite = camp(scene);
  let seed = 834;
  const rnd = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const trees = [];
  for (let i = 0; i < 2600 && trees.length < 400; i++) {
    const a = rnd() * Math.PI * 2,
      r = 8 + rnd() * 35,
      x = Math.cos(a) * r,
      z = Math.sin(a) * r;
    if (
      ((x - pond.x) / 5) ** 2 + ((z - pond.z) / 4) ** 2 < 1 ||
      Math.hypot(x - 15, z + 12) < 5.3 ||
      trees.some((t) => Math.hypot(x - t.x, z - t.z) < 1.9) ||
      (Math.abs(x + 3) < 2 && z > 6)
    )
      continue;
    const t = tree(["pine", "birch", "oak"][i % 3], x, z, trees.length);
    t.value =
      ["pine", "birch", "oak"][i % 3] === "pine"
        ? 15
        : ["pine", "birch", "oak"][i % 3] === "birch"
          ? 12
          : 10;
    t.scale = 0.85 + rnd() * 0.4;
    t.root.scale.set(t.scale * 1.35, t.scale * 1.85, t.scale * 1.35);
    // Стабильные id сохраняют старые пни, даже если часть посадки прорежена.
    t.active =
      t.id % 2 === 0 &&
      t.id % 10 !== 0 &&
      !(Math.abs(x) < 6 && z > 5 && z < 11) &&
      !(x > -7 && x < -0.3 && z > 5 && z < 20) &&
      !(Math.abs(z - 2) < 1.7 && x > 6 && x < 18);
    t.leaves = [];
    t.canopy.traverse((m) => {
      if (m.isMesh) {
        m.material = m.material.clone();
        m.material.transparent = true;
        t.leaves.push(m);
      }
    });
    t.root.rotation.y = rnd() * 6;
    scene.add(t.root);
    t.root.traverse((m) => {
      m.userData.tree = t;
    });
    trees.push(t);
  }
  for (let i = 0; i < 24; i++) {
    const a = rnd() * Math.PI * 2,
      r = 6 + rnd() * 15;
    rock(
      scene,
      Math.cos(a) * r,
      Math.sin(a) * r,
      0.18 + rnd() * 0.45,
      ["#929c87", "#818f83", "#a6ad95"][i % 3],
    );
  }
  // Reeds and flowers stay decorative and never obstruct feet.
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2,
      x = pond.x + Math.cos(a) * 4.25,
      z = pond.z + Math.sin(a) * 3.15;
    const reed = box(scene, "#6d8657", x, 0.3, z, 0.055, 0.6, 0.055);
    reed.rotation.z = 0.1;
  }
  for (let i = 0; i < 28; i++) {
    const a = rnd() * Math.PI * 2,
      r = 5 + rnd() * 15,
      x = Math.cos(a) * r,
      z = Math.sin(a) * r;
    if (((x - pond.x) / 4.5) ** 2 + ((z - pond.z) / 3.5) ** 2 < 1) continue;
    const stem = box(scene, "#789459", x, 0.12, z, 0.03, 0.24, 0.03);
    mesh(
      new THREE.IcosahedronGeometry(0.07, 0),
      i % 3 ? "#e1d4a2" : "#c9a382",
      scene,
      x,
      0.27,
      z,
    );
  }
  const marker = mesh(
    new THREE.RingGeometry(0.28, 0.34, 24),
    "#f5e6b5",
    scene,
    0,
    0.1,
    0,
    { transparent: true, opacity: 0.8, side: THREE.DoubleSide },
  );
  marker.rotation.x = -Math.PI / 2;
  marker.visible = false;
  let height = 25;
  function resize() {
    const rect = canvas.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height, false);
    const aspect = rect.width / rect.height;
    const h = height * (aspect < 0.9 ? 1.1 : 1);
    camera.left = (-h * aspect) / 2;
    camera.right = (h * aspect) / 2;
    camera.top = h / 2;
    camera.bottom = -h / 2;
    camera.updateProjectionMatrix();
  }
  function zoom(delta) {
    height = THREE.MathUtils.clamp(height + delta, 18, 42);
    resize();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  const cameraAnchor = new THREE.Vector3(),
    cameraOffset = new THREE.Vector3(25, 43, 29);
  function followCamera(target, dt, immediate = false) {
    if (immediate) cameraAnchor.copy(target);
    else {
      const delta = target.clone().sub(cameraAnchor);
      delta.y = 0;
      const distance = delta.length();
      if (distance > 3.5)
        cameraAnchor.addScaledVector(
          delta,
          ((distance - 3.5) / distance) * (1 - Math.exp(-dt * 4)),
        );
    }
    camera.position.copy(cameraAnchor).add(cameraOffset);
    camera.lookAt(cameraAnchor);
    updateFocus(cameraAnchor);
  }
  function updateFocus(focus) {
    sun.position.copy(focus).add(new THREE.Vector3(-15, 28, 10));
    sun.target.position.copy(focus);
    sun.target.updateMatrixWorld();
  }
  const lanterns = [];
  for (const [x, z] of [
    [-4.2, 2.4],
    [5.5, -1.8],
  ]) {
    box(scene, "#786341", x, 1, z, 0.1, 2, 0.1);
    box(scene, "#d7b16c", x, 2, z, 0.25, 0.35, 0.25);
    const light = new THREE.PointLight("#ffc277", 0, 11, 2);
    light.position.set(x, 2.1, z);
    scene.add(light);
    lanterns.push(light);
  }
  function setDayTime(time) {
    const darkness = nightAmount(time);
    scene.background.copy(
      new THREE.Color("#b9c6b6").lerp(new THREE.Color("#354b62"), darkness),
    );
    scene.fog.color.copy(scene.background);
    sun.intensity = 3.1 - darkness * 2.75;
    sun.color.copy(
      new THREE.Color("#fff1ca").lerp(new THREE.Color("#90afd0"), darkness),
    );
    const hemi = scene.children.find((o) => o.isHemisphereLight);
    hemi.intensity = 2.1 - darkness * 1.1;
    hemi.color.copy(
      new THREE.Color("#ecedcf").lerp(new THREE.Color("#8097bd"), darkness),
    );
    hemi.groundColor.copy(
      new THREE.Color("#456459").lerp(new THREE.Color("#253b42"), darkness),
    );
    lanterns.forEach((l) => (l.intensity = darkness * 15));
  }
  function setDusk(dusk) {
    setDayTime(dusk ? 900 : 240);
  }
  return {
    setDusk,
    setDayTime,
    followCamera,
    THREE,
    renderer,
    scene,
    camera,
    trees,
    pond,
    campsite,
    fireLight,
    ripples,
    marker,
    resize,
    zoom,
    observer,
    sun,
    updateFocus,
  };
}
