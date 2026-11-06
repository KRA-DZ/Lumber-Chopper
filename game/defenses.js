import { fencePlan, partialFence } from "../construction.js";
import { CENTER } from "./config.js";
import { hasCampBuilding } from "./camp-projects.js";
import { INDUSTRY_PROJECTS, industryLevel } from "./camp-industry-config.js";

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
  const maximum = kind => kind==="fence"?[60,100,160][industryLevel(state,"fence")]
    :kind==="gate"?[90,140,220][industryLevel(state,"fence")]:kind==="tower"?120:60;
  function all() {
    const key = `${state.campLevel}:${state.buildProject}:${JSON.stringify(state.campBuildings)}:${state.buildWood}:${industryLevel(state,"fence")}:${revision}`;
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
        hp: state.defenseHP[id] ?? maximum("fence"),
        maxHP: maximum("fence"),
        cost: 0,
        wood: 0,
      };
    });
    cached = [
      ...fence,
      ...(!hasCampBuilding(state,"fence") ? [] : plan.gates.map(g => ({
        ...g, kind: "gate", x: (g.a.x+g.b.x)/2, y: (g.a.y+g.b.y)/2,
        hp: state.defenseHP[g.id] ?? maximum("gate"), maxHP: maximum("gate"), cost: 0, wood: 0, open: !!state.gateOpen[g.id],
      }))),
      ...INDUSTRY_PROJECTS.filter(p=>p.kind==="tower"&&hasCampBuilding(state,p.id)).map(p=>({
        id:p.id,name:p.name,kind:"tower",...p.site,hp:state.defenseHP[p.id]??120,maxHP:120,cost:0,wood:0,
      })),
      ...(!hasCampBuilding(state,"tent") && !hasCampBuilding(state,"fence")
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
  function notify(id, topology, action, previousHP) {
    revision++;
    changed({ section: get(id), topology, action, previousHP });
  }
  function damage(id, amount) {
    const s = get(id);
    if (!s || s.hp <= 0 || !Number.isFinite(amount) || amount <= 0)
      return false;
    state.defenseHP[id] = Math.max(0, s.hp - amount);
    if (!state.defenseHP[id] && !["fence","gate","tower"].includes(s.kind)) state.defenseWood[id] = 0;
    notify(id, state.defenseHP[id] === 0 && s.kind !== "trap", "damage", s.hp);
    return true;
  }
  // Consumes no resources itself: simulation validates distance and atomically takes one cargo log.
  function deposit(id) {
    const s = get(id);
    if (!s || s.hp === s.maxHP) return false;
    if (s.hp > 0 || ["fence","gate","tower"].includes(s.kind)) {
      state.defenseHP[id] = Math.min(s.maxHP, s.hp + DEFENSE.repairPerLog);
    } else {
      state.defenseWood[id] = s.wood + 1;
      if (state.defenseWood[id] >= s.cost) state.defenseHP[id] = s.maxHP;
    }
    notify(
      id,
      !s.hp && state.defenseHP[id] > 0 && s.kind !== "trap",
      "deposit",
      s.hp,
    );
    return true;
  }
  function fenceSegments() {
    return all()
      .filter((s) => (s.kind === "fence" || s.kind === "gate" && !s.open) && s.hp > 0)
      .map((s) => [s.a, s.b]);
  }
  return {
    all,
    get,
    damage,
    deposit,
    restore(id,amount) {
      const s=get(id);if(!s||s.kind==="trap"||s.hp>=s.maxHP||!Number.isFinite(amount)||amount<=0)return false;
      state.defenseHP[id]=Math.min(s.maxHP,s.hp+amount);notify(id,!s.hp,"kit",s.hp);return true;
    },
    reinforce() {
      const before=all();state.campIndustry.upgrades.fence++;
      for(const s of before)if(["fence","gate"].includes(s.kind))
        state.defenseHP[s.id]=s.hp>0?Math.min(maximum(s.kind),s.hp+maximum(s.kind)-s.maxHP):0;
      notify(before[0].id,false,"upgrade",before[0].hp);
    },
    toggleGate(id, value) {
      const g = get(id); if (!g || g.kind !== "gate" || g.hp <= 0 || state.gameOver) return false;
      state.gateOpen[id] = value === undefined ? !g.open : Boolean(value);
      notify(id, true, "gate", g.hp); return true;
    },
    fenceSegments,
    get revision() {
      return revision;
    },
  };
}
