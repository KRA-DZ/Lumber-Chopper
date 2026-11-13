import { HERO_APPEARANCES } from "../game/appearances.js";
import {createHeroCustomizer} from './hero-customizer.js';
// No simulation exists until the player explicitly starts. The choice is never persisted.
export function selectHero(scene, start) {
  const dialog = document.querySelector("#heroDialog"),
    form = dialog.querySelector("form"),
    error = dialog.querySelector("[data-hero-error]");
  const customizer=createHeroCustomizer(scene,form);
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
    document.body.classList.add("game-live");
    scene.registry.set("heroAppearance", id);
    scene.registry.set('heroChoices',customizer.choices());
    scene.registry.set("playerCount", new FormData(form).get("players") === "2" ? 2 : 1);
    scene.registry.set("runName",String(new FormData(form).get("runName")||"Лесоруб").trim().slice(0,32));
    scene.registry.set("cycleSpeed",new FormData(form).get("tempo")==="quick"?2.5:1);
    start();
  };
  function cleanup() {
    customizer.dispose();
    form.removeEventListener("submit", submit);
    dialog.removeEventListener("cancel", prevent);
  }
  form.addEventListener("submit", submit);
  dialog.addEventListener("cancel", prevent);
  scene.events.once("shutdown", cleanup);
  dialog.showModal();
}
