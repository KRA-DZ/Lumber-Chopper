import { CENTER } from "./config.js";
export const WATCHER = Object.freeze({
  sight: 300,
  hearing: 190,
  chopHearing: 420,
  notice: 0.8,
  memory: 4,
  searchSeconds: 6,
  patrolSpeed: 68,
  senseInterval: 0.2,
  attackRadius: 54,
  strikeSeconds: 0.18,
  recovery: 2,
  retreatMargin: 90,
});
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
// The state machine chooses goals only; Survival owns the shared path-search budget.
export function createWatcher({
  player,
  nav,
  accessible,
  isSafe,
  safeRadius,
  emit,
  hurt,
  damage,
  windupSeconds,
}) {
  let clock = 0,
    noise = null;
  const sight = (a, b) =>
    nav.hasLineOfSight ? nav.hasLineOfSight(a, b) : nav.clearSegment(a, b);
  function phase(m, value) {
    if (m.phase === value) return;
    const from = m.phase;
    m.phase = value;
    m.phaseTime = 0;
    m.goal = null;
    m.path = [];
    m.repath = 0;
    m.windup = 0;
    if (value !== "windup") m.attack = null;
    emit("watcher-state", {
      phase: value,
      from,
      x: m.x,
      y: m.y,
      duration: value === "windup" ? windupSeconds : undefined,
    });
  }
  function waypoint(m, around, radius) {
    for (let i = 0; i < 8; i++) {
      const angle = (m.patrolIndex || 0) * 2.399 + i * 0.8;
      const p = nav.nearestGround(
        around.x + Math.cos(angle) * radius,
        around.y + Math.sin(angle) * radius,
      );
      if (accessible(p) && !isSafe(p) && dist(p, m) > 18) {
        m.patrolIndex = (m.patrolIndex || 0) + 1;
        return p;
      }
    }
    return null;
  }
  function setGoal(m, p, speed) {
    m.goal = p ? { x: p.x, y: p.y } : null;
    m.speed = speed;
  }
  function tick(dt, m, speed) {
    clock += dt;
    m.phaseTime = (m.phaseTime || 0) + dt;
    m.goal = null;
    m.moving = false;
    m.senseTimer = (m.senseTimer || 0) - dt;
    if (m.warning > 0) {
      phase(m, "waking");
      return;
    }
    // Sanctuary protection cancels even a fully prepared strike.
    if (isSafe(player) || isSafe(m)) {
      phase(m, "repelled");
      const radius = safeRadius() + WATCHER.retreatMargin;
      if (dist(m, CENTER) < radius - 8) {
        const d = Math.max(1, dist(m, CENTER)),
          p = nav.nearestGround(
            CENTER.x + ((m.x - CENTER.x) / d) * radius,
            CENTER.y + ((m.y - CENTER.y) / d) * radius,
          );
        if (accessible(p) && !isSafe(p)) setGoal(m, p, WATCHER.patrolSpeed);
      }
      return;
    }
    if (!m.phase || m.phase === "waking" || m.phase === "repelled") {
      phase(m, "search");
      m.senseTimer = 0;
    }
    if (m.phase === "strike") {
      if (m.phaseTime >= WATCHER.strikeSeconds) phase(m, "recover");
      return;
    }
    if (m.phase === "recover") {
      if (m.phaseTime >= WATCHER.recovery)
        phase(m, m.seesPlayer ? "chase" : "search");
      else return;
    }
    if (m.phase === "windup") {
      m.windup = m.phaseTime;
      if (m.windup >= windupSeconds) {
        const area = { ...m.attack };
        const hit =
          dist(player, area) <= area.radius &&
          sight(m, player) &&
          !isSafe(player);
        phase(m, "strike");
        m.cooldown = WATCHER.recovery;
        if (hit) hurt(damage, "watcher");
        emit("watcher-strike", { area, hit, x: m.x, y: m.y });
      }
      return;
    }
    if (m.senseTimer <= 0) {
      m.senseTimer = WATCHER.senseInterval;
      const range = dist(m, player),
        seen = range <= WATCHER.sight && sight(m, player);
      const heard =
        noise &&
        !isSafe(noise) &&
        clock - noise.time < 2 &&
        dist(m, noise) <= WATCHER.chopHearing;
      const steps = player.moving && range <= WATCHER.hearing;
      if (seen) {
        m.lastKnown = { x: player.x, y: player.y };
        m.lastSense = clock;
        if (m.phase === "search") phase(m, "notice");
      } else if (heard || steps) {
        const p = heard ? noise : player;
        m.lastKnown = { x: p.x, y: p.y };
        m.lastSense = clock;
      }
      m.seesPlayer = seen;
    }
    if (m.phase === "notice") {
      if (m.phaseTime >= WATCHER.notice)
        phase(m, m.seesPlayer ? "chase" : "search");
      return;
    }
    if (m.phase === "chase" && clock - (m.lastSense ?? -100) > WATCHER.memory) {
      phase(m, "search");
      m.searchAt = clock;
    }
    if (m.phase === "chase") {
      if (dist(m, player) < 64 && m.seesPlayer && sight(m, player)) {
        phase(m, "windup");
        m.attack = {
          x: player.x,
          y: player.y,
          radius: WATCHER.attackRadius,
          duration: windupSeconds,
        };
        return;
      }
      setGoal(m, m.lastKnown, speed);
      return;
    }
    if (
      m.lastKnown &&
      clock - (m.lastSense ?? -100) < WATCHER.searchSeconds &&
      dist(m, m.lastKnown) > 15
    ) {
      setGoal(m, m.lastKnown, WATCHER.patrolSpeed);
    } else {
      if (
        !m.patrolGoal ||
        dist(m, m.patrolGoal) < 15 ||
        clock > (m.patrolUntil || 0)
      ) {
        m.patrolGoal =
          waypoint(m, m.lastKnown || m, 120) || waypoint(m, m, 120);
        m.patrolUntil = clock + 6;
        m.repath = 0;
      }
      setGoal(m, m.patrolGoal, WATCHER.patrolSpeed);
    }
  }
  return {
    tick,
    hear(p) {
      noise = { x: p.x, y: p.y, time: clock };
    },
    reset() {
      clock = 0;
      noise = null;
    },
  };
}
export const WATCHER_LABELS = Object.freeze({
  waking: "ПРОБУЖДАЕТСЯ",
  search: "ИЩЕТ СЛЕД",
  notice: "ЗАМЕТИЛ ВАС",
  chase: "ПОГОНЯ",
  windup: "УДАР ГОТОВИТСЯ",
  strike: "УДАР",
  recover: "ПАУЗА ПОСЛЕ УДАРА",
  repelled: "СВЕТ ОТПУГИВАЕТ",
});
export function watcherThreat(core) {
  const m = core.survival?.monster;
  if (!m || core.state.gameOver) return null;
  if (m.phase === "waking" && m.warning > 0)
    return {
      phase: "waking",
      text: `Смотритель пробуждается · ${Math.ceil(m.warning)} с до движения`,
      color: "#e4cf9b",
      direction: null,
    };
  const safe = core.survival.isSafe(core.player),
    d = dist(m, core.player);
  if (safe)
    return m.phase === "repelled" && m.phaseTime < 3
      ? {
          phase: "repelled",
          text: "Свет лагеря защищает · Смотритель отступает",
          color: "#c1dfb7",
          direction: null,
        }
      : null;
  const active = ["notice", "chase", "windup", "strike", "recover"].includes(
    m.phase,
  );
  if (!active && d > 220) return null;
  const dx = m.x - core.player.x,
    dy = m.y - core.player.y;
  const direction =
    Math.abs(dx) > Math.abs(dy) * 1.5
      ? dx < 0
        ? "слева"
        : "справа"
      : Math.abs(dy) > Math.abs(dx) * 1.5
        ? dy < 0
          ? "сверху"
          : "снизу"
        : (dy < 0 ? "сверху " : "снизу ") + (dx < 0 ? "слева" : "справа");
  return {
    phase: m.phase,
    text:
      m.phase === "windup"
        ? "Выйдите из красного круга!"
        : `Смотритель · ${WATCHER_LABELS[m.phase] || "рядом"} · ${direction}`,
    color: m.phase === "windup" || m.phase === "strike" ? "#ffc0a8" : "#ead19f",
    direction,
    active,
  };
}
