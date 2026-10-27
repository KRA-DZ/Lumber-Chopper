// Small procedural soundscape. AudioContext is created only by the sound button.
export function createForestAudio() {
  let context,
    master,
    wind,
    rain,
    noise,
    enabled = false,
    paused = false,
    timer = 1,
    fireTimer = 0;
  const safe = (promise) => promise?.catch(() => {});
  function tone(freq, duration, volume, slide = 1) {
    if (!context || !enabled || paused || context.state !== "running") return;
    const o = context.createOscillator(),
      g = context.createGain(),
      t = context.currentTime;
    o.type = "sine";
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * slide, t + duration);
    g.gain.setValueAtTime(volume, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + duration);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }
  function crackle(volume) {
    if (!context || !enabled || paused || context.state !== "running") return;
    const source = context.createBufferSource(),
      filter = context.createBiquadFilter(),
      g = context.createGain(),
      t = context.currentTime;
    source.buffer = noise;
    filter.type = "highpass";
    filter.frequency.value = 1200;
    g.gain.setValueAtTime(volume, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    source.connect(filter);
    filter.connect(g);
    g.connect(master);
    source.start(t);
    source.stop(t + 0.09);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      g.disconnect();
    };
  }
  return {
    async toggle() {
      if (!context) {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) return false;
        context = new Audio();
        master = context.createGain();
        master.gain.value = 0.45;
        master.connect(context.destination);
        noise = context.createBuffer(
          1,
          context.sampleRate * 2,
          context.sampleRate,
        );
        const samples = noise.getChannelData(0);
        for (let i = 0; i < samples.length; i++)
          samples[i] = Math.random() * 2 - 1;
        for (const kind of ["wind", "rain"]) {
          const source = context.createBufferSource(),
            filter = context.createBiquadFilter(),
            g = context.createGain();
          source.buffer = noise;
          source.loop = true;
          filter.type = kind === "wind" ? "lowpass" : "highpass";
          filter.frequency.value = kind === "wind" ? 450 : 800;
          g.gain.value = kind === "wind" ? 0.035 : 0;
          source.connect(filter);
          filter.connect(g);
          g.connect(master);
          source.start();
          if (kind === "wind") wind = g;
          else rain = g;
        }
      }
      enabled = !enabled;
      await (enabled && !paused ? context.resume() : context.suspend());
      return enabled;
    },
    setPaused(value) {
      paused = value;
      if (context)
        safe(enabled && !paused ? context.resume() : context.suspend());
    },
    update(dt, core, profile) {
      if (!enabled || paused || !context || dt <= 0) return;
      rain.gain.setTargetAtTime(profile.rain * 0.07, context.currentTime, 0.4);
      wind.gain.setTargetAtTime(
        0.025 + profile.rain * 0.02,
        context.currentTime,
        0.4,
      );
      timer -= dt;
      fireTimer -= dt;
      if (timer <= 0) {
        const night = core.nightAmount() > 0.5;
        tone(
          night ? 3600 : 1800 + Math.random() * 900,
          night ? 0.08 : 0.2,
          night ? 0.012 : 0.02,
          night ? 1.05 : 1.7,
        );
        timer = night ? 0.7 : 3 + Math.random() * 4;
      }
      if (core.state.campLevel > 0 && fireTimer <= 0) {
        crackle(
          Math.max(
            0,
            1 - Math.hypot(core.player.x - 1600, core.player.y - 1600) / 320,
          ) * 0.035,
        );
        fireTimer = 0.15 + Math.random() * 0.3;
      }
    },
    hit() {
      tone(165, 0.08, 0.055, 0.45);
    },
    sale() {
      tone(880, 0.13, 0.035, 1.5);
    },
    destroy() {
      enabled = false;
      if (context) safe(context.close());
      context = null;
    },
    get enabled() {
      return enabled;
    },
    get context() {
      return context;
    },
  };
}
