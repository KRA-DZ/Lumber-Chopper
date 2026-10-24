import { normalizeStyle } from "./engraving.js";

export function installStyleControls(world) {
  const buttons = [...document.querySelectorAll("[data-style-choice]")];
  let current = "lowpoly";
  function setStyle(value, updateUrl = true) {
    current = normalizeStyle(value);
    world.engraving.setEnabled(current === "engraving");
    document.documentElement.dataset.renderStyle = current;
    buttons.forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.styleChoice === current),
      ),
    );
    document.querySelector("#style-status").textContent =
      current === "engraving"
        ? "Гравюра · пробный режим №5"
        : "Low-poly · основной стиль №4";
    document.querySelector("#world-badge").textContent =
      current === "engraving" ? "ЛЕСНАЯ ГРАВЮРА · ПРОБА" : "КРУГЛЫЙ МИР · 3D";
    document.title =
      current === "engraving"
        ? "Лесная смена — пробная гравюра"
        : "Лесная смена — 3D-поляна";
    if (updateUrl) {
      const url = new URL(location.href);
      if (current === "engraving") url.searchParams.set("style", "engraving");
      else url.searchParams.delete("style");
      history.replaceState(
        history.state,
        "",
        url.pathname + url.search + url.hash,
      );
    }
  }
  for (const button of buttons)
    button.addEventListener("click", () =>
      setStyle(button.dataset.styleChoice),
    );
  setStyle(new URLSearchParams(location.search).get("style"), false);
  return {
    setStyle,
    get current() {
      return current;
    },
  };
}
