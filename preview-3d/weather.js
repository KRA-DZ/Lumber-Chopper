import * as THREE from "./vendor/three.module.min.js";
import { normalizedTime } from "./time.js";

const smooth = (a, b, t) => THREE.MathUtils.smoothstep(t, a, b);
export function weatherAt(time, mode = "auto") {
  if (mode === "rain") return { rain: 1, cloud: 1, name: "Лёгкий дождь" };
  if (mode === "clear") return { rain: 0, cloud: 0.1, name: "Ясно" };
  const t = normalizedTime(time);
  const rain = smooth(320, 370, t) * (1 - smooth(470, 530, t));
  const cloud = Math.max(
    0.12,
    smooth(260, 330, t) * (1 - smooth(520, 600, t)),
    0.6 * smooth(820, 900, t) * (1 - smooth(1020, 1100, t)),
  );
  return {
    rain,
    cloud,
    name: rain > 0.2 ? "Лёгкий дождь" : cloud > 0.4 ? "Облачно" : "Ясно",
  };
}
export function createWeather(scene, pond) {
  const MAX_DROPS = 200,
    data = new Float32Array(MAX_DROPS * 6);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(data, 3).setUsage(THREE.DynamicDrawUsage),
  );
  const rain = new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({
      color: "#c5d9d3",
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );
  rain.frustumCulled = false;
  scene.add(rain);
  const shadow = new THREE.InstancedMesh(
    new THREE.CircleGeometry(1, 18),
    new THREE.MeshBasicMaterial({
      color: "#42585a",
      transparent: true,
      opacity: 0.035,
      depthWrite: false,
    }),
    7,
  );
  shadow.frustumCulled = false;
  scene.add(shadow);
  const splashes = new THREE.InstancedMesh(
    new THREE.RingGeometry(0.85, 1, 12),
    new THREE.MeshBasicMaterial({
      color: "#c9e2d7",
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    18,
  );
  splashes.frustumCulled = false;
  scene.add(splashes);
  const dummy = new THREE.Object3D();
  const current = { rain: 0, cloud: 0.12, name: "Ясно" };
  let mode = "auto",
    low = false;
  function update(dt, elapsed, time, player) {
    const target = weatherAt(time, mode),
      rate = dt === 0 ? 1 : 1 - Math.exp(-dt * 0.8);
    current.rain += (target.rain - current.rain) * rate;
    current.cloud += (target.cloud - current.cloud) * rate;
    current.name = target.name;
    const count = low ? 80 : MAX_DROPS;
    rain.visible = splashes.visible = current.rain > 0.02;
    rain.material.opacity = current.rain * 0.45;
    geometry.setDrawRange(0, count * 2);
    for (let i = 0; i < count; i++) {
      const x = player.x + Math.sin(i * 127.1) * 10,
        z = player.z + Math.cos(i * 311.7) * 9,
        y = 12 - ((elapsed * 10 + i * 1.71) % 12),
        j = i * 6;
      data[j] = x;
      data[j + 1] = y;
      data[j + 2] = z;
      data[j + 3] = x - 0.12;
      data[j + 4] = y + 0.65;
      data[j + 5] = z + 0.06;
    }
    geometry.attributes.position.needsUpdate = true;
    shadow.material.opacity = 0.025 + current.cloud * 0.045;
    for (let i = 0; i < 7; i++) {
      dummy.position.set(
        player.x + Math.sin(elapsed * 0.018 + i * 2) * 19,
        0.08 + i * 0.001,
        player.z + Math.cos(elapsed * 0.015 + i) * 17,
      );
      dummy.rotation.set(-Math.PI / 2, 0, i);
      dummy.scale.set(4 + (i % 3), 2.8 + (i % 2), 1);
      dummy.updateMatrix();
      shadow.setMatrixAt(i, dummy.matrix);
    }
    for (let i = 0; i < 18; i++) {
      const t = (elapsed * 1.4 + i * 0.17) % 1;
      dummy.position.set(
        pond.x + Math.sin(i * 2.1) * pond.rx * 0.8,
        0.085 + i * 0.0001,
        pond.z + Math.cos(i * 2.7) * pond.rz * 0.8,
      );
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.setScalar(Math.sin(t * Math.PI) * 0.18);
      dummy.updateMatrix();
      splashes.setMatrixAt(i, dummy.matrix);
    }
    splashes.material.opacity = current.rain * 0.4;
    shadow.instanceMatrix.needsUpdate =
      splashes.instanceMatrix.needsUpdate = true;
  }
  function cycle() {
    mode = ["auto", "rain", "clear"][
      (["auto", "rain", "clear"].indexOf(mode) + 1) % 3
    ];
    return mode;
  }
  return {
    current,
    rain,
    splashes,
    shadow,
    update,
    cycle,
    get mode() {
      return mode;
    },
    setLow(value) {
      low = value;
    },
  };
}
