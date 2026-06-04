import { ref } from "vue";

/**
 * Web Audio API composable for synthetic space-flight sounds.
 * No external audio files required — all sounds generated via oscillators.
 * @param {{ volume?: number }} [options] - volume 0-100 (default 50)
 */
export function useSound(options = {}) {
  const audioCtx = ref(null);
  const volumeLevel = ref(options.volume ?? 50);

  function setVolume(v) {
    volumeLevel.value = v;
  }

  function ensureContext() {
    if (!audioCtx.value) {
      audioCtx.value = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.value.state === "suspended") {
      audioCtx.value.resume();
    }
    return audioCtx.value;
  }

  function vol(base) {
    return base * (volumeLevel.value / 100);
  }

  function playTone({ freq = 440, duration = 0.12, type = "sine", volume = 0.3 } = {}) {
    try {
      const ctx = audioCtx.value;
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(vol(volume), ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      console.warn("[useSound] playTone error:", e);
    }
  }

  function playSequence(notes, interval = 0.08) {
    notes.forEach((note, i) => {
      setTimeout(() => playTone(note), i * interval * 1000);
    });
  }

  function click() {
    playTone({ freq: 800, duration: 0.04, type: "square", volume: 0.15 });
  }

  function send() {
    ensureContext();
    playSequence(
      [
        { freq: 600, duration: 0.06, type: "sine", volume: 0.25 },
        { freq: 900, duration: 0.08, type: "sine", volume: 0.2 },
      ],
      0.06
    );
  }

  function receive() {
    ensureContext();
    playSequence(
      [
        { freq: 1200, duration: 0.04, type: "sine", volume: 0.2 },
        { freq: 800, duration: 0.06, type: "sine", volume: 0.15 },
      ],
      0.06
    );
  }

  function error() {
    ensureContext();
    playTone({ freq: 200, duration: 0.2, type: "sawtooth", volume: 0.2 });
  }

  function cleanup() {
    if (audioCtx.value) {
      audioCtx.value.close().catch(() => {});
      audioCtx.value = null;
    }
  }

  return { playTone, playSequence, click, send, receive, error, setVolume, cleanup };
}
