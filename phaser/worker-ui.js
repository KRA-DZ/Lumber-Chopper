import { WORKERS, WORKER_PHASES } from "../game/workers.js";

export function createWorkerUi(scene) {
  const dialog = document.querySelector("#workerDialog"),
    list = dialog.querySelector("[data-workers]"),
    button = document.querySelector("#workerButton"),
    closeButton = dialog.querySelector("[data-worker-close]");
  let pendingRoute = false;
  function render() {
    const w = scene.core.workers,
      d = w.data,
      s = scene.core.state;
    list.replaceChildren();
    const info = document.createElement("p");
    info.dataset.workerSummary = "";
    info.textContent = `Помощники: ${w.crew.length}/${WORKERS.max}. Склад: ${d.stock.length}/${WORKERS.stockLimit}. Монеты: ${s.coins}. Доставлено: ${d.delivered}; заработано складом: ${d.earned}.`;
    list.append(info);
    const requirements = document.createElement("p");
    requirements.dataset.workerRequirements = "";
    requirements.textContent =
      s.campLevel < 2
        ? "Сначала постройте костёр и палатку на голубой площадке."
        : !w.available()
          ? "Откройте Дубовую рощу: восточный указатель, 12 брёвен."
          : !w.daytime()
            ? "Команда отдыхает. Найм и обучение снова доступны утром."
            : !w.atDepot()
              ? "Подойдите к складу лагеря кнопкой ниже."
              : "Здесь можно нанимать, обучать и забирать запас. До предупреждения о закате.";
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
        render();
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
    action(
      "hire",
      w.hirePrice == null
        ? "Команда укомплектована"
        : `Нанять · ${w.hirePrice} монет`,
      "Нужны палатка и открытая Дубовая роща на востоке (12 брёвен у указателя). Работа начинается днём; сюжет проходить не требуется.",
      !w.atDepot() ||
        !w.available() ||
        !w.daytime() ||
        w.hirePrice == null ||
        s.coins < w.hirePrice,
      () => w.hire(),
    );
    action(
      "upgrade",
      w.upgradePrice == null
        ? "Оснастка улучшена полностью"
        : `Обучить команду · ${w.upgradePrice} монет`,
      `Оснастка ${d.level}/2: груз ${w.capacity()}, скорость ${w.speed()}, одно бревно за ${w.chopSeconds().toFixed(1)} с. Улучшение действует на всех, включая будущих работников.`,
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
      "Автопродажа: 8 монет за бревно, раз в 0,8 с. Заказ пешего покупателя — 5, тележки — 15. Если герой продаёт со своей площадки, склад уступает ему очередь.",
      !w.crew.length,
      () => w.setAutoSell(!d.autoSell),
    );
    action(
      "recall",
      d.recalled ? "Отпустить команду на работу" : "Отозвать команду",
      "За минуту до заката помощники сами возвращаются с грузом. Ночью отдыхают у костра; утром выходят снова. Врагов не атакуют. Заполненный склад останавливает добычу.",
      !w.crew.length,
      () => w.setRecalled(!d.recalled),
    );
    for (const npc of w.crew) {
      const p = document.createElement("p");
      p.dataset.workerId = npc.id;
      p.textContent = `${npc.name} · ${WORKER_PHASES[npc.phase]} · груз ${npc.cargo.length}/${w.capacity()}`;
      list.append(p);
    }
  }
  function resume() {
    if (pendingRoute && !scene.core.paused) {
      pendingRoute = false;
      scene.core.navigateWorkers();
    }
  }
  function open() {
    if (scene.core.state.gameOver) return;
    render();
    scene.pause("workers", true);
    if (!dialog.open) dialog.showModal();
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
