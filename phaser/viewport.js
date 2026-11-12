// Keep a readable world height on desktop; cap the backing canvas on wide displays.
// Portrait retains the previous 512-unit width. No devicePixelRatio multiplication.
export function viewportSize(width, height) {
  const ratio = Math.max(1, width) / Math.max(1, height);
  const worldHeight = ratio < 1 ? Math.min(1024, 512 / ratio) : 720;
  const factor = Math.min(1, 1600 / (worldHeight * ratio));
  return { width: Math.max(1, Math.round(worldHeight * ratio * factor)),
    height: Math.max(1, Math.round(worldHeight * factor)) };
}

// Convert the DOM dock height to the same coordinates used by the Phaser HUD.
export function dockInset(scene) {
  const dock = document.querySelector("footer"), canvas = scene.game.canvas;
  const rect = canvas.getBoundingClientRect();
  return dock && rect.height ? Math.max(0, rect.bottom - dock.getBoundingClientRect().top) * scene.scale.height / rect.height : 0;
}

export function initializeDock() {
  const toggle = document.querySelector("#actionsToggle"), nav = toggle.closest("nav");
  const click = () => {
    const expanded = toggle.getAttribute("aria-expanded") !== "true";
    toggle.setAttribute("aria-expanded", String(expanded));
    nav.classList.toggle("expanded", expanded);
    toggle.textContent = expanded ? "Свернуть" : "Ещё";
  };
  toggle.addEventListener("click", click);
  return () => toggle.removeEventListener("click", click);
}
