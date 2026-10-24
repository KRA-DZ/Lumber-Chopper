import * as THREE from "./vendor/three.module.min.js";
import { box, mesh } from "./models.js";
import { nightAmount } from "./time.js";

function animalModel(kind) {
  const root = new THREE.Group(),
    legs = [],
    ears = [],
    wings = [];
  const sphere = (color, x, y, z, sx, sy, sz) => {
    const m = mesh(new THREE.IcosahedronGeometry(1, 0), color, root, x, y, z);
    m.scale.set(sx, sy, sz);
    return m;
  };
  if (kind === "rabbit") {
    sphere("#c8bea0", 0, 0.38, 0, 0.32, 0.35, 0.48);
    sphere("#ddd0ab", 0, 0.64, 0.33, 0.23, 0.25, 0.23);
    sphere("#e3d9bd", 0, 0.42, -0.43, 0.16, 0.16, 0.16);
    for (const x of [-0.12, 0.12]) {
      const ear = sphere("#d5c7a8", x, 1, 0.3, 0.075, 0.35, 0.09);
      ears.push(ear);
      sphere("#374c42", x * 1.5, 0.69, 0.47, 0.035, 0.035, 0.025);
    }
    for (const x of [-0.22, 0.22])
      legs.push(box(root, "#a99c7e", x, 0.12, 0.12, 0.15, 0.18, 0.35));
  } else if (kind === "bird") {
    sphere("#64828b", 0, 0.22, 0, 0.18, 0.2, 0.28);
    sphere("#d0ba7f", 0, 0.31, 0.22, 0.11, 0.12, 0.12);
    const beak = mesh(
      new THREE.ConeGeometry(0.065, 0.18, 4),
      "#c39b4e",
      root,
      0,
      0.3,
      0.37,
    );
    beak.rotation.x = Math.PI / 2;
    for (const side of [-1, 1]) {
      const wing = box(root, "#4e6876", side * 0.24, 0.23, 0, 0.4, 0.045, 0.26);
      wings.push(wing);
      sphere("#263f3e", side * 0.08, 0.34, 0.31, 0.024, 0.024, 0.02);
    }
  } else {
    sphere("#ab8961", 0, 1.3, 0, 0.55, 0.6, 0.95);
    sphere("#bc9d72", 0, 1.9, 0.55, 0.29, 0.6, 0.3);
    sphere("#c4a77e", 0, 2.3, 0.83, 0.26, 0.28, 0.42);
    sphere("#e1d2a9", 0, 2.23, 1.15, 0.18, 0.13, 0.15);
    for (const x of [-0.35, 0.35])
      for (const z of [-0.6, 0.6])
        legs.push(box(root, "#8e7254", x, 0.56, z, 0.13, 1.1, 0.16));
    for (const side of [-1, 1]) {
      const ear = sphere("#b79970", side * 0.36, 2.5, 0.65, 0.26, 0.13, 0.11);
      ears.push(ear);
      sphere("#30463c", side * 0.22, 2.37, 1, 0.04, 0.04, 0.03);
      const antler = box(
        root,
        "#d8c9a5",
        side * 0.2,
        2.85,
        0.65,
        0.055,
        0.6,
        0.055,
      );
      antler.rotation.z = side * -0.25;
      const branch = box(
        root,
        "#d8c9a5",
        side * 0.3,
        2.95,
        0.65,
        0.35,
        0.045,
        0.045,
      );
      branch.rotation.z = side * 0.4;
    }
  }
  return { root, legs, ears, wings };
}
export function createWildlife(scene, navigation, sound) {
  let low = false;
  const animals = [
    ["deer", -13.8, 3],
    ["rabbit", 5, 10],
    ["bird", -6, 7],
    ["bird", 3, 11],
    ["rabbit", -11, -4],
    ["bird", 13, -4],
    ["rabbit", 12, 8],
    ["bird", -14, -9],
  ].map(([kind, x, z], i) => {
    const p = navigation.freePoint(x, z),
      model = animalModel(kind);
    model.root.position.set(p.x, 0, p.z);
    scene.add(model.root);
    return {
      kind,
      ...p,
      home: { ...p },
      model,
      mode: "resting",
      timer: 2 + i,
      goal: null,
      age: 0,
      enabled: true,
    };
  });
  function goalFor(a, player, flee) {
    const base = Math.atan2(a.z - player.z, a.x - player.x);
    for (let i = 0; i < 12; i++) {
      const angle = flee ? base + Math.sin(i * 2) * 0.8 : a.age * 1.7 + i * 2.4;
      const range = flee ? 5.5 : 1.8;
      const p = {
        x: (flee ? a.x : a.home.x) + Math.cos(angle) * range,
        z: (flee ? a.z : a.home.z) + Math.sin(angle) * range,
      };
      if (navigation.walkable(p.x, p.z)) return p;
    }
    return null;
  }
  function update(dt, elapsed, time, player) {
    animals.forEach((a, i) => {
      a.age += dt;
      a.timer -= dt;
      a.enabled = !low || i < 6;
      const nearby = Math.hypot(a.x - player.x, a.z - player.z);
      if (a.kind === "bird") {
        if (a.mode === "resting" && nearby < 3 && dt > 0) {
          a.mode = "flying";
          a.timer = 5;
          const angle = Math.atan2(a.z - player.z, a.x - player.x);
          a.goal = { x: Math.cos(angle), z: Math.sin(angle) };
          if (a.enabled) sound.bird(0.06);
        }
        if (a.mode === "flying") {
          a.x += a.goal.x * dt * 2.5;
          a.z += a.goal.z * dt * 2.5;
          if (a.timer <= 0) {
            a.mode = "hidden";
            a.timer = 14;
          }
        } else if (
          a.mode === "hidden" &&
          a.timer <= 0 &&
          Math.hypot(a.home.x - player.x, a.home.z - player.z) > 4
        ) {
          Object.assign(a, a.home);
          a.mode = "resting";
          a.timer = 5;
        }
        a.model.wings.forEach(
          (w, j) =>
            (w.rotation.z =
              a.mode === "flying"
                ? Math.sin(elapsed * 24 + j * Math.PI) * 0.8
                : j
                  ? 0.6
                  : -0.6),
        );
        a.model.root.position.set(
          a.x,
          a.mode === "flying"
            ? Math.min(5, (5 - a.timer) * 1.4)
            : Math.abs(Math.sin(elapsed * 3 + i)) * 0.02,
          a.z,
        );
        if (a.goal && a.mode === "flying")
          a.model.root.rotation.y = Math.atan2(a.goal.x, a.goal.z);
      } else {
        if (a.mode === "hidden") {
          if (a.timer > 0 || nearby < 4) {
            a.model.root.visible = false;
            return;
          }
          a.mode = "resting";
          a.timer = 5;
        }
        const trigger = a.kind === "deer" ? 4.5 : 3;
        if (nearby < trigger && a.mode !== "fleeing" && dt > 0) {
          a.goal = goalFor(a, player, true);
          a.mode = "fleeing";
          a.timer = 4;
        } else if (a.timer <= 0) {
          a.goal = goalFor(a, player, false);
          a.mode = a.goal ? "roaming" : "resting";
          a.timer = 6 + i;
        }
        let walking = false;
        if (a.goal && dt > 0) {
          const dx = a.goal.x - a.x,
            dz = a.goal.z - a.z,
            d = Math.hypot(dx, dz);
          const speed =
            a.mode === "fleeing" ? (a.kind === "deer" ? 3.2 : 4) : 0.65;
          if (d > 0.15) {
            const ox = a.x,
              oz = a.z,
              step = Math.min(d, dt * speed);
            navigation.moveBody(a, (dx / d) * step, (dz / d) * step);
            walking = Math.hypot(a.x - ox, a.z - oz) > 0.001;
            if (!walking) {
              a.goal = null;
              a.mode = "resting";
              a.timer = 1;
            } else a.model.root.rotation.y = Math.atan2(dx, dz);
          } else {
            const hiding = a.kind === "rabbit" && a.mode === "fleeing";
            a.goal = null;
            a.mode = hiding ? "hidden" : "resting";
            a.timer = hiding ? 6 : 5;
          }
        }
        a.model.root.position.set(
          a.x,
          walking && a.kind === "rabbit"
            ? Math.abs(Math.sin(elapsed * 12)) * 0.25
            : 0,
          a.z,
        );
        a.model.legs.forEach(
          (leg, j) =>
            (leg.rotation.x = walking
              ? Math.sin(elapsed * 9 + j * Math.PI) * 0.3
              : 0),
        );
        a.model.ears.forEach(
          (ear, j) => (ear.rotation.z = Math.sin(elapsed * 1.3 + j) * 0.1),
        );
      }
      a.model.root.visible =
        a.enabled &&
        a.mode !== "hidden" &&
        nearby < 24 &&
        nightAmount(time) < 0.8;
    });
  }
  return {
    animals,
    update,
    setLow(value) {
      low = value;
    },
  };
}
