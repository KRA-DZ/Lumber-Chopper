import * as THREE from "./vendor/three.module.min.js";

// Постройки перед камерой становятся прозрачными, только если закрывают героя.
export function createOcclusion(roots) {
  const baseOpacity = new WeakMap();
  for (const root of roots)
    root.traverse((m) => {
      if (m.isMesh) {
        m.material = m.material.clone();
        m.material.transparent = true;
        baseOpacity.set(m, m.material.opacity);
      }
    });
  const bounds = new THREE.Box3(),
    hero = new THREE.Vector3(),
    ray = new THREE.Ray(),
    point = new THREE.Vector3();
  return function update(camera, player) {
    hero.set(player.x, 2, player.z);
    ray.origin.copy(camera.position);
    ray.direction.copy(hero).sub(camera.position).normalize();
    const distance = hero.distanceTo(camera.position);
    for (const root of roots) {
      if (!root.visible) continue;
      root.updateMatrixWorld(true);
      bounds.setFromObject(root);
      const hit = ray.intersectBox(bounds, point);
      const faded = hit && point.distanceTo(camera.position) < distance - 0.8;
      root.traverse((m) => {
        if (m.isMesh)
          m.material.opacity = baseOpacity.get(m) * (faded ? 0.18 : 1);
      });
    }
  };
}
