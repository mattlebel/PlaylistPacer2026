"use client";

/** A tiny four-on-the-floor synth so preview mode can play each song's tempo without Spotify. */
export class BeatBox {
  private ctx: AudioContext;
  private master: GainNode;
  private noise: AudioBuffer;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextBeat = 0;
  private beatIdx = 0;
  bpm = 120;

  constructor() {
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.2, this.ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }

  start() {
    this.ctx.resume();
    if (this.timer) return;
    this.nextBeat = this.ctx.currentTime + 0.05;
    this.timer = setInterval(() => this.schedule(), 25);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  close() {
    this.stop();
    this.ctx.close();
  }

  set muted(m: boolean) {
    this.master.gain.value = m ? 0 : 0.5;
  }

  private schedule() {
    const spb = 60 / this.bpm;
    while (this.nextBeat < this.ctx.currentTime + 0.12) {
      this.kick(this.nextBeat);
      this.hat(this.nextBeat + spb / 2, this.beatIdx % 4 === 3 ? 0.35 : 0.2);
      if (this.beatIdx % 2 === 1) this.clap(this.nextBeat);
      this.nextBeat += spb;
      this.beatIdx++;
    }
  }

  private kick(t: number) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
    g.gain.setValueAtTime(1, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.32);
  }

  private hat(t: number, vol: number) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = 7000;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    s.connect(f).connect(g).connect(this.master);
    s.start(t);
    s.stop(t + 0.06);
  }

  private clap(t: number) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 1500;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.4, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    s.connect(f).connect(g).connect(this.master);
    s.start(t);
    s.stop(t + 0.13);
  }
}
