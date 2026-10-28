/**
 * Fully synthesised audio: no external files. Ambient loops (burner, wind, rain),
 * procedural music and one-shot effects built from oscillators and noise.
 */
type Sfx =
  | 'click' | 'hover' | 'coin' | 'bigCoin' | 'pickup' | 'shard' | 'hit' | 'thunder' | 'crack' | 'warning'
  | 'record' | 'milestone' | 'nearMiss' | 'tool' | 'repair' | 'zone' | 'shield' | 'end' | 'landing'
  | 'levelUp' | 'purchase' | 'error' | 'whoosh' | 'arc' | 'launch';

const CHORDS_CALM = [
  [261.6, 329.6, 392.0, 493.9],
  [220.0, 261.6, 329.6, 392.0],
  [174.6, 220.0, 261.6, 329.6],
  [196.0, 246.9, 293.7, 392.0],
];
const CHORDS_TENSE = [
  [220.0, 261.6, 329.6, 415.3],
  [233.1, 277.2, 349.2, 415.3],
  [207.7, 261.6, 311.1, 392.0],
  [196.0, 233.1, 293.7, 349.2],
];
const CHORDS_SPACE = [
  [196.0, 293.7, 392.0, 587.3],
  [174.6, 261.6, 349.2, 523.3],
  [155.6, 233.1, 311.1, 466.2],
  [185.0, 277.2, 370.0, 554.4],
];

