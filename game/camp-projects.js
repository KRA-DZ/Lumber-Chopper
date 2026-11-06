// Independent projects: their order never grants another project's effects.
export const CAMP_PROJECTS = Object.freeze([
  { id: "fire", stage: 0, name: "Костёр", cost: 10,
    description: "Свет и защита от Смотрителя после розжига. Строится потухшим: каждое добавленное бревно даёт 60 секунд огня." },
  { id: "tent", stage: 1, name: "Палатка", cost: 20,
    description: "Обустройство лагеря и найм помощников после открытия древнего дуба. Не заменяет свет костра." },
  { id: "fence", stage: 2, name: "Забор", cost: 35,
    description: "Ограда с четырьмя калитками задерживает врагов. Её можно сломать и починить. Без горящего костра лагерь остаётся опасным." },
  { id: "house", stage: 3, name: "Хижина", cost: 50,
    description: "Отдельная комната с общим складом и выходом. Снаружи жизнь продолжается; дом не разжигает костёр." },
]);
export function hasCampBuilding(state, id) {
  // Numeric development fixtures still describe the former sequential stages.
  if (state.campBuildings == null) return CAMP_PROJECTS.slice(0, state.campLevel || 0).some(p => p.id === id);
  return state.campBuildings[id] === true;
}
export const selectedCampProject = state => CAMP_PROJECTS.find(p => p.id === state.buildProject) || null;
export const constructionStage = state => selectedCampProject(state)?.stage ?? state.campLevel;
export const remainingCampProjects = state => CAMP_PROJECTS.filter(p => !hasCampBuilding(state, p.id));

export function createCampBuilder({ state, player, pad, forestry, canAct, players = () => [player], emit = () => {} }) {
  let inside = false, requested = false;
  const near = p => !p.room && Math.hypot(p.x-pad.x,p.y-pad.y) < pad.radius;
  const id = () => player.id ?? 0;
  function requestChoice(force = false) {
    if (!canAct() || !near(player) || state.buildProject || !remainingCampProjects(state).length || requested && !force) return false;
    requested = true; emit("build-choice", {}); return true;
  }
  function update() {
    if (!near(player)) {
      inside = requested = false;
      state.buildBlockedPlayers = state.buildBlockedPlayers.filter(i => i !== id());
      return;
    }
    if (!inside) { inside = true; requested = false; }
    requestChoice();
  }
  function choose(projectId) {
    const project = CAMP_PROJECTS.find(p => p.id === projectId);
    if (!project || state.gameOver || state.health <= 0 || player.room || !near(player) || state.buildProject || hasCampBuilding(state,projectId)) return false;
    if (state.campBuildings == null) state.campBuildings = Object.fromEntries(CAMP_PROJECTS.filter(p => hasCampBuilding(state,p.id)).map(p => [p.id,true]));
    state.buildProject = projectId; state.buildWood = 0;
    state.buildBlockedPlayers = players().filter(near).map(p => p.id ?? 0);
    emit("build-selected", { project }); return true;
  }
  function canContribute() {
    return canAct() && near(player) && !!selectedCampProject(state) && !state.buildBlockedPlayers.includes(id());
  }
  function contribute() {
    if (!canContribute()) return null;
    const value = forestry.takeCargo(); if (value === null) return null;
    const project = selectedCampProject(state); state.buildWood++;
    const complete = state.buildWood >= project.cost;
    if (complete) {
      state.campBuildings[project.id] = true;
      state.campLevel = CAMP_PROJECTS.filter(p => hasCampBuilding(state,p.id)).length;
      state.buildWood = 0; state.buildProject = null; state.buildBlockedPlayers = [];
      if (project.id === "fire") state.campFuel = 0;
      requested = false;
    }
    return { project, value, complete };
  }
  return { update, choose, canContribute, contribute, requestChoice,
    get project() { return selectedCampProject(state); },
    get choices() { return remainingCampProjects(state); },
    get needsExit() { return state.buildBlockedPlayers.includes(id()); },
  };
}
