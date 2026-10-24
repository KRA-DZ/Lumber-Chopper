import { createScene } from "./scene.js";
import { createGame } from "./game.js";
import { installStyleControls } from "./render-style.js";
const canvas = document.querySelector("#world");
export let app = null;
try {
  const world = createScene(canvas),
    game = createGame(world);
  const style = installStyleControls(world);
  app = { world, game, style };
  const initialFocus = new world.THREE.Vector3(game.player.x, 0, game.player.z);
  world.followCamera(initialFocus, 0, true);
  const { THREE } = world,
    raycaster = new THREE.Raycaster(),
    plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
    pointer = new THREE.Vector2();
  raycaster.layers.enable(1);
  let down = null,
    last = null,
    frame;
  canvas.addEventListener("pointerdown", (e) => {
    if (e.isPrimary && e.button === 0) {
      game.sound.unlock();
      e.preventDefault();
      down = { x: e.clientX, y: e.clientY };
    }
  });
  canvas.addEventListener("pointerup", (e) => {
    if (!down || !e.isPrimary) return;
    const d = down;
    down = null;
    if (Math.hypot(d.x - e.clientX, d.y - e.clientY) > 12) return;
    const rect = canvas.getBoundingClientRect();
    pointer.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      (-(e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, world.camera);
    const hits = raycaster.intersectObjects(
      [
        ...world.trees
          .filter((t) => t.active && t.hp > 0 && t.root.visible)
          .map((t) => t.root),
        game.campWorld.giant.root,
      ],
      true,
    );
    while (
      hits.length &&
      ((hits[0].object.material?.opacity ?? 1) < 0.5 || !hits[0].object.visible)
    )
      hits.shift();
    if (hits.length) {
      if (hits[0].object.userData.ancient) {
        game.ancientNotice();
        return;
      }
      game.approach(hits[0].object.userData.tree);
      return;
    }
    const p = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(plane, p)) game.goTo(p.x, p.z);
  });
  canvas.addEventListener("pointercancel", () => (down = null));
  const codes = [
    "KeyW",
    "KeyA",
    "KeyS",
    "KeyD",
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
  ];
  window.addEventListener("keydown", (e) => {
    if (codes.includes(e.code) && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      game.sound.unlock();
      game.keys.add(e.code);
    }
  });
  window.addEventListener("keyup", (e) => game.keys.delete(e.code));
  window.addEventListener("blur", () => game.keys.clear());
  document.querySelector("#light").onclick = () => game.toggleTime();
  document.querySelector("#zoom-in").onclick = () => world.zoom(-0.8);
  document.querySelector("#zoom-out").onclick = () => world.zoom(0.8);
  document.querySelector("#ancient").onclick = () => game.ancientNotice();
  document.querySelector("#home").onclick = () => game.goTo(0, 5.5);
  document.querySelector("#sound").onclick = async () => {
    await game.sound.toggle();
    game.refreshUi();
  };
  document.querySelector("#quality").onclick = () => game.toggleQuality();
  document.querySelector("#weather").onclick = () => {
    const mode = world.weather.cycle();
    const button = document.querySelector("#weather");
    button.textContent =
      mode === "rain" ? "☂" : mode === "clear" ? "☀" : "☁";
    button.setAttribute(
      "aria-label",
      `Погода: ${mode === "auto" ? "автоматически" : mode === "rain" ? "дождь" : "ясно"}. Сменить погоду`,
    );
    game.step(0);
    game.refreshUi();
  };
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      world.zoom(e.deltaY > 0 ? 0.4 : -0.4);
    },
    { passive: false },
  );
  function loop(time) {
    const dt = last === null ? 0 : Math.min((time - last) / 1000, 0.05);
    last = time;
    game.step(dt);
    world.followCamera(new THREE.Vector3(game.player.x, 0, game.player.z), dt);
    game.updateOcclusion();
    world.renderer.render(world.scene, world.camera);
    frame = requestAnimationFrame(loop);
  }
  document.addEventListener("visibilitychange", () => {
    last = null;
    game.keys.clear();
    if (document.hidden) {
      game.save();
      game.sound.pause();
    } else game.sound.resume();
  });
  frame = requestAnimationFrame(loop);
  window.addEventListener("pagehide", () => {
    cancelAnimationFrame(frame);
    game.dispose();
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      game.sound.resume();
      last = null;
      frame = requestAnimationFrame(loop);
    }
  });
} catch (error) {
  const el = document.querySelector("#error");
  el.hidden = false;
  el.textContent =
    "Не удалось открыть 3D-сцену. Для неё нужен WebGL 2. Попробуйте включить аппаратное ускорение или открыть 2D-версию по ссылке внизу.";
  console.error(error);
}
