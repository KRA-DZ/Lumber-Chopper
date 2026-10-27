export function createRegionMap(scene) {
  const dialog = document.querySelector("#mapDialog"),
    grid = dialog.querySelector("[data-regions]");
  let pending = null;
  function resume() {
    if (pending && !scene.core.paused) {
      scene.core.setDestination(pending.x, pending.y);
      pending = null;
    }
  }
  function open() {
    const c = scene.core;
    grid.replaceChildren();
    dialog.querySelector("[data-explored]").textContent =
      `Открыто ${c.regions.unlocked.size} из 25`;
    for (const region of c.regions.all) {
      const button = document.createElement("button"),
        opened = c.regions.unlocked.has(region.id),
        gate = c.regions
          .frontiers()
          .filter((g) => g.region.id === region.id)
          .sort(
            (a, b) =>
              Math.hypot(a.x - c.player.x, a.y - c.player.y) -
              Math.hypot(b.x - c.player.x, b.y - c.player.y),
          )[0];
      button.type = "button";
      button.dataset.region = region.id;
      button.className = opened
        ? "region-open"
        : gate
          ? "region-adjacent"
          : "region-unknown";
      button.disabled = !opened && !gate;
      const title = document.createElement("span"),
        detail = document.createElement("small");
      title.textContent = opened || gate ? region.name : "Неизведано";
      detail.textContent = opened
        ? "Открыто"
        : gate
          ? `${c.state.regionWood[region.id] || 0}/${region.cost} брёвен`
          : "—";
      button.append(title, detail);
      button.addEventListener(
        "click",
        () => {
          pending = opened
            ? { x: region.cx, y: region.cy }
            : { x: gate.x, y: gate.y };
          dialog.close();
        },
        { once: true },
      );
      grid.append(button);
    }
    scene.pause("map", true);
    dialog.showModal();
  }
  const close = () => {
    scene.pause("map", false);
    resume();
  };
  const dismiss = () => dialog.close();
  const button = document.querySelector("#mapButton");
  button.addEventListener("click", open);
  dialog.addEventListener("close", close);
  dialog.querySelector("[data-map-close]").addEventListener("click", dismiss);
  return {
    open,
    resume,
    destroy() {
      button.removeEventListener("click", open);
      dialog.removeEventListener("close", close);
      dialog
        .querySelector("[data-map-close]")
        .removeEventListener("click", dismiss);
      dialog.close();
      grid.replaceChildren();
    },
  };
}
