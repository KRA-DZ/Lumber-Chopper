import { hasCampBuilding } from "../game/camp-projects.js";
import { appendRaidSummary } from "./raid-summary.js";
import { appendRaidReadiness } from "./camp-progress-ui.js";
export function createDefenseUi(scene) {
  const dialog = document.querySelector("#defenseDialog"),
    list = dialog.querySelector("[data-defenses]"),
    button = document.querySelector("#defenseButton");
  function render() {
    const c = scene.core;
    list.replaceChildren();
    const info = document.createElement("p");
    info.textContent =
      !hasCampBuilding(c.state,"tent") && !hasCampBuilding(c.state,"fence")
        ? "Для баррикад и ловушек нужна палатка или ограда. Другие постройки можно выбирать независимо."
        : `В руках: ${c.state.wood}/${c.state.maxWood} брёвен. Рядом с повреждённой секцией удерживайте R или экранную кнопку: каждые 0,6 с одно бревно восстанавливает до 20 HP. Отпускание сбрасывает незавершённый взнос. Поручение ниже работает автоматически; WASD или нажатие на землю отменяют работу. Метатели бросают через ограду — уклоняйтесь.`;
    list.append(info);
    appendRaidReadiness(list,c);
    appendRaidSummary(list, c.state.lastRaidReport);
    const sections = c.defenses.all();
    for (const s of sections.filter(
      (s) => !["fence","gate","tower"].includes(s.kind) || s.hp < s.maxHP,
    )) {
      const article = document.createElement("article"),
        title = document.createElement("h3"),
        p = document.createElement("p"),
        b = document.createElement("button");
      title.textContent = s.name;
      p.textContent = s.hp
        ? s.kind === "trap"
          ? "Взведена: один раз наносит 3 урона и замедляет на 3 секунды. Смотрителя не останавливает."
          : `${s.hp}/${s.maxHP} HP. Ремонт: до 20 HP за одно бревно.`
        : ["fence","gate","tower"].includes(s.kind)
          ? "Сломана. Одно бревно восстановит 20 HP и закроет пролом."
          : `${s.wood}/${s.cost} брёвен. ${s.kind === "trap" ? "Одноразовая ловушка: 3 урона и замедление. После срабатывания нужно собрать заново." : "Баррикада: 60 HP. Центральный проход остаётся открытым."}`;
      b.type = "button";
      b.dataset.defenseOrder = s.id;
      b.disabled = s.hp >= s.maxHP;
      b.textContent = b.disabled
        ? "Готово"
        : s.hp || ["fence","gate","tower"].includes(s.kind)
          ? "Подойти и чинить"
          : "Подойти и построить";
      b.addEventListener("click", () => {
        dialog.close();
        scene.pause("defenses", false);
        c.orderDefense(s.id);
        scene.renderModel();
      });
      article.append(title, p, b);
      list.append(article);
    }
    const intact = sections.filter(
      (s) => ["fence","gate"].includes(s.kind) && s.hp === s.maxHP,
    ).length;
    if (intact) {
      const p = document.createElement("p");
      p.textContent = `Целых секций забора: ${intact}. Для ремонта можно нажать прямо на повреждённую секцию в мире.`;
      list.append(p);
    }
  }
  function open() {
    if (scene.core.state.gameOver) return;
    render();
    scene.pause("defenses", true);
    if (!dialog.open) dialog.showModal();
  }
  const closed = () => scene.pause("defenses", false),
    dismiss = () => dialog.close();
  const closeButton = dialog.querySelector("[data-defense-close]");
  button.addEventListener("click", open);
  dialog.addEventListener("close", closed);
  closeButton.addEventListener("click", dismiss);
  return {
    open,
    destroy() {
      button.removeEventListener("click", open);
      dialog.removeEventListener("close", closed);
      closeButton.removeEventListener("click", dismiss);
      dialog.close();
      list.replaceChildren();
    },
  };
}
