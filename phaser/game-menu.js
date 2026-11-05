// A manual pause owns only its own reason; closing it cannot resume a backgrounded game.
export function createGameMenu(scene) {
  const dialog = document.querySelector("#gameMenu"),
    button = document.querySelector("#menuButton"),
    resume = dialog.querySelector("[data-menu-close]");
  let returnFocus = button;
  function open() {
    if (
      scene.core.state.gameOver ||
      scene.core.paused ||
      document.querySelector("dialog[open]")
    )
      return false;
    returnFocus =
      document.activeElement === document.body
        ? button
        : document.activeElement;
    scene.pause("menu", true);
    dialog.querySelector("[data-pause-status]").textContent =
      `День ${scene.core.state.calendarDay + 1} · ${scene.core.state.coins} монет · ${scene.core.state.wood}/${scene.core.state.maxWood} брёвен. Время, бой и сбор ресурсов приостановлены.`;
    button.setAttribute("aria-expanded", "true");
    dialog.showModal();
    return true;
  }
  function close() {
    if (!dialog.open) return false;
    dialog.close();
    return true;
  }
  function closed() {
    button.setAttribute("aria-expanded", "false");
    scene.pause("menu", false);
    returnFocus?.focus({ preventScroll: true });
  }
  function key(event) {
    if (
      event.repeat ||
      event.ctrlKey ||
      event.altKey ||
      event.metaKey ||
      !["KeyP", "Escape"].includes(event.code) ||
      event.target.closest?.("input, textarea, select, [contenteditable=true]")
    )
      return;
    const other = document.querySelector("dialog[open]");
    if (other && other !== dialog) return;
    if (dialog.open ? close() : open()) event.preventDefault();
  }
  button.setAttribute("aria-expanded", "false");
  button.addEventListener("click", open);
  resume.addEventListener("click", close);
  dialog.addEventListener("close", closed);
  document.addEventListener("keydown", key);
  return {
    open,
    close,
    destroy() {
      button.removeEventListener("click", open);
      resume.removeEventListener("click", close);
      dialog.removeEventListener("close", closed);
      document.removeEventListener("keydown", key);
      dialog.close();
      button.setAttribute("aria-expanded", "false");
    },
  };
}
