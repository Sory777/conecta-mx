// Audio 100% procedural con WebAudio: sin archivos, sin licencias y ligero para móvil.
// Se sustituirá/combinará con audio grabado (FMOD/Wwise o archivos OGG) en fases posteriores.

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private ambBus!: GainNode;
  private windGain!: GainNode;
  private windFilter!: BiquadFilterNode;
  private rainGain!: GainNode;
  private cricketGain!: GainNode;
  private caveGain!: GainNode;
  private padFilter!: BiquadFilterNode;
  private padGain!: GainNode;
  private pulseGain!: GainNode;
  private noiseBuf!: AudioBuffer;
  private nextCricket = 0;
  private nextDrip = 0;
  private nextTension = 0;
  volumes = { master: 0.8, music: 0.6, sfx: 0.9, ambient: 0.8 };

  get ready() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  /** Debe llamarse tras un gesto del usuario (política de autoplay). */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.musicBus = this.bus();
    this.sfxBus = this.bus();
    this.ambBus = this.bus();
    this.applyVolumes();

    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02; // ruido marrón
      d[i] = last * 3.5;
    }

    // Viento
    const wind = this.noise(true);
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.value = 400;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.25;
    wind.connect(this.windFilter).connect(this.windGain).connect(this.ambBus);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoAmt = ctx.createGain();
    lfoAmt.gain.value = 220;
    lfo.connect(lfoAmt).connect(this.windFilter.frequency);
    lfo.start();

    // Lluvia (ruido blanco filtrado)
    const rain = this.noise(false);
    const rf = ctx.createBiquadFilter();
    rf.type = 'bandpass';
    rf.frequency.value = 2500;
    rf.Q.value = 0.4;
    this.rainGain = ctx.createGain();
    this.rainGain.gain.value = 0;
    rain.connect(rf).connect(this.rainGain).connect(this.ambBus);

    this.cricketGain = ctx.createGain();
    this.cricketGain.gain.value = 0;
    this.cricketGain.connect(this.ambBus);

    // Cueva: zumbido grave + goteos
    const cave = this.noise(true);
    const cf = ctx.createBiquadFilter();
    cf.type = 'lowpass';
    cf.frequency.value = 120;
    this.caveGain = ctx.createGain();
    this.caveGain.gain.value = 0;
    cave.connect(cf).connect(this.caveGain).connect(this.ambBus);

    // Música dinámica: pad en re menor con filtro que se abre con la tensión
    this.padFilter = ctx.createBiquadFilter();
    this.padFilter.type = 'lowpass';
    this.padFilter.frequency.value = 500;
    this.padFilter.Q.value = 2;
    this.padGain = ctx.createGain();
    this.padGain.gain.value = 0.0;
    this.padFilter.connect(this.padGain).connect(this.musicBus);
    for (const f of [73.42, 87.31, 110.0, 146.83]) {
      for (const det of [-6, 6]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        o.detune.value = det;
        const g = ctx.createGain();
        g.gain.value = 0.05;
        o.connect(g).connect(this.padFilter);
        o.start();
      }
    }
    // Pulso tipo latido (sube con la tensión)
    this.pulseGain = ctx.createGain();
    this.pulseGain.gain.value = 0;
    this.pulseGain.connect(this.musicBus);
    const pulse = ctx.createOscillator();
    pulse.type = 'sine';
    pulse.frequency.value = 48;
    const pulseEnv = ctx.createGain();
    pulseEnv.gain.value = 0;
    pulse.connect(pulseEnv).connect(this.pulseGain);
    pulse.start();
    const beat = ctx.createOscillator();
    beat.frequency.value = 1.1;
    const beatAmt = ctx.createGain();
    beatAmt.gain.value = 0.5;
    beat.connect(beatAmt).connect(pulseEnv.gain);
    beat.start();
  }

  private bus() {
    const g = this.ctx!.createGain();
    g.connect(this.master);
    return g;
  }

  applyVolumes() {
    if (!this.ctx) return;
    this.master.gain.value = this.volumes.master;
    this.musicBus.gain.value = this.volumes.music;
    this.sfxBus.gain.value = this.volumes.sfx;
    this.ambBus.gain.value = this.volumes.ambient;
  }

  private noise(brown: boolean) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    if (brown) src.buffer = this.noiseBuf;
    else {
      const len = ctx.sampleRate;
      const b = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      src.buffer = b;
    }
    src.loop = true;
    src.start();
    return src;
  }

  private ramp(p: AudioParam, v: number, t = 1.5) {
    if (!this.ctx) return;
    p.setTargetAtTime(v, this.ctx.currentTime, t / 3);
  }

  /** Actualización continua del ambiente y la música. */
  update(state: { night: number; weather: string; inCave: boolean; tension: number; dt: number }) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const raining = state.weather === 'rain' || state.weather === 'storm';
    this.ramp(this.windGain.gain, state.inCave ? 0.03 : state.weather === 'storm' ? 0.55 : 0.22 + state.night * 0.1);
    this.ramp(this.rainGain.gain, state.inCave ? 0 : raining ? (state.weather === 'storm' ? 0.18 : 0.1) : 0);
    this.ramp(this.cricketGain.gain, !state.inCave && state.night > 0.6 && !raining ? 0.12 : 0);
    this.ramp(this.caveGain.gain, state.inCave ? 0.5 : 0);
    const tension = Math.min(1, state.tension + (state.inCave ? 0.4 : 0));
    this.ramp(this.padGain.gain, 0.05 + tension * 0.1 + state.night * 0.04, 3);
    this.ramp(this.padFilter.frequency, 280 + tension * 1400, 3);
    this.ramp(this.pulseGain.gain, tension > 0.55 ? (tension - 0.55) * 0.9 : 0, 2);

    if (state.night > 0.6 && !raining && !state.inCave && now > this.nextCricket) {
      this.nextCricket = now + 0.25 + Math.random() * 0.6;
      this.chirp();
    }
    if (state.inCave && now > this.nextDrip) {
      this.nextDrip = now + 0.8 + Math.random() * 3;
      this.tone(1400 + Math.random() * 900, 0.12, 0.08, 'sine', this.sfxBus, 0.25);
    }
    if (tension > 0.35 && now > this.nextTension) {
      this.nextTension = now + 5 + Math.random() * 8;
      const notes = [293.66, 349.23, 415.3, 440, 587.33];
      this.tone(notes[Math.floor(Math.random() * notes.length)], 0.02, 3.5, 'sine', this.musicBus, 0.08);
    }
  }

  private chirp() {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = 4200 + Math.random() * 400;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t + i * 0.06);
      g.gain.linearRampToValueAtTime(0.25, t + i * 0.06 + 0.01);
      g.gain.linearRampToValueAtTime(0, t + i * 0.06 + 0.04);
      const pan = ctx.createStereoPanner();
      pan.pan.value = Math.random() * 2 - 1;
      o.connect(g).connect(pan).connect(this.cricketGain);
      o.start(t + i * 0.06);
      o.stop(t + i * 0.06 + 0.05);
    }
  }

  private tone(freq: number, attack: number, decay: number, type: OscillatorType, bus: AudioNode, vol = 0.3, delay = 0) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + attack + decay + 0.05);
  }

  private burst(dur: number, freq: number, q: number, vol: number, bus: AudioNode, type: BiquadFilterType = 'bandpass', delay = 0) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(bus);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  // ------------------------------------------------------------------ efectos puntuales
  footstep(run: boolean, surface: 'grass' | 'wood' | 'stone') {
    if (!this.ready) return;
    const f = surface === 'wood' ? 420 : surface === 'stone' ? 900 : 650;
    this.burst(run ? 0.09 : 0.07, f, surface === 'grass' ? 0.6 : 1.4, run ? 0.35 : 0.22, this.sfxBus);
  }

  click() {
    if (this.ready) this.tone(880, 0.005, 0.06, 'triangle', this.sfxBus, 0.08);
  }

  clue() {
    if (!this.ready) return;
    [659.25, 987.77, 1318.5, 1975.5].forEach((f, i) => this.tone(f, 0.01, 2.2 - i * 0.3, 'sine', this.sfxBus, 0.12, i * 0.09));
  }

  success() {
    if (!this.ready) return;
    [293.66, 369.99, 440, 587.33, 739.99].forEach((f, i) => this.tone(f, 0.02, 2.5, 'triangle', this.sfxBus, 0.1, i * 0.14));
  }

  fail() {
    if (!this.ready) return;
    this.tone(110, 0.01, 0.4, 'square', this.sfxBus, 0.08);
    this.burst(0.25, 200, 1, 0.3, this.sfxBus);
  }

  creak() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(90, t);
    o.frequency.linearRampToValueAtTime(140, t + 0.4);
    o.frequency.linearRampToValueAtTime(70, t + 1.1);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 700;
    f.Q.value = 6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.18, t + 0.1);
    g.gain.linearRampToValueAtTime(0, t + 1.2);
    o.connect(f).connect(g).connect(this.sfxBus);
    o.start(t);
    o.stop(t + 1.3);
  }

  /** Campana lejana (parciales inarmónicos). */
  bell(distance = 1) {
    if (!this.ready) return;
    const base = 196;
    const vol = 0.14 / Math.max(1, distance);
    for (const [ratio, dec] of [[0.5, 6], [1, 5], [1.19, 4], [1.5, 3.5], [2, 3], [2.74, 2.2], [3.76, 1.5]] as [number, number][]) {
      this.tone(base * ratio, 0.005, dec, 'sine', this.musicBus, vol * (ratio < 1.6 ? 1 : 0.5));
    }
  }

  thunder(delay: number, strength: number) {
    if (!this.ready) return;
    this.burst(2.5 + strength * 2, 80, 0.5, 0.8 * strength, this.ambBus, 'lowpass', delay);
    this.burst(0.4, 400, 0.5, 0.4 * strength, this.ambBus, 'lowpass', delay);
  }

  whisper() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    const len = ctx.sampleRate * 2;
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    src.buffer = b;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 8;
    f.frequency.setValueAtTime(900, t);
    for (let i = 1; i < 8; i++) f.frequency.linearRampToValueAtTime(700 + Math.random() * 1600, t + i * 0.2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.25, t + 0.3);
    g.gain.linearRampToValueAtTime(0, t + 1.6);
    const pan = ctx.createStereoPanner();
    pan.pan.setValueAtTime(-1, t);
    pan.pan.linearRampToValueAtTime(1, t + 1.6);
    src.connect(f).connect(g).connect(pan).connect(this.sfxBus);
    src.start(t);
    src.stop(t + 1.7);
  }
}
