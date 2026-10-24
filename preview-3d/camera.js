import * as THREE from "./vendor/three.module.min.js";

export const CAMERA_LIMITS = Object.freeze({
  min: 18,
  max: 21.5,
  initial: 20,
  pitch: 33,
});
export function createCameraRig() {
  const camera = new THREE.PerspectiveCamera(42, 1, 0.2, 65);
  const anchor = new THREE.Vector3(),
    focus = new THREE.Vector3();
  const pitch = THREE.MathUtils.degToRad(CAMERA_LIMITS.pitch);
  let distance = CAMERA_LIMITS.initial;
  function place() {
    camera.position
      .copy(anchor)
      .add(
        new THREE.Vector3(
          0,
          Math.sin(pitch) * distance,
          Math.cos(pitch) * distance,
        ),
      );
    camera.lookAt(anchor);
    camera.updateMatrixWorld();
  }
  function follow(target, dt, immediate = false) {
    focus.set(target.x, 1.25, target.z - 1.8);
    if (immediate) anchor.copy(focus);
    else anchor.lerp(focus, 1 - Math.exp(-dt * 4));
    place();
  }
  function resize(width, height) {
    camera.aspect = width / Math.max(1, height);
    camera.fov = camera.aspect < 0.9 ? 50 : 42;
    camera.updateProjectionMatrix();
  }
  function zoom(delta) {
    distance = THREE.MathUtils.clamp(
      distance + delta,
      CAMERA_LIMITS.min,
      CAMERA_LIMITS.max,
    );
    place();
    return distance;
  }
  place();
  return {
    camera,
    follow,
    resize,
    zoom,
    get distance() {
      return distance;
    },
  };
}
