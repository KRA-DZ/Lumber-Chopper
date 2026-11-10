import { hasCampBuilding } from "../game/camp-projects.js";
import { WORKERS, WORKER_PHASES } from "../game/workers.js";
import { WORKER_ROLES, workerRole, WORKER_JOBS } from "../game/worker-jobs.js";

export function createWorkerUi(scene) {
  const dialog = document.querySelector("#workerDialog"),
    list = dialog.querySelector("[data-workers]"),
    button = document.querySelector("#workerButton"),
    closeButton = dialog.querySelector("[data-worker-close]");
  let pendingRoute = false;
  function render(selected="") {
    const w = scene.core.workers,
      d = w.data,
      s = scene.core.state;
    list.replaceChildren();
    const info = document.createElement("p");
    info.dataset.workerSummary = "";
    info.textContent = `Помощники: ${w.crew.length}/${w.slots()} (до ${WORKERS.max} с обустройством дома). Склад работников: ${d.stock.length}/${WORKERS.stockLimit}. Общие брёвна: ${s.logStore.length}. Монеты игрока: ${s.coins}. Доставлено: ${d.delivered} брёвен, ${d.stoneDelivered} камня; заработано: ${d.earned}.`;
    list.append(info);
    const requirements = document.createElement("p");
    requirements.dataset.workerRequirements = "";
    requirements.textContent =
      !hasCampBuilding(s,"tent")
        ? "Сначала постройте палатку. Костёр строится отдельно. Изначально два места; каждый уровень обустройства дома добавляет одно."
        : !w.daytime()
            ? "Команда отдыхает. Найм и обучение снова доступны утром."
            : !w.atDepot()
              ? "Подойдите к складу лагеря кнопкой ниже."
              : "Найм без зарплаты и питания. Дровосеку нужна открытая Дубовая роща, каменщику — валуны открытых регионов. Смена профессии выполняется после возврата груза.";
    list.append(requirements);
    function action(id, title, text, disabled, run) {
      const a = document.createElement("article"),
        h = document.createElement("h3"),
        p = document.createElement("p"),
        b = document.createElement("button");
      h.textContent = title;
      p.textContent = text;
      b.type = "button";
      b.dataset.workerAction = id;
      b.textContent = title;
      b.disabled = disabled;
      b.addEventListener("click", () => {
        run();
        render(id);
        scene.renderModel();
      });
      a.append(h, p, b);
      list.append(a);
    }
    action(
      "route",
      "К складу лагеря",
      "Найм, обучение и выдача брёвен — только рядом со складом. Меню можно открыть из любой точки леса.",
      false,
      () => {
        pendingRoute = true;
        dialog.close();
      },
    );
    for(const [role,offer] of Object.entries(WORKER_ROLES))action(
      role==="lumberjack"?"hire":`hire:${role}`,
      `Нанять: ${offer.name}${w.hirePrice==null?" · нет мест":` · ${w.hirePrice} монет`}`,
      `${offer.description} ${w.hireReason(role)||"Разовая оплата с личного счёта."}`,
      !!w.hireReason(role),()=>w.hire(role));
    action(
      "upgrade",
      w.upgradePrice == null
        ? "Оснастка улучшена полностью"
        : `Обучить команду · ${w.upgradePrice} монет`,
      `Оснастка ${d.level}/2: ${w.capacity()} брёвен / ${w.stoneCapacity()} камня, скорость ${w.speed()}, бревно за ${w.chopSeconds().toFixed(1)} с. Также ускоряет добычу камня и ремонт; места открывает обустройство дома через C.`,
      !w.atDepot() ||
        !w.available() ||
        !w.crew.length ||
        !w.daytime() ||
        w.upgradePrice == null ||
        s.coins < w.upgradePrice,
      () => w.upgrade(),
    );
    action(
      "withdraw",
      "Взять одно бревно",
      "Выдаётся в стопку героя для строительства, ремонта или самостоятельной продажи. Каждое нажатие перекладывает ровно одно бревно; вместимость стопки героя сохраняется.",
      !w.atDepot() || !d.stock.length || s.wood >= s.maxWood,
      () => w.withdraw(),
    );
    action(
      "sell",
      d.autoSell ? "Оставлять брёвна для стройки" : "Включить продажу склада",
      "Автопродажа со склада работников: 8 монет за бревно, раз в 0,8 с, только при назначении «Продажа». Покупатели 5/15. Игрок на площадке получает приоритет.",
      !w.crew.length,
      () => w.setAutoSell(!d.autoSell),
    );
    action("target",d.logTarget==="store"?"Брёвна → общий склад":"Брёвна → продажа",`Сейчас: ${d.logTarget==="store"?"новый груз идёт в общий logStore для стройки, переработки и ремонта; продажи работников приостановлены":"новый груз идёт на склад работников для продажи"}. Нажмите для переключения. Груз в пути сохраняется.`,false,()=>w.setLogTarget(d.logTarget==="store"?"sell":"store"));
    action("store-stock","Переложить запас в общий склад","Переносит старые брёвна склада работников в общий запас с сохранением стоимости. Нужна близость к складу и свободные места.",!w.atDepot()||!d.stock.length,()=>w.transferStock());
    for(const [id,delta] of [["reserve-less",-2],["reserve-more",2]])action(id,`${delta<0?"Уменьшить":"Увеличить"} резерв дров · ${d.repairReserve}`,"Ремонтник не берёт последние брёвна общего склада. Резерв 0–40 с шагом 2; игроки и производство по-прежнему распоряжаются ими сами.",d.repairReserve+delta<0||d.repairReserve+delta>WORKER_JOBS.repairReserveMax,()=>w.setRepairReserve(d.repairReserve+delta));
    action(
      "recall",
      d.recalled ? "Отпустить команду на работу" : "Отозвать команду",
      "Добытчики возвращаются за минуту до ночи. Ремонтник может работать ночью при горящем костре, пока рядом нет врагов. При угрозе все отступают; ручной отзыв останавливает всю команду.",
      !w.crew.length,
      () => w.setRecalled(!d.recalled),
    );
    for (const npc of w.crew) {
      const p = document.createElement("p");
      p.dataset.workerId = npc.id;
      p.textContent = `${npc.name} · ${WORKER_ROLES[workerRole(npc)].name}${npc.pendingRole?` → ${WORKER_ROLES[npc.pendingRole].name} после возврата`:""} · ${WORKER_PHASES[npc.phase]} · ${npc.reason} · груз ${npc.cargo.length}/${w.capacity()} бр., ${npc.stoneCargo}/${w.stoneCapacity()} камня`;
      list.append(p);
      const choices=document.createElement("nav");choices.className="worker-roles";choices.setAttribute("aria-label",`Профессия: ${npc.name}`);
      for(const [role,offer] of Object.entries(WORKER_ROLES)){
        const b=document.createElement("button"),id=`assign:${npc.id}:${role}`;b.type="button";b.dataset.workerAction=id;
        b.textContent=offer.name;b.title=offer.description;b.disabled=!w.atDepot()||workerRole(npc)===role&&!npc.pendingRole;
        b.onclick=()=>{w.assign(npc.id,role);render(id);scene.renderModel();};choices.append(b);
      }
      list.append(choices);
    }
    const buttons=[...list.querySelectorAll("[data-worker-action]:not([disabled])")],target=buttons.find(b=>b.dataset.workerAction===selected)||buttons[0];
    if(target){scene.keyboardUi.modal=dialog;scene.keyboardUi.selection=buttons.indexOf(target);target.dataset.selected="true";target.focus({preventScroll:true});}
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
