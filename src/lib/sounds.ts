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
    void recording(ctx); // fetch the crowd recording ahead of the first cheer
    return ctx;
  } catch {
    return null;
  }
}

function announce(name: string) {
  window.dispatchEvent(new CustomEvent("pp:sound", { detail: name }));
}

/** One cowbell hit: two square-wave tones through a band-pass, like the classic drum-machine cowbell. */
function bell(a: BaseAudioContext, at: number, level: number, pitch = 1) {
  const out = a.createGain();
  out.gain.setValueAtTime(0.0001, at);
  out.gain.exponentialRampToValueAtTime(level, at + 0.004);
  out.gain.exponentialRampToValueAtTime(level * 0.35, at + 0.06);
  out.gain.exponentialRampToValueAtTime(0.0001, at + 0.45);
  const band = a.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 2400 * pitch;
  band.Q.value = 0.9;
  band.connect(out).connect(a.destination);
  for (const f of [587 * pitch, 845 * pitch]) {
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

/*
 * The crowd: a real 3-second recording of a cheering crowd (public/sounds/cheer.mp3). If it can't
 * load, the synthesized cheer below plays instead.
 */
const CHEER_URL = "/sounds/cheer.mp3";
let crowd: Promise<AudioBuffer | null> | null = null;
function recording(a: BaseAudioContext) {
  return (crowd ??= fetch(CHEER_URL)
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
    .then((b) => a.decodeAudioData(b))
    .catch(() => {
      crowd = null; // try again next time
      return null;
    }));
}

/** Plays the crowd recording at `delay` seconds from now, or `fallback` if it isn't available. */
function crowdCheer(a: BaseAudioContext, delay: number, level: number, fallback: (t: number) => void) {
  const asked = a.currentTime;
  void recording(a).then((buf) => {
    // A late recording starts a little late, not on top of a later cheer.
    const t = Math.max(a.currentTime, asked + delay);
    if (!buf) return fallback(t);
    const src = a.createBufferSource();
    src.buffer = buf;
    const g = a.createGain();
    g.gain.value = level;
    src.connect(g).connect(a.destination);
    src.start(t);
  });
}

let noise: AudioBuffer | null = null;
function noiseBuffer(a: BaseAudioContext) {
  if (noise && noise.sampleRate === a.sampleRate) return noise;
  noise = a.createBuffer(1, a.sampleRate * 2, a.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noise;
}

/** The crowd cheering, softly: after adding a song. */
export function cheer(delay = 0) {
  const a = audio();
  if (!a) return;
  announce("cheer");
  crowdCheer(a, 0.01 + delay, 0.3, (t) => scheduleCheer(a, t));
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

/** A few people along the course ringing cowbells at once, each bell a little different. About 1.5 seconds. */
export function scheduleCowbellCrew(a: BaseAudioContext, t: number) {
  const people = [0.84, 1, 1.13, 1.32];
  people.forEach((pitch, p) => {
    let at = t + p * 0.07 + Math.random() * 0.05;
    const hits = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < hits && at < t + 1.2; i++) {
      bell(a, at, (i === 0 ? 0.05 : 0.035) * (0.8 + Math.random() * 0.4), pitch);
      at += 0.13 + Math.random() * 0.12;
    }
  });
}

/** A bigger crowd roar than the add-a-song cheer: louder swell, more voices, lots of claps. About 2 seconds. */
export function scheduleRoar(a: BaseAudioContext, t: number) {
  const buf = noiseBuffer(a);
  for (const [freq, q, level] of [
    [1100, 0.7, 0.07],
    [450, 0.8, 0.05],
  ] as const) {
    const crowd = a.createBufferSource();
    crowd.buffer = buf;
    crowd.loop = true;
    const band = a.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = freq;
    band.Q.value = q;
    const swell = a.createGain();
    swell.gain.setValueAtTime(0.0001, t);
    swell.gain.exponentialRampToValueAtTime(level, t + 0.35);
    swell.gain.setValueAtTime(level, t + 1.1);
    swell.gain.exponentialRampToValueAtTime(0.0001, t + 2.1);
    crowd.connect(band).connect(swell).connect(a.destination);
    crowd.start(t, Math.random());
    crowd.stop(t + 2.15);
  }
  for (let i = 0; i < 7; i++) {
    const at = t + 0.08 + i * 0.14 + Math.random() * 0.12;
    const o = a.createOscillator();
    o.type = "triangle";
    const f = 480 + Math.random() * 380;
    o.frequency.setValueAtTime(f, at);
    o.frequency.exponentialRampToValueAtTime(f * 1.6, at + 0.4);
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.014, at + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.6);
    o.connect(g).connect(a.destination);
    o.start(at);
    o.stop(at + 0.65);
  }
  for (let i = 0; i < 22; i++) {
    const at = t + 0.05 + Math.random() * 1.6;
    const clap = a.createBufferSource();
    clap.buffer = buf;
    const hp = a.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 1300;
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.055 * (0.5 + Math.random() * 0.5), at + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.06);
    clap.connect(hp).connect(g).connect(a.destination);
    clap.start(at, Math.random());
    clap.stop(at + 0.07);
  }
}

/** The welcome sound, once you've given your name and tapped "Let's go". */
export type WelcomeSound = "cowbells" | "roar" | "both";
export const WELCOME_SOUND: WelcomeSound = "both";

export function scheduleWelcome(a: BaseAudioContext, t: number, kind: WelcomeSound = WELCOME_SOUND) {
  if (kind !== "roar") scheduleCowbellCrew(a, t);
  if (kind !== "cowbells") scheduleRoar(a, t + (kind === "both" ? 0.15 : 0));
}

export function welcome(kind: WelcomeSound = WELCOME_SOUND) {
  const a = audio();
  if (!a) return;
  announce("welcome");
  const t = a.currentTime + 0.01;
  if (kind !== "roar") scheduleCowbellCrew(a, t);
  if (kind !== "cowbells") crowdCheer(a, kind === "both" ? 0.15 : 0.01, 0.45, (at) => scheduleRoar(a, at));
}

/** The crowd, full voice: as a held song's preview fades out on the drop. */
export function roar(delay = 0) {
  const a = audio();
  if (!a) return;
  announce("roar");
  crowdCheer(a, 0.01 + delay, 0.6, (t) => scheduleRoar(a, t));
}
