import { ITEMS, EXPLORATION } from "../game/exploration.js";

export function createExplorationUi(scene) {
  const dialog = document.querySelector("#activityDialog"),
    title = dialog.querySelector("[data-activity-title]"),
    content = dialog.querySelector("[data-activity-content]"),
    message = dialog.querySelector("[data-activity-message]"),
    bagButton = document.querySelector("#bagButton"),
    closeButton = dialog.querySelector("[data-activity-close]");
  const controls = document.querySelector("#fishingControls"),
    fishStatus = controls.querySelector("[data-fish-status]"),
    reelButton = controls.querySelector("[data-reel]"),
    cancelButton = controls.querySelector("[data-fish-cancel]");
  const model = () => scene.core.exploration;
  let siteId = null,
    queuedRoute = null,
    lastFishText = "";
  function paragraph(text, parent = content) {
    const p = document.createElement("p");
    p.textContent = text;
    parent.append(p);
    return p;
  }
  function button(text, handler, parent = content) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = text;
    b.addEventListener("click", handler);
    parent.append(b);
    return b;
  }
  function render() {
    const m = model(),
      s = scene.core.state,
      d = s.exploration;
    content.replaceChildren();
    message.textContent = "";
    if (siteId) {
      const site = m.get(siteId);
      title.textContent = site.name;
      paragraph(`Монеты: ${s.coins} · Брёвна: ${s.wood}/${s.maxWood}`);
      const descriptions = {
        chest:
          "Старая печать держит крышку. Ключ после открытия исчезнет, а добыча попадёт в сумку находок.",
        merchant:
          "«У каждой дороги своя цена». Здесь покупают рыбу и реликвии, продают ключи, удочки и лесную мазь.",
        pond: "Четыре удачных улова за игровой день. Во время ловли время идёт: движение, полученный удар или ночь прервут рыбалку.",
        ancient:
          "Древний ствол не поддаётся топору. У корней можно оставить брёвна и получить немного смолы.",
        kitchen:
          "Тёплая еда восстанавливает здоровье героя. Для приготовления нужна одна рыба.",
      };
      paragraph(descriptions[site.kind]);
      const conversation = scene.core.story?.conversation(site.id);
      if (conversation) paragraph(conversation).dataset.storyDialogue = site.id;
      for (const offer of m.offers(siteId)) {
        const row = document.createElement("article");
        row.className = "activity-card";
        paragraph(offer.description, row);
        const b = button(
          offer.name,
          () => {
            if (!m.perform(siteId, offer.action)) {
              render();
              message.textContent = "Действие сейчас недоступно.";
              return;
            }
            if (offer.action === "fish") {
              dismiss();
              return;
            }
            render();
            message.textContent = offer.action.startsWith("story:")
              ? scene.core.story.conversation(siteId)
              : "Готово.";
            scene.renderModel();
          },
          row,
        );
        b.dataset.activityAction = offer.action;
        b.disabled = !offer.enabled;
        if (offer.reason) paragraph(offer.reason, row);
        content.append(row);
      }
    } else {
      title.textContent = "Сумка находок";
      paragraph(
        `Монеты: ${s.coins} · Удочка: ${d.rod ? "есть" : "нет"}. Брёвна переносятся отдельно за спиной.`,
      );
      const list = document.createElement("ul");
      for (const [id, item] of Object.entries(ITEMS)) {
        const li = document.createElement("li");
        li.dataset.bagItem = id;
        li.textContent = `${item.name}: ${d.items[id]}/${item.limit}`;
        list.append(li);
      }
      content.append(list);
      const evidence = scene.core.story?.evidence.filter((e) => e.found) || [];
      if (evidence.length)
        paragraph(
          `Сюжетные находки: ${evidence.map((e) => e.name).join(", ")}. Хранятся в дневнике.`,
        );
      const heal = button(
        `Использовать мазь · +${EXPLORATION.salveHeal} HP`,
        () => {
          m.useItem("salve");
          render();
          scene.renderModel();
        },
      );
      heal.dataset.useItem = "salve";
      heal.disabled = !d.items.salve || s.health >= s.maxHealth;
      paragraph(`Здоровье: ${s.health}/${s.maxHealth}`);
      const heading = document.createElement("h3");
      heading.textContent = "Места для исследования";
      content.append(heading);
      for (const id of [
        "mysterious-merchant",
        "fishing",
        "ancient-roots",
        "camp-kitchen",
        "chest:0:-1:0",
      ]) {
        const site = m.get(id),
          open = m.available(site),
          row = document.createElement("article");
        row.className = "activity-card";
        paragraph(
          `${site.name} · ${open ? m.regionSummary(site.regionId) : "Сначала откройте регион или постройте костёр"}`,
          row,
        );
        const route = button(
          "Проложить путь",
          () => {
            queuedRoute = id;
            dismiss();
          },
          row,
        );
        route.dataset.siteRoute = id;
        route.disabled = !open;
        content.append(row);
      }
    }
  }
  function openSite(site) {
    if (scene.core.state.gameOver) return;
    siteId = site.id;
    render();
    scene.pause("activity", true);
    if (!dialog.open) dialog.showModal();
  }
  function openBag() {
    if (scene.core.state.gameOver) return;
    model().cancelAll();
    siteId = null;
    render();
    scene.pause("activity", true);
    if (!dialog.open) dialog.showModal();
  }
  function dismissed() {
    model().close();
    scene.pause("activity", false);
    resumeRoute();
  }
  function resumeRoute() {
    if (queuedRoute && !scene.core.paused) {
      const id = queuedRoute;
      queuedRoute = null;
      model().request(id);
    }
  }
  function dismiss() {
    dialog.close();
  }
  function reel() {
    model().reel();
    scene.renderModel();
  }
  function cancel() {
    model().cancelFishing();
    scene.renderModel();
  }
  bagButton.addEventListener("click", openBag);
  closeButton.addEventListener("click", dismiss);
  dialog.addEventListener("close", dismissed);
  reelButton.addEventListener("click", reel);
  cancelButton.addEventListener("click", cancel);
  return {
    openSite,
    openBag,
    refresh() {
      resumeRoute();
      const f = model().fishing;
      const hidden = !f || scene.core.state.gameOver;
      if (controls.hidden !== hidden) controls.hidden = hidden;
      if (!f) return;
      const text =
        f.phase === "bite"
          ? `Клюёт! Подсекайте · ${Math.max(0, f.timer).toFixed(1)} с`
          : `Ждите поклёвку · ${Math.ceil(f.timer)} с · время идёт`;
      if (text !== lastFishText) {
        lastFishText = text;
        fishStatus.textContent = text;
      }
      const disabled = scene.core.paused || f.phase !== "bite";
      if (reelButton.disabled !== disabled) reelButton.disabled = disabled;
      if (cancelButton.disabled !== scene.core.paused)
        cancelButton.disabled = scene.core.paused;
    },
    destroy() {
      bagButton.removeEventListener("click", openBag);
      closeButton.removeEventListener("click", dismiss);
      dialog.removeEventListener("close", dismissed);
      reelButton.removeEventListener("click", reel);
      cancelButton.removeEventListener("click", cancel);
      dialog.close();
      content.replaceChildren();
      controls.hidden = true;
    },
  };
}
