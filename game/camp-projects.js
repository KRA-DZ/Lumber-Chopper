// Independent projects: their order never grants another project's effects.
import { INDUSTRY_PROJECTS } from "./camp-industry-config.js";
import {cargoAmount,changeMaterialCargo} from './material-cargo.js';
export const CAMP_PROJECTS = Object.freeze([
  { id: "fire", stage: 0, name: "Костёр", cost: 10,
    description: "Свет и защита от Смотрителя после розжига. Строится потухшим: каждое добавленное бревно даёт 60 секунд огня." },
  { id: "tent", stage: 1, name: "Палатка", cost: 20,
    description: "Обустройство лагеря и найм помощников после открытия древнего дуба. Не заменяет свет костра." },
  { id: "fence", stage: 2, name: "Забор", cost: 35,
    description: "Ограда с четырьмя калитками задерживает врагов. Её можно сломать и починить. Без горящего костра лагерь остаётся опасным." },
  { id: "house", stage: 3, name: "Хижина", cost: 50,
    description: "Отдельная комната с общим складом и выходом. Снаружи жизнь продолжается; дом не разжигает костёр." },
  ...INDUSTRY_PROJECTS,
]);
export function hasCampBuilding(state, id) {
  // Numeric development fixtures still describe the former sequential stages.
  if (state.campBuildings == null) return CAMP_PROJECTS.slice(0, state.campLevel || 0).some(p => p.id === id);
  return state.campBuildings[id] === true;
}
export const selectedCampProject = state => CAMP_PROJECTS.find(p => p.id === state.buildProject) || null;
export const constructionStage = state => selectedCampProject(state)?.stage ?? state.campLevel;
export const remainingCampProjects = state => CAMP_PROJECTS.filter(p => !hasCampBuilding(state, p.id));
export const projectLockReason = (state,project) => (project.requires||[]).filter(id=>!hasCampBuilding(state,id))
  .map(id=>`Нужна постройка: ${CAMP_PROJECTS.find(p=>p.id===id).name}`).join(". ");
export const projectMaterialsReady = (state,project) => Object.entries(project.materials||{}).every(([id,n])=>
  (state.workshopBuild?(state.buildMaterials?.[id]||0):(state.campIndustry?.materials[id]||0))>=n);

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
    // The master opens project selection explicitly; passing the counter never opens a menu.
  }
  function choose(projectId,immediate=false) {
    const project = CAMP_PROJECTS.find(p => p.id === projectId);
    if (!project || projectLockReason(state,project) || state.gameOver || state.health <= 0 || player.room || !near(player) || state.buildProject || hasCampBuilding(state,projectId)) return false;
    if (state.campBuildings == null) state.campBuildings = Object.fromEntries(CAMP_PROJECTS.filter(p => hasCampBuilding(state,p.id)).map(p => [p.id,true]));
    state.buildProject = projectId; state.buildWood = 0;
    state.workshopBuild=immediate;state.buildMaterials={};
    state.buildBlockedPlayers = immediate?[]:players().filter(near).map(p => p.id ?? 0);
    emit("build-selected", { project }); return true;
  }
  function canContribute() {
    return canAct() && near(player) && !!selectedCampProject(state) && !state.buildBlockedPlayers.includes(id());
  }
  function contribute() {
    if (!canContribute() || state.buildWood >= selectedCampProject(state).cost) return null;
    const value = forestry.takeCargo(); if (value === null) return null;
    const project = selectedCampProject(state); state.buildWood++;
    const complete = state.buildWood >= project.cost && projectMaterialsReady(state,project);
    if (complete) finish(project);
    return { project, value, complete };
  }
  function finish(project) {
    if(!state.workshopBuild)for(const [id,n] of Object.entries(project.materials||{}))state.campIndustry.materials[id]-=n;
    state.campBuildings[project.id] = true;
    state.campLevel = CAMP_PROJECTS.filter(p => hasCampBuilding(state,p.id)).length;
    state.buildWood = 0; state.buildProject = null; state.buildBlockedPlayers = [];
    state.workshopBuild=false;state.buildMaterials={};
    if (project.id === "fire") state.campFuel = 0;
    requested = false;
  }
  function finishMaterials() {
    const project=selectedCampProject(state);
    if(!project||!canContribute()||state.buildWood<project.cost||!projectMaterialsReady(state,project))return null;
    finish(project);return project;
  }
  function contributeMaterial(){
    const project=selectedCampProject(state);
    if(!state.workshopBuild||!project||!canContribute())return null;
    const id=Object.keys(project.materials||{}).find(k=>(state.buildMaterials[k]||0)<project.materials[k]&&cargoAmount(state,k)>0);
    if(!id)return null;
    changeMaterialCargo(state,id,-1);state.buildMaterials[id]=(state.buildMaterials[id]||0)+1;
    const complete=state.buildWood>=project.cost&&projectMaterialsReady(state,project);
    if(complete)finish(project);
    return {project,material:id,complete};
  }
  return { update, choose, canContribute, contribute, contributeMaterial, finishMaterials, requestChoice,
    get project() { return selectedCampProject(state); },
    get choices() { return remainingCampProjects(state); },
    get needsExit() { return state.buildBlockedPlayers.includes(id()); },
  };
}