export class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private music!: GainNode;
  private sfx!: GainNode;
  private noise!: AudioBuffer;
  private burnerGain!: GainNode;
  private burnerFilter!: BiquadFilterNode;
  private windGain!: GainNode;
  private windFilter!: BiquadFilterNode;
  private rainGain!: GainNode;
  private padVoices: { osc: OscillatorNode; gain: GainNode }[] = [];
  private padFilter!: BiquadFilterNode;
  private chordIdx = 0;
  private nextChord = 0;
  private nextArp = 0;
  private arpStep = 0;
  mood: 'calm' | 'tense' | 'space' | 'menu' = 'menu';
  private volumes = { master: 0.8, music: 0.5, sfx: 0.8 };

  /** Must be called from a user gesture. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.music = ctx.createGain();
    this.music.connect(this.master);
    this.sfx = ctx.createGain();
    this.sfx.connect(this.master);
    this.applyVolumes();

    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = w * 0.6 + last * 3;
    }

    const loop = (filterType: BiquadFilterType, freq: number, q = 1) => {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = filterType;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = 0;
      src.connect(f).connect(g).connect(this.sfx);
      src.start();
      return { f, g };
    };
    ({ f: this.burnerFilter, g: this.burnerGain } = loop('bandpass', 700, 0.8));
    ({ f: this.windFilter, g: this.windGain } = loop('lowpass', 400, 0.7));
    ({ g: this.rainGain } = loop('highpass', 3000, 0.5));

    this.padFilter = ctx.createBiquadFilter();
    this.padFilter.type = 'lowpass';
    this.padFilter.frequency.value = 900;
    this.padFilter.connect(this.music);
    for (let i = 0; i < 4; i++) {
      const osc = ctx.createOscillator();
      osc.type = i % 2 ? 'triangle' : 'sine';
      const gain = ctx.createGain();
      gain.gain.value = 0;
      osc.connect(gain).connect(this.padFilter);
      osc.start();
      this.padVoices.push({ osc, gain });
    }
  }

  setVolumes(v: { master: number; music: number; sfx: number }) {
    this.volumes = v;
    this.applyVolumes();
  }
  private applyVolumes() {
    if (!this.ctx) return;
    this.master.gain.value = this.volumes.master;
    this.music.gain.value = this.volumes.music * 0.5;
    this.sfx.gain.value = this.volumes.sfx;
  }

  /** Continuous layers; call every frame. */
  ambient(burner: number, boost: boolean, wind: number, rain: number, dt: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    this.burnerGain.gain.setTargetAtTime(burner * (boost ? 0.55 : 0.35), t, 0.05);
    this.burnerFilter.frequency.setTargetAtTime(boost ? 1100 : 700, t, 0.1);
    this.windGain.gain.setTargetAtTime(Math.min(0.35, 0.04 + wind * 0.012), t, 0.3);
    this.windFilter.frequency.setTargetAtTime(250 + wind * 40, t, 0.3);
    this.rainGain.gain.setTargetAtTime(rain * 0.12, t, 0.4);
    this.updateMusic(dt);
  }

  private updateMusic(_dt: number) {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    if (t >= this.nextChord) {
      const set = this.mood === 'tense' ? CHORDS_TENSE : this.mood === 'space' ? CHORDS_SPACE : CHORDS_CALM;
      this.chordIdx = (this.chordIdx + 1) % set.length;
      const chord = set[this.chordIdx];
      const dur = this.mood === 'tense' ? 2.4 : 4.8;
      this.padVoices.forEach((v, i) => {
        v.osc.frequency.setTargetAtTime(chord[i] / (i === 0 ? 2 : 1), t, 0.3);
        v.gain.gain.setTargetAtTime(0.05, t, 0.6);
      });
      this.padFilter.frequency.setTargetAtTime(this.mood === 'tense' ? 1400 : this.mood === 'space' ? 700 : 950, t, 1);
      this.nextChord = t + dur;
    }
    if (t >= this.nextArp) {
      const set = this.mood === 'tense' ? CHORDS_TENSE : this.mood === 'space' ? CHORDS_SPACE : CHORDS_CALM;
      const chord = set[this.chordIdx];
      const step = this.mood === 'tense' ? 0.2 : 0.4;
      this.nextArp = t + step;
      this.arpStep++;
      const pattern = [0, 2, 1, 3, 2, 1];
      const f = chord[pattern[this.arpStep % pattern.length]] * (this.mood === 'space' ? 2 : 2);
      if (this.mood !== 'menu' || this.arpStep % 2 === 0) this.tone(f, 0, 0.5, this.mood === 'tense' ? 'square' : 'sine', 0.025, this.music);
      if (this.mood === 'tense' && this.arpStep % 4 === 0) this.tone(chord[0] / 2, 0, 0.3, 'sawtooth', 0.04, this.music, 300);
    }
  }

  private tone(freq: number, delay: number, dur: number, type: OscillatorType, vol: number, out?: AudioNode, lp?: number, slideTo?: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node: AudioNode = o;
    if (lp) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lp;
      node.connect(f);
      node = f;
    }
    node.connect(g).connect(out ?? this.sfx);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private burst(dur: number, vol: number, type: BiquadFilterType, freq: number, delay = 0, slide?: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (slide) f.frequency.exponentialRampToValueAtTime(slide, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.sfx);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  play(s: Sfx) {
    if (!this.ctx) return;
    switch (s) {
      case 'click': this.tone(880, 0, 0.08, 'triangle', 0.15); break;
      case 'hover': this.tone(1320, 0, 0.04, 'sine', 0.04); break;
      case 'coin': this.tone(1318, 0, 0.08, 'square', 0.05, undefined, 4000); this.tone(1760, 0.06, 0.18, 'square', 0.05, undefined, 4000); break;
      case 'bigCoin': [1046, 1318, 1568, 2093].forEach((f, i) => this.tone(f, i * 0.05, 0.2, 'square', 0.05, undefined, 5000)); break;
      case 'pickup': this.tone(440, 0, 0.25, 'sine', 0.15, undefined, undefined, 990); break;
      case 'shard': [1568, 2093, 2637, 3136].forEach((f, i) => this.tone(f, i * 0.07, 0.4, 'sine', 0.08)); break;
      case 'hit': this.burst(0.35, 0.6, 'lowpass', 900, 0, 120); this.tone(110, 0, 0.25, 'sine', 0.3, undefined, undefined, 50); break;
      case 'thunder': this.burst(2.6, 0.7, 'lowpass', 400, 0.05, 60); this.burst(0.15, 0.4, 'highpass', 2000); break;
      case 'crack': this.burst(0.25, 0.5, 'highpass', 1500); break;
      case 'warning': [0, 0.28, 0.56].forEach((d) => { this.tone(880, d, 0.18, 'square', 0.06, undefined, 2500); this.tone(660, d + 0.12, 0.14, 'square', 0.05, undefined, 2500); }); break;
      case 'record': [523, 659, 784, 1046, 784, 1046].forEach((f, i) => this.tone(f, i * 0.11, 0.35, 'triangle', 0.13)); this.tone(261, 0, 0.9, 'sawtooth', 0.05, undefined, 1200); break;
      case 'milestone': [784, 1046, 1318].forEach((f, i) => this.tone(f, i * 0.09, 0.4, 'triangle', 0.1)); break;
      case 'nearMiss': this.burst(0.4, 0.3, 'bandpass', 600, 0, 2400); break;
      case 'whoosh': this.burst(0.6, 0.25, 'bandpass', 300, 0, 1500); break;
      case 'tool': this.tone(220, 0, 0.3, 'sawtooth', 0.08, undefined, 1500, 880); break;
      case 'shield': this.tone(330, 0, 0.6, 'sine', 0.12, undefined, undefined, 660); this.tone(495, 0.05, 0.6, 'sine', 0.08); break;
      case 'repair': [0, 0.18, 0.36].forEach((d) => { this.tone(1800, d, 0.06, 'square', 0.05, undefined, 3000); this.burst(0.05, 0.2, 'highpass', 3000, d); }); break;
      case 'zone': [392, 523, 659, 784, 1046].forEach((f, i) => this.tone(f, i * 0.12, 1.2, 'sine', 0.07)); break;
      case 'end': [392, 349, 311, 262].forEach((f, i) => this.tone(f, i * 0.22, 0.5, 'triangle', 0.1)); break;
      case 'landing': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, i * 0.15, 0.6, 'triangle', 0.1)); break;
      case 'levelUp': [523, 784, 1046, 1568].forEach((f, i) => this.tone(f, i * 0.08, 0.5, 'square', 0.06, undefined, 3000)); break;
      case 'purchase': this.tone(660, 0, 0.1, 'square', 0.06, undefined, 3000); this.tone(990, 0.08, 0.2, 'square', 0.06, undefined, 3000); break;
      case 'error': this.tone(180, 0, 0.18, 'sawtooth', 0.08, undefined, 800); break;
      case 'arc': this.burst(0.4, 0.4, 'bandpass', 2500, 0, 400); this.tone(80, 0, 0.3, 'sawtooth', 0.1, undefined, 600); break;
      case 'launch': this.burst(1.2, 0.35, 'bandpass', 500, 0, 1200); break;
    }
  }
}

export const audio = new AudioEngine();
