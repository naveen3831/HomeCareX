/**
 * Emergency siren for the admin SOS alert, made with the Web Audio API (no sound file needed).
 * Browsers only allow sound after the user has touched the page once, so `start()` reports whether it
 * could play and `unlockOnFirstTouch()` retries on the first click, tap or key press.
 */
export interface Siren {
  /** Starts the loop. Returns false when the browser blocked it (no click on the page yet). */
  start: () => Promise<boolean>;
  stop: () => void;
  isPlaying: () => boolean;
}

const LOW_HZ = 650;
const HIGH_HZ = 1000;
const SWEEP_SECONDS = 0.9;
const VOLUME = 0.22;

export function createSiren(): Siren {
  let ctx: AudioContext | null = null;
  let osc: OscillatorNode | null = null;
  let gain: GainNode | null = null;
  let timer: number | null = null;

  const sweep = () => {
    if (!ctx || !osc) return;
    const t = ctx.currentTime;
    osc.frequency.cancelScheduledValues(t);
    osc.frequency.setValueAtTime(LOW_HZ, t);
    osc.frequency.linearRampToValueAtTime(HIGH_HZ, t + SWEEP_SECONDS / 2);
    osc.frequency.linearRampToValueAtTime(LOW_HZ, t + SWEEP_SECONDS);
  };

  return {
    async start() {
      if (osc) return true;
      try {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return false;
        ctx = ctx ?? new Ctor();
        if (ctx.state === "suspended") await ctx.resume();
        if (ctx.state !== "running") return false;
        osc = ctx.createOscillator();
        gain = ctx.createGain();
        osc.type = "square";
        gain.gain.value = VOLUME;
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        sweep();
        timer = window.setInterval(sweep, SWEEP_SECONDS * 1000);
        return true;
      } catch {
        return false;
      }
    },
    stop() {
      if (timer !== null) window.clearInterval(timer);
      timer = null;
      try { osc?.stop(); } catch { /* already stopped */ }
      osc?.disconnect();
      gain?.disconnect();
      osc = null;
      gain = null;
    },
    isPlaying: () => osc !== null,
  };
}

/** Runs `cb` once, on the first click, tap or key press. Returns a cleanup function. */
export function unlockOnFirstTouch(cb: () => void): () => void {
  const events = ["pointerdown", "keydown"] as const;
  const handler = () => { cleanup(); cb(); };
  const cleanup = () => events.forEach((e) => window.removeEventListener(e, handler));
  events.forEach((e) => window.addEventListener(e, handler, { once: true }));
  return cleanup;
}
