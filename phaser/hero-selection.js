import { HERO_APPEARANCES } from "../game/appearances.js";
// No simulation exists until the player explicitly starts. The choice is never persisted.
export function selectHero(scene, start) {
  const dialog = document.querySelector("#heroDialog"),
    form = dialog.querySelector("form"),
    error = dialog.querySelector("[data-hero-error]");
  const prevent = (event) => event.preventDefault();
  const submit = (event) => {
    event.preventDefault();
    const id = new FormData(form).get("appearance");
    if (!Object.hasOwn(HERO_APPEARANCES, id)) {
      error.textContent = "Выберите персонажа.";
      return;
    }
    cleanup();
    dialog.close();
    scene.registry.set("heroAppearance", id);
    start();
  };
  function cleanup() {
    form.removeEventListener("submit", submit);
    dialog.removeEventListener("cancel", prevent);
  }
  form.addEventListener("submit", submit);
  dialog.addEventListener("cancel", prevent);
  scene.events.once("shutdown", cleanup);
  dialog.showModal();
}
