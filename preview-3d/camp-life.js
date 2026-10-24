import * as THREE from "./vendor/three.module.min.js";
import { box, mesh, log } from "./models.js";
import { nightAmount } from "./time.js";

export function createCampLife(scene, campsite, campWorld) {
  const details = [];
  function stage(minLevel) {
    const g = new THREE.Group();
    scene.add(g);
    details.push({ g, minLevel });
    return g;
  }
  const starter = stage(0);
  // Низкие бытовые предметы — декорации, их можно перешагивать.
  for (let i = 0; i < 2; i++) {
    const crate = box(
      starter,
      i ? "#b79761" : "#9b7c51",
      -2.6,
      0.3 + i * 0.55,
      -1.1,
      0.75,
      0.55,
      0.65,
    );
    crate.rotation.y = i * 0.15;
    box(starter, "#75623e", -2.6, 0.3 + i * 0.55, -0.76, 0.75, 0.08, 0.04);
  }
  const hearth = stage(1);
  box(hearth, "#a98454", 2.6, 0.48, 0.2, 1.9, 0.16, 0.65);
  for (const x of [1.95, 3.25])
    box(hearth, "#755f3f", x, 0.23, 0.2, 0.18, 0.46, 0.5);
  for (let i = 0; i < 3; i++) log(hearth, -1.9, 0.25 + i * 0.3, 0.5, 0.8);
  const kettle = mesh(
    new THREE.SphereGeometry(0.23, 8, 5),
    "#52625d",
    hearth,
    0.9,
    0.35,
    -0.3,
  );
  kettle.scale.y = 0.8;
  mesh(
    new THREE.TorusGeometry(0.18, 0.025, 4, 8, Math.PI),
    "#52625d",
    hearth,
    0.9,
    0.48,
    -0.3,
  );
  const domestic = stage(2);
  mesh(
    new THREE.CylinderGeometry(0.32, 0.3, 0.7, 9),
    "#a38456",
    domestic,
    -2.9,
    0.35,
    -4.3,
  );
  for (const y of [0.14, 0.55])
    mesh(
      new THREE.TorusGeometry(0.32, 0.025, 4, 9),
      "#626d5b",
      domestic,
      -2.9,
      y,
      -4.3,
    ).rotation.x = Math.PI / 2;
  const rope = box(domestic, "#9b8b60", -3.5, 1.6, -1.9, 0.025, 0.025, 3.2);
  for (const z of [-3.5, -0.3])
    box(domestic, "#85764e", -3.5, 0.85, z, 0.065, 1.7, 0.065);
  const laundry = box(domestic, "#b5c3b0", -3.5, 1.28, -2.3, 0.035, 0.64, 0.75);
  const complete = stage(4);
  for (let i = 0; i < 4; i++)
    log(complete, 3, 0.25 + Math.floor(i / 2) * 0.32, -4 + (i % 2) * 0.5, 1);
  box(complete, "#a18150", 0, 0.12, -1.1, 1.6, 0.24, 0.65);

  const dummy = new THREE.Object3D();
  const smokeMaterial = new THREE.MeshBasicMaterial({
    color: "#d4d7c4",
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
  });
  const smoke = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.3, 0),
    smokeMaterial,
    18,
  );
  smoke.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  smoke.frustumCulled = false;
  scene.add(smoke);
  const sparkMaterial = new THREE.MeshBasicMaterial({
    color: "#ffce76",
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  const sparks = new THREE.InstancedMesh(
    new THREE.OctahedronGeometry(0.025),
    sparkMaterial,
    12,
  );
  sparks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  sparks.frustumCulled = false;
  scene.add(sparks);
  function update(elapsed, time, level) {
    details.forEach(({ g, minLevel }) => (g.visible = level >= minLevel));
    campsite.cloth.rotation.z = Math.sin(elapsed * 1.2) * 0.009;
    campWorld.merchantCloth.rotation.z = Math.sin(elapsed * 1.1 + 2) * 0.012;
    laundry.rotation.z = Math.sin(elapsed * 1.4) * 0.08;
    rope.rotation.x = Math.sin(elapsed) * 0.004;
    smoke.visible = sparks.visible = level >= 1;
    for (let i = 0; i < 18; i++) {
      const chimney = i >= 12 && level >= 4;
      const t = (elapsed * 0.16 + i / 12) % 1;
      dummy.position.set(
        (chimney ? 1.344 : 0) + Math.sin(elapsed * 0.5 + i) * t * 0.5 + t * 0.5,
        (chimney ? 5.05 : 1.2) + t * 2.6,
        (chimney ? -4.616 : 0) + Math.cos(i) * t * 0.35,
      );
      dummy.scale.setScalar(Math.sin(t * Math.PI) * (0.35 + t * 0.7));
      dummy.rotation.set(t, i, elapsed * 0.1);
      dummy.updateMatrix();
      smoke.setMatrixAt(i, dummy.matrix);
    }
    for (let i = 0; i < 12; i++) {
      const t = (elapsed * 0.38 + i / 12) % 1;
      dummy.position.set(
        Math.sin(i * 3 + t) * (0.2 + t * 0.4),
        0.8 + t * 1.9,
        Math.cos(i * 4) * 0.3,
      );
      dummy.scale.setScalar(1 - t);
      dummy.updateMatrix();
      sparks.setMatrixAt(i, dummy.matrix);
    }
    smoke.instanceMatrix.needsUpdate = sparks.instanceMatrix.needsUpdate = true;
    sparkMaterial.opacity = 0.45 + nightAmount(time) * 0.5;
    campWorld.windowGlow.material.emissive.set("#e8ad54");
    campWorld.windowGlow.material.emissiveIntensity = nightAmount(time) * 0.65;
  }
  return { update, smoke, sparks, details };
}
