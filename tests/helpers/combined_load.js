// Stress fixture only: rain and night intentionally overlap; high HP prevents a defeat screen.
// Every measured quality/version starts from a fresh page with the same open 3x3 map.
(light) => {
  window.g = lumberPhaser; window.w = g.scene; window.m = g.core;
  w.manual = true;
  for (const r of m.regions.all)
    if (Math.abs(r.gx) <= 1 && Math.abs(r.gy) <= 1) {
      m.regions.unlocked.add(r.id);
      m.world.generate(r);
    }
  m.state.campLevel = 3;
  m.nav.rebuildObstacles();
  for (const d of m.defenses.all())
    if (d.kind !== "fence") for (let i = 0; i < d.cost; i++) m.defenses.deposit(d.id);
  m.state.maxWood = 82;
  while (m.state.wood < 82) m.forestry.addCargo(10);
  m.state.health = m.state.maxHealth = m.state.campHealth = m.state.maxCampHealth = 1e6;
  Object.assign(m.player, m.nav.nearestGround(1800, 1980), { path: [], autoTimer: 10000 });
  m.state.calendarDay = 29; m.state.worldTime = 449.99;
  g.step(.02); g.step(12.1);
  m.state.worldTime = 450;
  const p = m.player;
  for (const [i, e] of [...m.survival.raiders, ...m.survival.minions].entries()) {
    const angle = i * 2.4;
    Object.assign(e, m.nav.nearestGround(p.x + Math.cos(angle) * 220, p.y + Math.sin(angle) * 220),
      { path: [], repath: 0, warning: 0 });
  }
  Object.assign(m.survival.monster, m.nav.nearestGround(p.x + 130, p.y),
    { path: [], repath: 0, warning: 0, senseTimer: 0 });
  const weather = w.atmosphere.weather, updateWeather = weather.update.bind(weather),
    rainState = Object.create(m.state);
  rainState.worldTime = 220;
  weather.update = (dt, state, cycle, day, trees, player) => updateWeather(dt, rainState, cycle, 0, trees, player);
  if (w.effectsLight !== light) document.querySelector("#effectsBtn").click();
  w.manual = false;
  const original = w.sys.sceneUpdate.bind(w);
  window.samples = { cpu: [], frames: [], phases: new Set(), on: false };
  w.sys.sceneUpdate = (time, delta) => {
    const start = performance.now(); original(time, delta);
    if (samples.on && samples.cpu.length < 2000) samples.cpu.push(performance.now() - start);
    if (samples.on && m.survival.monster) samples.phases.add(m.survival.monster.phase);
  };
  let last = performance.now(), destination = p.x + 50;
  const a = p.x - 50, b = p.x + 50, y = p.y;
  w.events.on("postupdate", () => {
    if (Math.abs(p.x - destination) < 12) destination = destination === b ? a : b;
    if (!p.path.length) m.setDestination(destination, y);
  });
  function frame(now) {
    if (samples.on && samples.frames.length < 2000) samples.frames.push(now - last);
    last = now; requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
