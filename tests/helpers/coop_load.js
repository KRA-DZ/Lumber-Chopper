// Synthetic two-camera load, not normal starting inventory or combat balance.
() => {
  w.manual = true;
  for (const r of m.regions.all) if (Math.abs(r.gx) <= 1 && Math.abs(r.gy) <= 1) {
    m.regions.unlocked.add(r.id); m.world.generate(r);
  }
  m.state.campLevel = 3;
  for (const c of m.actors) c.refreshWorld();
  for (const [i, c] of m.actors.entries()) {
    c.state.maxWood = 82;
    while (c.state.wood < 82) c.forestry.addCargo(10);
    c.state.health = c.state.maxHealth = 1e6;
    Object.assign(c.player, c.nav.nearestGround(i ? 3200 : 1600, i ? 1800 : 3200),
      { path: [], autoTimer: 10000 });
  }
  m.state.campHealth = m.state.maxCampHealth = 1e6;
  m.state.calendarDay = 29; m.state.worldTime = 449.99;
  g.step(.02); g.step(12.1); m.state.worldTime = 450;
  const weather = w.atmosphere.weather, originalWeather = weather.update.bind(weather), rain = { ...m.state, worldTime: 220 };
  weather.update = (dt, state, cycle, day, trees, player) => originalWeather(dt, rain, cycle, 0, trees, player);
  w.manual = false;
  const update = w.sys.sceneUpdate.bind(w);
  window.samples = { cpu: [], frames: [], on: false };
  w.sys.sceneUpdate = (time, delta) => {
    const start = performance.now(); update(time, delta);
    if (samples.on && samples.cpu.length < 2000) samples.cpu.push(performance.now() - start);
  };
  const starts = m.actors.map(c => ({ x: c.player.x, y: c.player.y, sign: 1 }));
  w.events.on('postupdate', () => {
    m.actors.forEach((c, i) => {
      const p = c.player, start = starts[i], goal = start.x + start.sign * 50;
      if (Math.abs(p.x - goal) < 12) start.sign *= -1;
      if (!p.path.length) c.setDestination(start.x + start.sign * 50, start.y);
    });
  });
  let last = performance.now();
  function frame(now) {
    if (samples.on && samples.frames.length < 2000) samples.frames.push(now - last);
    last = now; requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
