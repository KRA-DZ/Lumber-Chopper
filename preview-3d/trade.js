import { character, box, mesh, log, disposeGeometry } from "./models.js";
import { shopOpen } from "./time.js";
export const BUYER_CAPACITY = 40,
  MIN_STAY = 90,
  ARRIVAL_INTERVAL = 55,
  MAX_QUEUE = 5;
export function createTrade(world, navigation) {
  const { THREE, scene } = world,
    buyers = [];
  let timer = 0,
    serial = 0;
  const exit = { x: -3.8, z: 18 };
  function spawn() {
    const person = character({ coat: serial % 2 ? "#997b58" : "#5e8584" });
    person.root.scale.setScalar(1.75);
    person.axe.children[2].visible = false;
    person.axe.children[3].visible = false;
    person.cargo.visible = false;
    scene.add(person.root);
    const cart = new THREE.Group();
    scene.add(cart);
    box(cart, "#8c6845", 0, 0.55, 0, 1.6, 0.18, 1.25);
    for (const x of [-0.78, 0.78])
      box(cart, "#b08a56", x, 0.85, 0, 0.12, 0.55, 1.3);
    box(cart, "#b08a56", 0, 0.85, -0.6, 1.6, 0.55, 0.1);
    const wheels = [];
    for (const x of [-0.85, 0.85])
      for (const z of [-0.43, 0.43]) {
        const w = mesh(
          new THREE.CylinderGeometry(0.28, 0.28, 0.12, 8),
          "#514b3b",
          cart,
          x,
          0.28,
          z,
        );
        w.rotation.z = Math.PI / 2;
        wheels.push(w);
      }
    box(cart, "#8c6845", 0, 0.6, 1.2, 0.12, 0.12, 1.2);
    const cargo = new THREE.Group();
    cart.add(cargo);
    const b = {
      id: serial++,
      x: exit.x,
      z: exit.z,
      person,
      cart,
      cargo,
      wheels,
      load: 0,
      wait: 0,
      phase: "arriving",
      slot: 0,
      path: [],
      route: "",
    };
    buyers.push(b);
    return b;
  }
  function active(time) {
    return shopOpen(time)
      ? buyers.find(
          (b) =>
            b.phase === "waiting" && b.slot === 0 && b.load < BUYER_CAPACITY,
        )
      : null;
  }
  function receive(b) {
    b.load++;
    if (b.cargo.children.length < 12) {
      const i = b.cargo.children.length;
      const l = log(
        b.cargo,
        -0.5 + (i % 3) * 0.5,
        1.02 + Math.floor(i / 3) * 0.28,
        0,
        0.85,
      );
      l.rotation.y = Math.PI / 2;
    }
  }
  function update(dt, time, level) {
    timer -= dt;
    const open = shopOpen(time);
    if (
      open &&
      timer <= 0 &&
      buyers.filter((b) => b.phase !== "leaving").length < MAX_QUEUE
    ) {
      spawn();
      timer = ARRIVAL_INTERVAL;
    }
    for (const b of buyers)
      if (
        !open ||
        (b.slot === 0 && b.load >= BUYER_CAPACITY && b.wait >= MIN_STAY)
      )
        b.phase = "leaving";
    buyers
      .filter((b) => b.phase !== "leaving")
      .sort((a, b) => a.id - b.id)
      .forEach((b, i) => (b.slot = i));
    for (let i = buyers.length - 1; i >= 0; i--) {
      const b = buyers[i],
        target =
          b.phase === "leaving" ? exit : { x: -3.8, z: 6.8 + b.slot * 2.25 },
        route = `${b.phase === "leaving" ? "exit" : b.slot}:${level}`;
      if (b.route !== route) {
        b.path = navigation.pathTo(target, b);
        b.route = route;
      }
      let budget = dt * 2.5,
        moved = 0;
      const oldX = b.x,
        oldZ = b.z;
      while (budget > 0 && b.path.length) {
        const p = b.path[0],
          dx = p.x - b.x,
          dz = p.z - b.z,
          d = Math.hypot(dx, dz);
        if (d < 0.08) {
          b.path.shift();
          continue;
        }
        const step = Math.min(d, budget),
          ox = b.x,
          oz = b.z;
        navigation.moveBody(b, (dx / d) * step, (dz / d) * step);
        moved += Math.hypot(b.x - ox, b.z - oz);
        budget -= step;
        if (Math.hypot(b.x - ox, b.z - oz) < 0.001) break;
      }
      if (Math.hypot(b.x - target.x, b.z - target.z) < 0.15) {
        if (b.phase === "leaving") {
          scene.remove(b.person.root, b.cart);
          b.person.face.traverse((m) => m.material?.dispose());
          for (const root of [b.person.root, b.cart]) disposeGeometry(root);
          buyers.splice(i, 1);
          continue;
        }
        b.phase = b.slot === 0 ? "waiting" : "queued";
        b.wait += dt;
      }
      const walking = moved > 0.001;
      const t = time + b.id;
      b.person.root.position.set(b.x, 0, b.z);
      const hero = navigation.player,
        neighbor = buyers.find(
          (other) =>
            other !== b &&
            other.phase !== "leaving" &&
            Math.hypot(other.x - b.x, other.z - b.z) < 3,
        ),
        lookAt =
          hero && Math.hypot(hero.x - b.x, hero.z - b.z) < 5 ? hero : neighbor,
        greeting = !walking && lookAt && Math.floor(t / 5) % 3 === 0,
        sleepy = !walking && b.wait > 25 && Math.floor(t / 8) % 4 === 0;
      const facing = walking
        ? Math.atan2(b.x - oldX, b.z - oldZ)
        : greeting
          ? Math.atan2(lookAt.x - b.x, lookAt.z - b.z)
          : Math.sin(t * 0.4) * 0.25;
      b.person.root.rotation.y +=
        Math.atan2(
          Math.sin(facing - b.person.root.rotation.y),
          Math.cos(facing - b.person.root.rotation.y),
        ) * Math.min(1, dt * 6);
      b.person.body.position.y = walking
        ? Math.abs(Math.sin(t * 10)) * 0.05
        : Math.sin(t * 2) * 0.015;
      b.person.legs.forEach(
        (leg, j) =>
          (leg.rotation.x = walking
            ? Math.sin(t * 10 + j * Math.PI) * 0.45
            : 0),
      );
      b.person.arm.rotation.z = walking
        ? 0
        : greeting || Math.floor(t / 6) % 3 === 0
          ? -0.9 + Math.sin(t * 7) * 0.15
          : 0;
      b.person.axe.rotation.x = sleepy ? -1 : 0;
      b.person.animateFace(
        t,
        sleepy ? "sleepy" : greeting || b.load > 0 ? "celebrate" : "happy",
      );
      b.cart.position.set(b.x + 1.8, 0, b.z + 0.3);
      b.wheels.forEach((w) => {
        if (walking) w.rotation.x += dt * 5;
      });
    }
  }
  return { buyers, active, receive, update, spawn };
}
