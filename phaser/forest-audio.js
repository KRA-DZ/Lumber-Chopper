// Small procedural soundscape. AudioContext is created only by the sound button.
import { ambientCue } from "../game/biome-soundscape.js";
export function createForestAudio() {
  let context,
    master,
    wind,
    rain,
    noise,
    enabled = false,
    paused = false,
    timer = 1,
    fireTimer = 0,
    threatTimer = 0,
    windupVoice = null,
    lastAmbient = null;
  const voices = new Set();
  const safe = (promise) => promise?.catch(() => {});
  function tone(freq, duration, volume, slide = 1, pan = 0) {
    if (
      !context ||
      !enabled ||
      paused ||
      context.state !== "running" ||
      voices.size >= 12
    )
      return;
    const o = context.createOscillator(),
      g = context.createGain(),
      t = context.currentTime;
    o.type = "sine";
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * slide, t + duration);
    g.gain.setValueAtTime(volume, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    o.connect(g);
    const panner = context.createStereoPanner?.();
    if (panner) {
      panner.pan.value = pan;
      g.connect(panner);
      panner.connect(master);
    } else g.connect(master);
    const voice = {
      stop: () => {
        try {
          o.stop();
        } catch {}
      },
    };
    voices.add(voice);
    o.start(t);
    o.stop(t + duration);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
      panner?.disconnect();
      voices.delete(voice);
    };
    return voice;
  }
  function crackle(volume, pan = 0, frequency = 1200, duration = 0.09) {
    if (
      !context ||
      !enabled ||
      paused ||
      context.state !== "running" ||
      voices.size >= 12
    )
      return;
    const source = context.createBufferSource(),
      filter = context.createBiquadFilter(),
      g = context.createGain(),
      t = context.currentTime;
    source.buffer = noise;
    filter.type = "highpass";
    filter.frequency.value = frequency;
    g.gain.setValueAtTime(volume, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    source.connect(filter);
    filter.connect(g);
    const panner = context.createStereoPanner?.();
    if (panner) {
      panner.pan.value = pan;
      g.connect(panner);
      panner.connect(master);
    } else g.connect(master);
    const voice = {
      stop: () => {
        try {
          source.stop();
        } catch {}
      },
    };
    voices.add(voice);
    source.start(t);
    source.stop(t + duration);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      g.disconnect();
      panner?.disconnect();
      voices.delete(voice);
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
      if (!enabled) {
        for (const voice of voices) voice.stop();
        voices.clear();
        windupVoice = null;
      }
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
        (core.world.biomeAt(core.player.x, core.player.y) === "swamp" ? 0.016 : 0.025) + profile.rain * 0.02,
        context.currentTime,
        0.4,
      );
      timer -= dt;
      fireTimer -= dt;
      const m = core.survival?.monster;
      const range = m
        ? Math.hypot(m.x - core.player.x, m.y - core.player.y)
        : Infinity;
      const danger =
        m &&
        ["notice", "chase", "windup", "strike"].includes(m.phase) &&
        range < 400 &&
        !core.survival.isSafe(core.player);
      threatTimer -= dt;
      if (danger && threatTimer <= 0) {
        tone(64, 0.16, 0.025, 0.6);
        threatTimer = 0.9;
      }
      if (!danger) threatTimer = 0;
      if (timer <= 0 && !danger) {
        const cue = ambientCue(core);
        lastAmbient = cue;
        if (cue.kind === "steps") crackle(cue.volume, cue.pan, cue.frequency, cue.duration);
        else {
          tone(cue.frequency, cue.duration, cue.volume, cue.kind === "frog" ? 0.55 : 1.2, cue.pan);
          if (cue.kind === "bird") tone(cue.frequency * 1.3, 0.1, cue.volume * 0.5, 1.1, cue.pan);
        }
        timer = cue.interval;
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
    watcherCue(phase, pan = 0, range = 0, duration = 1.2) {
      windupVoice?.stop();
      windupVoice = null;
      if (range > 650) return;
      if (phase === "waking") tone(88, 0.8, 0.03, 0.65, pan);
      if (phase === "notice") tone(115, 0.45, 0.05, 0.7, pan);
      if (phase === "chase") tone(165, 0.5, 0.04, 0.5, pan);
      if (phase === "windup")
        windupVoice = tone(240, duration, 0.055, 1.8, pan);
      if (phase === "strike") tone(70, 0.22, 0.07, 0.45, pan);
      if (phase === "repelled") tone(190, 0.35, 0.025, 1.5, pan);
    },
    get activeVoices() {
      return voices.size;
    },
    get ambience() {
      return lastAmbient;
    },
    warning() {
      tone(440, 0.6, 0.045, 0.5);
    },
    hit() {
      tone(165, 0.08, 0.055, 0.45);
    },
    sale() {
      tone(880, 0.13, 0.035, 1.5);
    },
    destroy() {
      enabled = false;
      for (const voice of voices) voice.stop();
      voices.clear();
      windupVoice = null;
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
