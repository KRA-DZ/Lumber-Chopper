import * as THREE from "./vendor/three.module.min.js";
import { log } from "./models.js";

// Эффекты не меняют экономику: ресурс выдаётся ровно один раз при обнулении HP.
export function createWoodEffects(scene) {
  const dummy = new THREE.Object3D(),
    chips = [],
    falls = [],
    flights = [],
    labels = [];
  const chipMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.1, 0.06, 0.18),
    new THREE.MeshStandardMaterial({ color: "#ddbd80", flatShading: true }),
    64,
  );
  chipMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  chipMesh.frustumCulled = false;
  chipMesh.count = 0;
  scene.add(chipMesh);
  const textures = new Map();
  function label(text, color, x, y, z) {
    if (typeof document === "undefined") return;
    if (!textures.has(text + color)) {
      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 64;
      const ctx = canvas.getContext("2d");
      ctx.font = "bold 40px sans-serif";
      ctx.textAlign = "center";
      ctx.lineWidth = 5;
      ctx.strokeStyle = "#304635";
      ctx.strokeText(text, 64, 47);
      ctx.fillStyle = color;
      ctx.fillText(text, 64, 47);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      textures.set(text + color, texture);
    }
    if (labels.length >= 16) removeLabel(labels.shift());
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: textures.get(text + color),
        depthTest: false,
        transparent: true,
      }),
    );
    sprite.position.set(x, y, z);
    sprite.scale.set(1.4, 0.7, 1);
    scene.add(sprite);
    labels.push({ sprite, age: 0 });
  }
  function removeLabel(l) {
    scene.remove(l.sprite);
    l.sprite.material.dispose();
  }
  function strike(t, player) {
    const angle = Math.atan2(player.z - t.z, player.x - t.x);
    for (let i = 0; i < 7; i++) {
      if (chips.length >= 64) chips.shift();
      const a = angle + (Math.random() - 0.5) * 2;
      chips.push({
        x: t.x,
        y: 1.15,
        z: t.z,
        vx: Math.cos(a) * (1 + Math.random() * 2),
        vy: 2 + Math.random() * 2,
        vz: Math.sin(a) * (1 + Math.random() * 2),
        age: 0,
      });
    }
    label("−1", "#f4e2b3", t.x, 2.4, t.z);
  }
  function removeFall(f) {
    scene.remove(f.root);
    // Геометрия общая с деревом; освобождаем только материал временной копии.
    f.root.traverse((m) => {
      if (m.isMesh) m.material.dispose();
    });
  }
  function copyTreePart(source) {
    // Object3D.clone сериализует userData, а там есть циклическая ссылка на дерево.
    // В визуальный дубль переносим только геометрию и трансформации.
    const copy = source.isMesh
      ? new THREE.Mesh(source.geometry, source.material.clone())
      : new THREE.Group();
    copy.position.copy(source.position);
    copy.quaternion.copy(source.quaternion);
    copy.scale.copy(source.scale);
    if (copy.isMesh) {
      copy.material.transparent = true;
      copy.material.opacity = 1;
      copy.castShadow = source.castShadow;
      copy.receiveShadow = source.receiveShadow;
    }
    for (const child of source.children) copy.add(copyTreePart(child));
    return copy;
  }
  function fell(t, player) {
    if (falls.length >= 4) removeFall(falls.shift());
    const root = new THREE.Group(),
      pivot = new THREE.Group();
    root.position.set(t.x, 0.3, t.z);
    root.scale.copy(t.root.scale);
    pivot.rotation.y = t.root.rotation.y;
    root.add(pivot);
    for (const source of [t.trunk, t.canopy]) {
      pivot.add(copyTreePart(source));
    }
    const direction = new THREE.Vector3(
      t.x - player.x,
      0,
      t.z - player.z,
    ).normalize();
    if (direction.lengthSq() === 0) direction.z = -1;
    const axis = new THREE.Vector3(direction.z, 0, -direction.x);
    scene.add(root);
    falls.push({ root, age: 0, axis });
    const flyingLog = log(scene, t.x, 1, t.z, 1.35);
    flights.push({
      root: flyingLog,
      start: flyingLog.position.clone(),
      age: 0,
    });
    label("+1", "#e8d18c", t.x, 3.1, t.z);
  }
  function update(dt, player, cargoHeight) {
    for (let i = chips.length - 1; i >= 0; i--) {
      const c = chips[i];
      c.age += dt;
      c.vy -= dt * 8;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.z += c.vz * dt;
      if (c.age > 0.75 || c.y < 0) chips.splice(i, 1);
    }
    chipMesh.count = chips.length;
    chips.forEach((c, i) => {
      dummy.position.set(c.x, c.y, c.z);
      dummy.rotation.set(c.age * 10, i, c.age * 8);
      dummy.scale.setScalar(1 - c.age * 0.65);
      dummy.updateMatrix();
      chipMesh.setMatrixAt(i, dummy.matrix);
    });
    chipMesh.instanceMatrix.needsUpdate = true;
    for (let i = falls.length - 1; i >= 0; i--) {
      const f = falls[i];
      f.age += dt;
      const t = Math.min(1, f.age / 0.65);
      f.root.quaternion.setFromAxisAngle(f.axis, t * t * Math.PI * 0.48);
      if (f.age > 0.65) {
        const opacity = Math.max(0, 1 - (f.age - 0.65) / 0.5);
        f.root.traverse((m) => {
          if (m.isMesh) m.material.opacity = opacity;
        });
      }
      if (f.age >= 1.15) {
        removeFall(f);
        falls.splice(i, 1);
      }
    }
    for (let i = flights.length - 1; i >= 0; i--) {
      const f = flights[i];
      f.age += dt;
      const t = Math.min(1, Math.max(0, (f.age - 0.2) / 0.55)),
        ease = t * t * (3 - 2 * t);
      f.root.position.set(
        THREE.MathUtils.lerp(f.start.x, player.x, ease),
        THREE.MathUtils.lerp(1, cargoHeight, ease) +
          Math.sin((f.age / 0.75) * Math.PI) * 1.5,
        THREE.MathUtils.lerp(f.start.z, player.z, ease),
      );
      f.root.rotation.y = f.age * 6;
      if (f.age >= 0.75) {
        scene.remove(f.root);
        f.root.traverse((m) => m.geometry?.dispose());
        flights.splice(i, 1);
      }
    }
    for (let i = labels.length - 1; i >= 0; i--) {
      const l = labels[i];
      l.age += dt;
      l.sprite.position.y += dt * 0.75;
      l.sprite.material.opacity = Math.max(0, 1 - l.age / 0.85);
      if (l.age >= 0.85) {
        removeLabel(l);
        labels.splice(i, 1);
      }
    }
  }
  return { strike, fell, update, flights, falls, chips, chipMesh };
}
