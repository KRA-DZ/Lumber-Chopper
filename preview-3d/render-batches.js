import * as THREE from "./vendor/three.module.min.js";

// Игровые объекты остаются независимыми для HP/анимаций/выбора мышью.
// Их простые детали рисуются общими InstancedMesh с цветом на каждый экземпляр.
export function createRenderBatches(scene) {
  const groups = new Map();
  function update() {
    for (const g of groups.values()) g.items.length = 0;
    scene.traverseVisible((m) => {
      if (!m.isMesh || !m.userData.batchable || m.isInstancedMesh) return;
      m.layers.set(1); // Исходная геометрия доступна raycaster, но не рисуется дважды.
      const source = m.material;
      if (source.opacity <= 0.01) return;
      const opacity = source.opacity < 0.5 ? 0.18 : source.opacity;
      const geo = m.geometry;
      if (!geo.boundingSphere) geo.computeBoundingSphere();
      const e = m.matrixWorld.elements;
      const size =
        geo.boundingSphere.radius *
        Math.max(
          Math.hypot(e[0], e[1], e[2]),
          Math.hypot(e[4], e[5], e[6]),
          Math.hypot(e[8], e[9], e[10]),
        );
      const casts = m.castShadow && size > 0.55 && opacity === 1;
      const key = [
        geo.uuid,
        source.type,
        source.roughness,
        source.metalness,
        source.emissive?.getHex(),
        opacity,
        source.side,
        casts,
      ].join(":");
      if (!groups.has(key)) {
        const material = source.clone();
        material.color.set("#ffffff");
        material.opacity = opacity;
        material.transparent = opacity < 1;
        material.depthWrite = opacity === 1;
        groups.set(key, {
          geo,
          material,
          casts,
          items: [],
          batch: null,
          capacity: 0,
        });
      }
      groups.get(key).items.push(m);
      groups.get(key).material.emissiveIntensity = source.emissiveIntensity;
    });
    for (const g of groups.values()) {
      if (g.items.length > g.capacity) {
        if (g.batch) {
          scene.remove(g.batch);
          g.batch.dispose();
        }
        g.capacity = Math.max(8, 2 ** Math.ceil(Math.log2(g.items.length)));
        g.batch = new THREE.InstancedMesh(g.geo, g.material, g.capacity);
        g.batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        g.batch.castShadow = g.casts;
        g.batch.receiveShadow = !g.material.isMeshBasicMaterial;
        g.batch.frustumCulled = false;
        scene.add(g.batch);
      }
      if (!g.batch) continue;
      g.batch.count = g.items.length;
      g.batch.visible = g.items.length > 0;
      g.items.forEach((m, i) => {
        g.batch.setMatrixAt(i, m.matrixWorld);
        g.batch.setColorAt(i, m.material.color);
      });
      g.batch.instanceMatrix.needsUpdate = true;
      if (g.batch.instanceColor) g.batch.instanceColor.needsUpdate = true;
    }
  }
  return { update, groups };
}
