import { CAMP } from "../pixel-art.js";
// Bounded, renderer-independent life simulation. No timers outside the game clock.
export function createWildlife(core) {
  const { player, nav, forestRadius, nightAmount } = core;
  const { pond } = core.world;
  const merchant = core.world.merchant || CAMP.merchant;
  const {
    nearestGround,
    findPath,
    followPath,
    constrainPoint,
    moveBody,
    isWalkable,
  } = nav;
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const animals = [];
  function spawnAnimals() {
    for (let i = 0; i < 18; i++) {
      const angle = i * 2.399,
        r = 390 + (i % 5) * 185,
        pos = nearestGround(
          1600 + Math.cos(angle) * Math.min(r, forestRadius() - 80),
          1600 + Math.sin(angle) * Math.min(r, forestRadius() - 80),
        );
      animals.push({
        id: i,
        type: ["rabbit", "squirrel", "bird"][i % 3],
        x: pos.x,
        y: pos.y,
        homeX: pos.x,
        homeY: pos.y,
        angle: i,
        timer: i * 0.7,
        state: "idle",
        moving: false,
        z: 0,
      });
      if (i < 3 && (!core.accessible || core.accessible(pond))) {
        const a = animals.at(-1),
          bank = waterRestPoint(i + 1);
        a.x = bank.x;
        a.y = bank.y;
        a.state = i === 1 ? "rest" : "drink";
        a.timer = 8 + i * 3;
      }
    }
  }
  // Небольшие действия жителей не меняют экономику и не требуют новых кнопок.
  const merchantLife = {
    action: "read",
    timer: 6,
    greetCooldown: 0,
    cycle: 0,
  };
  function updateCampLife(dt) {
    merchantLife.timer -= dt;
    merchantLife.greetCooldown = Math.max(0, merchantLife.greetCooldown - dt);
    if (
      Math.hypot(player.x - merchant.x, player.y - merchant.y - 36) < 145 &&
      merchantLife.greetCooldown <= 0
    ) {
      merchantLife.action = "greet";
      merchantLife.timer = 3;
      merchantLife.greetCooldown = 16;
    } else if (merchantLife.timer <= 0) {
      merchantLife.cycle++;
      merchantLife.action = ["idle", "adjust", "read", "look", "peek"][
        merchantLife.cycle % 5
      ];
      merchantLife.timer = merchantLife.action === "adjust" ? 4 : 7;
    }
    const desired = merchantLife.action === "peek" ? 8 : 36;
    merchantLife.offset =
      (merchantLife.offset ?? 36) +
      (desired - (merchantLife.offset ?? 36)) * (1 - Math.exp(-dt * 4));
  }
  function waterRestPoint(id) {
    const angle = -0.5 + (id % 6) * 0.52;
    return nearestGround(
      pond.x + Math.cos(angle) * (pond.rx + 35),
      pond.y + Math.sin(angle) * (pond.ry + 32),
      8,
    );
  }
  function updateAnimals(dt) {
    for (const a of animals) {
      a.timer -= dt;
      const near = distance(a, player) < 100;
      if (near) {
        a.state = "flee";
        a.timer = 2.5;
        a.path = [];
        a.angle =
          Math.atan2(a.y - player.y, a.x - player.x) + (a.id % 2 ? 0.2 : -0.2);
      } else if (a.state === "flee" && a.timer <= 0) {
        a.state = "idle";
        a.timer = 3;
      } else if (a.state !== "flee") {
        if (
          nightAmount() > 0.6 &&
          a.type !== "squirrel" &&
          a.state !== "seekWater"
        ) {
          a.state = "sleep";
          a.moving = false;
        } else if (a.state === "sleep" && nightAmount() < 0.4) {
          a.state = "idle";
          a.timer = 2;
        } else if (a.state === "seekWater") {
          if (a.pathVersion !== nav.version) {
            a.path = findPath(a, a.waterTarget);
            a.pathVersion = nav.version;
          }
          const moved = followPath(a, dt, 32);
          a.moving = moved > 0.01;
          if (distance(a, a.waterTarget) < 12) {
            a.state = "drink";
            a.timer = 7;
            a.moving = false;
            a.angle = Math.atan2(pond.y - a.y, pond.x - a.x);
          } else if (!a.path.length) {
            a.state = "rest";
            a.timer = 5;
            a.moving = false;
          }
          continue;
        } else if (a.state !== "sleep" && a.timer <= 0) {
          a.cycle = (a.cycle || 0) + 1;
          if (
            a.id % 4 === 0 &&
            a.cycle % 3 === 1 &&
            (!core.accessible || core.accessible(pond))
          ) {
            a.waterTarget = waterRestPoint(a.id);
            a.path = findPath(a, a.waterTarget);
            a.pathVersion = nav.version;
            a.state = a.path.length ? "seekWater" : "rest";
            a.timer = 8;
          } else {
            a.state = ["drink", "rest"].includes(a.state)
              ? "idle"
              : a.state === "idle"
                ? "wander"
                : "rest";
            a.timer = 4 + (a.id % 5);
            a.angle += 1.7;
          }
        }
      }
      const speed =
        a.state === "flee"
          ? a.type === "bird"
            ? 165
            : 140
          : a.state === "wander"
            ? 27
            : 0;
      a.z =
        a.type === "bird" && a.state === "flee"
          ? Math.min(50, a.z + dt * 60)
          : Math.max(0, a.z - dt * 25);
      if (a.type === "bird" && a.z > 5) {
        const p = constrainPoint(
          a.x + Math.cos(a.angle) * speed * dt,
          a.y + Math.sin(a.angle) * speed * dt,
        );
        a.x = p.x;
        a.y = p.y;
        a.moving = speed > 0;
      } else {
        const moved = moveBody(
          a,
          Math.cos(a.angle) * speed * dt,
          Math.sin(a.angle) * speed * dt,
          8,
        );
        a.moving = moved > 0.01;
        if (speed && moved < speed * dt * 0.3) a.angle += 1.6;
      }
      if (a.z < 5 && !isWalkable(a.x, a.y, 8)) {
        const p = nearestGround(a.x, a.y, 8);
        a.x = p.x;
        a.y = p.y;
      }
    }
  }

  spawnAnimals();
  return {
    animals,
    merchantLife,
    update(dt) {
      if (dt <= 0 || core.paused) return;
      updateAnimals(dt);
      updateCampLife(dt);
    },
  };
}
