import { buyerAppearance } from "./appearances.js";
import { DAY_SECONDS } from "./config.js";
export function createBuyers({ state: gameState, player, nav, getElapsed }) {
  const dayPhase = () => gameState.worldTime / DAY_SECONDS;
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const { clearSegment, findPath, followPath } = nav;
  // Очередь живёт весь торговый день; покупатель не уходит каждые несколько секунд.
  const BUYER_INTERVAL = 55,
    MAX_BUYERS = 5;
  let buyerSequence = 0,
    buyerSpawnTimer = 0;
  const buyers = [];
  const shopOpen = () => dayPhase() >= 0.06 && dayPhase() < 0.5; // 07:26–18:00 по часам мира.
  const buyerExit = { x: 1320, y: 2140 };
  function activeBuyer() {
    return shopOpen()
      ? buyers.find(
          (b) => b.phase === "waiting" && b.slot === 0 && b.load < b.capacity,
        )
      : null;
  }
  function spawnBuyer() {
    const b = {
      id: buyerSequence++,
      kind: buyerSequence % 2 === 1 ? "walker" : "cart",
      capacity: buyerSequence % 2 === 1 ? 5 : 15,
      x: buyerExit.x,
      y: buyerExit.y,
      phase: "arriving",
      load: 0,
      wait: 0,
      slot: -1,
      trip: buyerSequence,
      path: [],
      routeKey: "",
    };
    b.appearance = buyerAppearance(b.id);
    buyers.push(b);
    return b;
  }
  function updateBuyers(dt) {
    const open = shopOpen();
    buyerSpawnTimer -= dt;
    if (
      open &&
      buyerSpawnTimer <= 0 &&
      buyers.filter((b) => b.phase !== "leaving").length < MAX_BUYERS
    ) {
      spawnBuyer();
      buyerSpawnTimer = BUYER_INTERVAL;
    }
    for (const b of buyers)
      if (
        !open ||
        (b.slot === 0 && b.load >= b.capacity && (b.thanks || 0) <= 0)
      )
        b.phase = "leaving";
    const queue = buyers
      .filter((b) => b.phase !== "leaving")
      .sort((a, b) => a.id - b.id);
    queue.forEach((b, i) => (b.slot = i));
    for (let i = buyers.length - 1; i >= 0; i--) {
      const b = buyers[i],
        target =
          b.phase === "leaving"
            ? buyerExit
            : { x: 1420, y: 1775 + b.slot * 64 },
        key = `${b.phase === "leaving" ? "exit" : b.slot}:${nav.version}`;
      if (b.routeKey !== key) {
        const changedTarget = b.routeKey.split(":")[0] !== key.split(":")[0];
        if (
          changedTarget ||
          (!b.path.length && distance(b, target) > 5) ||
          b.path.some((p, i) => !clearSegment(i ? b.path[i - 1] : b, p))
        )
          b.path = findPath(b, target);
        b.routeKey = key;
      }
      const ox = b.x,
        oy = b.y,
        moved = followPath(b, dt, 64);
      b.moving = moved > 0.1;
      if (b.moving) {
        const dx = b.x - ox,
          dy = b.y - oy;
        b.direction =
          Math.abs(dx) > Math.abs(dy)
            ? dx < 0
              ? "left"
              : "right"
            : dy < 0
              ? "up"
              : "down";
      } else b.direction = "down";
      b.greetCooldown = Math.max(0, (b.greetCooldown || 0) - dt);
      b.actionTimer = Math.max(0, (b.actionTimer || 0) - dt);
      b.thanks = Math.max(0, (b.thanks || 0) - dt);
      if (!b.moving && distance(b, player) < 130 && b.greetCooldown <= 0) {
        b.action = "greet";
        b.actionTimer = 2.5;
        b.greetCooldown = 16;
      } else if (!b.moving && b.actionTimer <= 0)
        b.action = ["idle", "look", "shift", "yawn"][
          Math.floor((getElapsed() + b.id * 4) / 5) % 4
        ];
      if (distance(b, target) < 5) {
        if (b.phase === "leaving") {
          buyers.splice(i, 1);
          continue;
        }
        b.phase = b.slot === 0 ? "waiting" : "queued";
        b.wait += dt;
      }
    }
  }
  return { buyers, activeBuyer, update: updateBuyers };
}
