// Небольшой синтезатор Web Audio: нет аудиозагрузок, таймеров и фоновой музыки.
// Контекст открывается только после жеста пользователя; одновременно не более 12 голосов.
export function createSound(storage) {
  let enabled = true;
  try {
    enabled = storage?.getItem("lumber-chopper-sound-v1") !== "off";
  } catch {}
  let context,
    master,
    noiseBuffer,
    ambience,
    fire,
    rain,
    nextStep = 0,
    nextCreak = 0,
    nextBird = 5,
    suspended = false;
  const voices = new Set();
  function setup() {
    if (context) return;
    const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Audio) return;
    context = new Audio();
    master = context.createGain();
    master.gain.value = 0.22;
    master.connect(context.destination);
    noiseBuffer = context.createBuffer(
      1,
      context.sampleRate * 2,
      context.sampleRate,
    );
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = context.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;
    function bed(frequency, type) {
      const filter = context.createBiquadFilter(),
        gain = context.createGain();
      filter.type = type;
      filter.frequency.value = frequency;
      gain.gain.value = 0;
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      return gain;
    }
    ambience = bed(360, "lowpass");
    fire = bed(850, "lowpass");
    rain = bed(2600, "lowpass");
    noise.start();
  }
  async function unlock() {
    if (!enabled || suspended) return;
    try {
      setup();
      if (context?.state === "suspended") await context.resume();
    } catch {}
  }
  function tone(
    frequency,
    duration = 0.12,
    volume = 0.1,
    type = "sine",
    endFrequency = frequency,
    noisy = false,
  ) {
    if (
      !enabled ||
      suspended ||
      context?.state !== "running" ||
      voices.size >= 12
    )
      return;
    const node = noisy
        ? context.createBufferSource()
        : context.createOscillator(),
      gain = context.createGain(),
      now = context.currentTime;
    if (noisy) node.buffer = noiseBuffer;
    else {
      node.type = type;
      node.frequency.setValueAtTime(frequency, now);
      node.frequency.exponentialRampToValueAtTime(
        Math.max(20, endFrequency),
        now + duration,
      );
    }
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = noisy ? frequency : 7000;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    node.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    voices.add(node);
    node.onended = () => {
      voices.delete(node);
      node.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
    node.start();
    node.stop(now + duration + 0.015);
  }
  function bird(volume = 0.07) {
    tone(2100, 0.18, volume, "sine", 3100);
  }
  function update(dt, elapsed, state, player, weather) {
    if (context?.state !== "running" || !enabled || suspended) return;
    const now = context.currentTime;
    const night = state.worldTime > 650 || state.worldTime < 60;
    const waterfall =
      Math.max(0, 1 - Math.hypot(player.x + 18, player.z - 15) / 10) * 0.05;
    ambience.gain.setTargetAtTime(
      (night ? 0.028 : 0.018) + waterfall,
      now,
      0.5,
    );
    rain.gain.setTargetAtTime(weather.rain * 0.11, now, 0.4);
    fire.gain.setTargetAtTime(
      state.campLevel >= 1
        ? Math.max(0, 1 - Math.hypot(player.x, player.z) / 9) *
            (0.055 + Math.sin(elapsed * 17) * 0.008)
        : 0,
      now,
      0.3,
    );
    nextStep -= dt;
    nextCreak -= dt;
    nextBird -= dt;
    if (player.moving && nextStep <= 0) {
      tone(700, 0.07, 0.06, "sine", 700, true);
      nextStep = 0.32;
    }
    if (player.moving && state.wood > 9 && nextCreak <= 0) {
      tone(130, 0.23, 0.035, "triangle", 70);
      nextCreak = 2.5;
    }
    if (nextBird <= 0) {
      tone(
        night ? 4300 : 2300,
        night ? 0.07 : 0.18,
        0.025,
        "sine",
        night ? 4100 : 3000,
      );
      nextBird = night ? 2.5 : 6 + Math.sin(elapsed) * 2;
    }
  }
  function pause() {
    suspended = true;
    if (context?.state === "running") context.suspend().catch(() => {});
  }
  function resume() {
    suspended = false;
    if (context && enabled) context.resume().catch(() => {});
  }
  async function toggle() {
    enabled = !enabled;
    try {
      storage?.setItem("lumber-chopper-sound-v1", enabled ? "on" : "off");
    } catch {}
    if (enabled) {
      suspended = false;
      await unlock();
    } else if (context) {
      master.gain.value = 0;
      await context.suspend().catch(() => {});
    }
    if (context && enabled)
      master.gain.setTargetAtTime(0.22, context.currentTime, 0.03);
    return enabled;
  }
  return {
    unlock,
    toggle,
    pause,
    resume,
    update,
    bird,
    hit() {
      tone(145, 0.1, 0.12, "triangle", 70);
      tone(1400, 0.045, 0.07, "sine", 1400, true);
    },
    pickup() {
      tone(480, 0.12, 0.06, "sine", 750);
    },
    build() {
      tone(200, 0.07, 0.08, "triangle", 120);
    },
    complete() {
      tone(660, 0.3, 0.07, "sine", 990);
    },
    sell() {
      tone(960, 0.09, 0.045, "sine", 1200);
    },
    discovery() {
      tone(500, 0.4, 0.06, "sine", 1000);
    },
    get enabled() {
      return enabled;
    },
    get contextState() {
      return context?.state || "locked";
    },
    get voiceCount() {
      return voices.size;
    },
  };
}
