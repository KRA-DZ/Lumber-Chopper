import {campIcon} from './camp-icons.js';
import {visibleMenuActions} from './menu-navigation.js';
import { WORKER_PHASES } from "../game/workers.js";
import { WORKER_ROLES, workerRole } from "../game/worker-jobs.js";

export function createWorkerUi(scene) {
  const dialog = document.querySelector("#workerDialog"),
    list = dialog.querySelector("[data-workers]"),
    button = document.querySelector("#workerButton"),
    closeButton = dialog.querySelector("[data-worker-close]");
  let pendingRoute = false;
  function render(selected="") {
    const w=scene.core.workers,s=scene.core.state;
    list.replaceChildren();
    const summary=document.createElement('p');summary.dataset.workerSummary='';
    summary.textContent=`Команда ${w.crew.length}/${w.slots()} · ${s.coins} монет`;
    list.append(summary);
    function button(id,label,run,disabled=false){
      const b=document.createElement('button');b.type='button';b.dataset.workerAction=id;b.textContent=label;b.disabled=disabled;
      b.onclick=()=>{run();render(id);scene.renderModel();};return b;
    }
    if(!w.atDepot()||!w.available()){
      const p=document.createElement('p');p.dataset.workerRequirements='';
      p.textContent=!w.available()?'Для найма постройте палатку.':'Найм и назначения доступны у площадки помощников.';list.append(p);
      if(!w.atDepot())list.append(button('route','К помощникам',()=>{pendingRoute=true;dialog.close();}));
    }
    const toolbar=document.createElement('div');toolbar.className='worker-toolbar';
    const hire=button('hire',w.hirePrice==null?'Все места заняты':`Нанять · ${w.hirePrice} монет`,()=>{w.useSharedStore();w.hire();},!!w.hireReason());
    hire.title=w.hireReason();toolbar.append(hire);
    const training=button('upgrade',w.upgradePrice==null?'Команда обучена':`Обучить · ${w.upgradePrice} монет`,()=>w.upgrade(),
      !w.atDepot()||!w.available()||!w.crew.length||!w.daytime()||w.upgradePrice==null||s.coins<w.upgradePrice);
    toolbar.append(training);list.append(toolbar);
    const stats=document.createElement('p');stats.className='worker-training';stats.textContent=`Обучение ${w.data.level}/2 · ходьба ${w.speed()} · рубка ${w.chopSeconds().toFixed(1)} с · груз ${w.capacity()} брёвен`;
    list.append(stats);
    for(const npc of w.crew){
      const card=document.createElement('article');card.className='worker-cell worker-person';card.dataset.workerId=npc.id;
      const head=document.createElement('div');head.className='worker-person-head';head.append(campIcon(scene,`person.${npc.appearance}-walk-down-0`,64));
      const info=document.createElement('div'),name=document.createElement('h3'),status=document.createElement('p');name.textContent=npc.name;
      status.textContent=npc.pendingRole?`После разгрузки: ${WORKER_ROLES[npc.pendingRole].name}`:`${WORKER_PHASES[npc.phase]} · ${npc.reason}`;info.append(name,status);head.append(info);card.append(head);
      const roles=document.createElement('div');roles.className='worker-roles';roles.setAttribute('role','group');roles.setAttribute('aria-label',`Занятие: ${npc.name}`);
      for(const [role,offer] of Object.entries(WORKER_ROLES)){
        const active=(npc.pendingRole||workerRole(npc))===role;
        const b=button(`assign:${npc.id}:${role}`,role==='lumberjack'?'Рубка':role==='miner'?'Камень':role==='operator'?'Лесопилка':offer.name,
          ()=>w.assign(npc.id,role),!w.atDepot()||role==='operator'&&(s.sawmill.stage<3||w.crew.some(n=>n.id!==npc.id&&(n.role==='operator'||n.pendingRole==='operator'))));
        b.setAttribute('aria-pressed',String(active));b.title=offer.description;roles.append(b);
      }
      card.append(roles);list.append(card);
    }
    if(!w.crew.length){const p=document.createElement('p');p.textContent='Наймите помощника и выберите ему занятие.';list.append(p);}
    const note=document.createElement('p');note.className='camp-muted';note.textContent='Добытые материалы поступают в общий склад. Ещё два места открывает улучшение дома.';list.append(note);
    const buttons=[...list.querySelectorAll('[data-worker-action]:not([disabled])')],target=buttons.find(b=>b.dataset.workerAction===selected)||buttons[0];
    if(target){scene.keyboardUi.modal=dialog;scene.keyboardUi.selection=visibleMenuActions(dialog).indexOf(target);target.focus({preventScroll:true});}
  }
  function resume() {
    if (pendingRoute && !scene.core.paused) {
      pendingRoute = false;
      scene.core.navigateWorkers();
    }
  }
  function open() {
    if (scene.core.state.gameOver) return;
    scene.pause("workers", true);
    if (!dialog.open) dialog.showModal();
    scene.core.workers.useSharedStore();
    render();
  }
  const close = () => {
      scene.pause("workers", false);
      resume();
    },
    dismiss = () => dialog.close();
  button.addEventListener("click", open);
  closeButton.addEventListener("click", dismiss);
  dialog.addEventListener("close", close);
  return {
    open,
    resume,
    destroy() {
      pendingRoute = false;
      button.removeEventListener("click", open);
      closeButton.removeEventListener("click", dismiss);
      dialog.removeEventListener("close", close);
      dialog.close();
      list.replaceChildren();
    },
  };
}
