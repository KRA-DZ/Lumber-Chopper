import { projectLockReason } from "../game/camp-projects.js";
import { materialCostText } from "../game/camp-industry-config.js";
export function createBuildUi(scene) {
  const dialog = document.querySelector("#buildDialog"), list = dialog.querySelector("[data-build-options]"),
    cancel = dialog.querySelector("[data-build-close]");
  function open() {
    const core = scene.core, builder = core.builder;
    if (core.paused || core.state.gameOver || !builder.choices.length || builder.project) return false;
    list.replaceChildren(); scene.keyboardUi.modal = null;
    for (const project of builder.choices) {
      const card = document.createElement("article"), title = document.createElement("h3"),
        detail = document.createElement("p"), button = document.createElement("button");
      card.className = "build-option";
      title.textContent = `${project.name} · ${project.cost} брёвен${project.materials?" · "+materialCostText(project.materials):""}`;
      const lock=projectLockReason(core.state,project);
      detail.textContent = project.description + (lock?` ${lock}.`:"") + (project.materials?" Дополнительные материалы списываются из общего запаса после сдачи брёвен.":"") + (core.state.campHealth < core.state.maxCampHealth ? " Лагерь повреждён: перед стройкой платформа сначала потратит брёвна на ремонт." : "");
      button.type = "button"; button.dataset.buildProject = project.id;
      button.textContent = `Выбрать: ${project.name}`;
      button.disabled=!!lock;
      button.onclick = () => {
        if (!builder.choose(project.id)) return;
        dialog.close();
        core.showNotice(`Проект: ${project.name}. Сойдите с платформы и вернитесь, чтобы сдавать брёвна.`,8);
        scene.renderModel();
      };
      card.append(title,detail,button); list.append(card);
    }
    scene.pause("building",true); dialog.showModal();
    list.firstElementChild.dataset.selected = "true";
    list.querySelector("button").focus({preventScroll:true});
    return true;
  }
  const close = () => scene.pause("building",false), dismiss = () => dialog.close();
  dialog.addEventListener("close",close); cancel.addEventListener("click",dismiss);
  return { open, destroy() {
    dialog.removeEventListener("close",close); cancel.removeEventListener("click",dismiss);
    dialog.close(); list.replaceChildren();
  } };
}
