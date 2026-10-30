import { renderStoryJournal } from "./story-journal.js";
import { firstDaysPlan } from "../game/first-days.js";
import { LETTERS, QUESTS } from "../game/lore.js";
export function createSurvivalUi(scene) {
  const journal = document.querySelector("#journalDialog"),
    list = journal.querySelector("[data-journal]"),
    button = document.querySelector("#journalButton"),
    death = document.querySelector("#deathDialog");
  let pendingRoute = null;
  function refreshBadge() {
    const s = scene.core.state;
    const unread =
      s.unlockedLetters.filter((id) => !s.readClues.includes(id)).length +
      (scene.core.story?.unread || 0);
    button.textContent = unread
      ? `Дневник · ${unread} новых · J`
      : "Дневник · J";
    button.dataset.unread = String(unread);
  }
  function resume() {
    if (pendingRoute && !scene.core.paused) {
      const target = pendingRoute;
      pendingRoute = null;
      scene.core.navigateStory(target);
    }
  }
  function render() {
    const c = scene.core,
      s = c.state;
    list.replaceChildren();
    const append = (title, text) => {
      const article = document.createElement("article"),
        h = document.createElement("h3"),
        p = document.createElement("p");
      h.textContent = title;
      p.textContent = text;
      article.append(h, p);
      list.append(article);
      return article;
    };
    renderStoryJournal(scene, list, (target) => {
      pendingRoute = target;
      journal.close();
    });
    const heading = document.createElement("h3");
    heading.textContent = "План первых четырёх дней";
    list.append(heading);
    const intro = document.createElement("p");
    intro.textContent =
      "Ориентиры можно выполнять заранее и в своём порядке. Награды писем находятся ниже.";
    list.append(intro);
    for (const plan of firstDaysPlan(c)) {
      const done = plan.goals.filter(([, ready]) => ready).length;
      const article = append(
        `День ${plan.day} · ${plan.title} · ${done}/${plan.goals.length}`,
        plan.goals
          .map(([text, ready]) => `${ready ? "✓" : "○"} ${text}`)
          .join("\n"),
      );
      article.dataset.planDay = plan.day;
      article.lastElementChild.style.whiteSpace = "pre-line";
    }
    if (!s.unlockedLetters.length)
      append(
        "Пока нет писем",
        "Письма появятся после пережитых ночей. Ищите записки на карте.",
      );
    for (const l of LETTERS.filter((l) => s.unlockedLetters.includes(l.id))) {
      append(l.name, l.text);
      c.lore.read(l);
    }
    for (const q of QUESTS.filter((q) =>
      s.unlockedLetters.includes(q.letter),
    )) {
      const claimed = s.claimedQuests.includes(q.id),
        a = append(q.name, `${q.description} Награда: ${q.reward} монет.`),
        b = document.createElement("button");
      b.type = "button";
      b.dataset.quest = q.id;
      b.textContent = claimed ? "Выполнено" : "Получить награду";
      b.disabled = claimed || !q.ready(s);
      b.addEventListener("click", () => {
        if (c.lore.claim(q.id)) {
          render();
          scene.renderModel();
        }
      });
      a.append(b);
    }
    for (const clue of c.world.clues || [])
      if (s.readClues.includes(clue.id)) append(clue.name, clue.text);
    refreshBadge();
  }
  function open() {
    if (scene.core.state.gameOver) return;
    render();
    scene.pause("journal", true);
    if (!journal.open) journal.showModal();
  }
  const close = () => {
      scene.pause("journal", false);
      resume();
    },
    dismiss = () => journal.close();
  const restart = () => location.reload(),
    prevent = (event) => event.preventDefault();
  button.addEventListener("click", open);
  journal.addEventListener("close", close);
  journal
    .querySelector("[data-journal-close]")
    .addEventListener("click", dismiss);
  death.querySelector("[data-restart]").addEventListener("click", restart);
  death.addEventListener("cancel", prevent);
  refreshBadge();
  return {
    open,
    resume,
    refreshBadge,
    defeat(event) {
      scene.pause("defeat", true);
      for (const id of [
        "shopButton",
        "mapButton",
        "journalButton",
        "campButton",
        "defenseButton",
        "bagButton",
      ])
        document.querySelector("#" + id).disabled = true;
      death.querySelector("[data-defeat]").textContent =
        `${event.reason} Пережито ночей: ${event.nightsSurvived}.`;
      if (!death.open) death.showModal();
    },
    destroy() {
      pendingRoute = null;
      button.removeEventListener("click", open);
      journal.removeEventListener("close", close);
      journal
        .querySelector("[data-journal-close]")
        .removeEventListener("click", dismiss);
      death
        .querySelector("[data-restart]")
        .removeEventListener("click", restart);
      death.removeEventListener("cancel", prevent);
      journal.close();
      death.close();
      list.replaceChildren();
      for (const id of [
        "shopButton",
        "mapButton",
        "journalButton",
        "campButton",
        "defenseButton",
        "bagButton",
      ])
        document.querySelector("#" + id).disabled = false;
    },
  };
}
