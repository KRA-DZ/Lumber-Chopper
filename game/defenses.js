import { fencePlan, partialFence } from "../construction.js";
import { CENTER } from "./config.js";

export const DEFENSE = Object.freeze({
  fenceHP: 60,
  repairPerLog: 20,
  trapDamage: 3,
  trapSlowSeconds: 3,
});
const SITES = Object.freeze([
  {
    id: "barricade-left",
    kind: "barricade",
    name: "Левая баррикада",
    x: 1485,
    y: 1840,
    cost: 3,
    maxHP: 60,
  },
  {
    id: "barricade-right",
    kind: "barricade",
    name: "Правая баррикада",
    x: 1715,
    y: 1840,
    cost: 3,
    maxHP: 60,
  },
  {
    id: "trap-left",
    kind: "trap",
    name: "Левая ловушка",
    x: 1545,
    y: 1895,
    cost: 2,
    maxHP: 1,
  },
  {
    id: "trap-right",
    kind: "trap",
    name: "Правая ловушка",
    x: 1655,
    y: 1895,
    cost: 2,
    maxHP: 1,
  },
]);
// Durable model data; views and navigation only read snapshots. No Phaser dependency.
export function createDefenses(state, changed = () => {}) {
  const plan = fencePlan(CENTER);
  let revision = 0,
    cachedKey = "",
    cached = [];
  function all() {
    const key = `${state.campLevel}:${state.buildWood}:${revision}`;
    if (key === cachedKey) return cached;
    cachedKey = key;
    const fence = partialFence(state, plan).segments.map(([a, b]) => {
      const id = `fence-${a.id}`;
      return {
        id,
        kind: "fence",
        name: `Секция забора ${a.id + 1}`,
        a,
        b,
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
        hp: state.defenseHP[id] ?? DEFENSE.fenceHP,
        maxHP: DEFENSE.fenceHP,
        cost: 0,
        wood: 0,
      };
    });
    cached = [
      ...fence,
      ...(state.campLevel < 2
        ? []
        : SITES.map((s) => ({
            ...s,
            hp: state.defenseHP[s.id] || 0,
            wood: state.defenseWood[s.id] || 0,
          }))),
    ];
    return cached;
  }
  const get = (id) => all().find((s) => s.id === id);
  function notify(id, topology) {
    revision++;
    changed({ section: get(id), topology });
  }
  function damage(id, amount) {
    const s = get(id);
    if (!s || s.hp <= 0 || !Number.isFinite(amount) || amount <= 0)
      return false;
    state.defenseHP[id] = Math.max(0, s.hp - amount);
    if (!state.defenseHP[id] && s.kind !== "fence") state.defenseWood[id] = 0;
    notify(id, state.defenseHP[id] === 0 && s.kind !== "trap");
    return true;
  }
  // Consumes no resources itself: simulation validates distance and atomically takes one cargo log.
  function deposit(id) {
    const s = get(id);
    if (!s || s.hp === s.maxHP) return false;
    if (s.hp > 0 || s.kind === "fence") {
      state.defenseHP[id] = Math.min(s.maxHP, s.hp + DEFENSE.repairPerLog);
    } else {
      state.defenseWood[id] = s.wood + 1;
      if (state.defenseWood[id] >= s.cost) state.defenseHP[id] = s.maxHP;
    }
    notify(id, !s.hp && state.defenseHP[id] > 0 && s.kind !== "trap");
    return true;
  }
  function fenceSegments() {
    return all()
      .filter((s) => s.kind === "fence" && s.hp > 0)
      .map((s) => [s.a, s.b]);
  }
  return {
    all,
    get,
    damage,
    deposit,
    fenceSegments,
    get revision() {
      return revision;
    },
  };
}
