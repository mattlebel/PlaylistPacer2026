"use client";

/**
 * Little race-day sounds, made on the fly with Web Audio (no files to download): a cowbell
 * "clonk-clonk" and a short crowd cheer. Quiet, short, only after something you did, and easy to
 * turn off. Every sound also fires a "pp:sound" event, which the tests listen for.
 */

const KEY = "pp.sound";
let ctx: AudioContext | null = null;

export function soundOn() {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundOn(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    /* private mode: stays on for this visit */
  }
}

function audio(): AudioContext | null {
  if (typeof window === "undefined" || !soundOn()) return null;
  try {
    // On iPhones: mix with music that's already playing, and respect the silent switch.
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session) session.type = "ambient";
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function announce(name: string) {
  window.dispatchEvent(new CustomEvent("pp:sound", { detail: name }));
}

/** One cowbell hit: two square-wave tones through a band-pass, like the classic drum-machine cowbell. */
function bell(a: BaseAudioContext, at: number, level: number) {
  const out = a.createGain();
  out.gain.setValueAtTime(0.0001, at);
  out.gain.exponentialRampToValueAtTime(level, at + 0.004);
  out.gain.exponentialRampToValueAtTime(level * 0.35, at + 0.06);
  out.gain.exponentialRampToValueAtTime(0.0001, at + 0.45);
  const band = a.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 2400;
  band.Q.value = 0.9;
  band.connect(out).connect(a.destination);
  for (const f of [587, 845]) {
    const o = a.createOscillator();
    o.type = "square";
    o.frequency.value = f;
    o.connect(band);
    o.start(at);
    o.stop(at + 0.5);
  }
}

/** Schedules cowbell hits at time `t` on any audio context (live, or offline for a preview file). */
export function scheduleCowbell(a: BaseAudioContext, t: number, hits = 2) {
  for (let i = 0; i < hits; i++) bell(a, t + i * 0.16, i === 0 ? 0.09 : 0.065);
}

/** "Clonk-clonk". */
export function cowbell(hits = 2) {
  const a = audio();
  if (!a) return;
  announce("cowbell");
  scheduleCowbell(a, a.currentTime + 0.01, hits);
}

let noise: AudioBuffer | null = null;
function noiseBuffer(a: BaseAudioContext) {
  if (noise && noise.sampleRate === a.sampleRate) return noise;
  noise = a.createBuffer(1, a.sampleRate * 2, a.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noise;
}

/** A soft crowd swell with scattered claps, about 1.4 seconds. */
export function cheer(delay = 0) {
  const a = audio();
  if (!a) return;
  announce("cheer");
  scheduleCheer(a, a.currentTime + 0.01 + delay);
}

/** Schedules the cheer at time `t` on any audio context. */
export function scheduleCheer(a: BaseAudioContext, t: number) {
  const buf = noiseBuffer(a);

  // The crowd: band-passed noise that swells and fades.
  const crowd = a.createBufferSource();
  crowd.buffer = buf;
  const band = a.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 1100;
  band.Q.value = 0.7;
  const swell = a.createGain();
  swell.gain.setValueAtTime(0.0001, t);
  swell.gain.exponentialRampToValueAtTime(0.05, t + 0.25);
  swell.gain.setValueAtTime(0.05, t + 0.7);
  swell.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
  crowd.connect(band).connect(swell).connect(a.destination);
  crowd.start(t);
  crowd.stop(t + 1.45);

  // A few voices: little rising "woo"s.
  for (let i = 0; i < 3; i++) {
    const at = t + 0.1 + i * 0.18 + Math.random() * 0.1;
    const o = a.createOscillator();
    o.type = "triangle";
    const f = 520 + Math.random() * 260;
    o.frequency.setValueAtTime(f, at);
    o.frequency.exponentialRampToValueAtTime(f * 1.5, at + 0.35);
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.012, at + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.5);
    o.connect(g).connect(a.destination);
    o.start(at);
    o.stop(at + 0.55);
  }

  // Claps: short bright noise bursts at random moments.
  for (let i = 0; i < 9; i++) {
    const at = t + 0.05 + Math.random() * 1.0;
    const clap = a.createBufferSource();
    clap.buffer = buf;
    const hp = a.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 1400;
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.06 * (0.5 + Math.random() * 0.5), at + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.06);
    clap.connect(hp).connect(g).connect(a.destination);
    clap.start(at, Math.random());
    clap.stop(at + 0.07);
  }
}
