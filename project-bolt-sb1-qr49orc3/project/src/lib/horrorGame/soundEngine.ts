type AudioCtx = AudioContext;

function now(ctx: AudioCtx) {
  return ctx.currentTime;
}

export class HorrorSoundEngine {
  private ctx: AudioCtx | null = null;
  private master: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private ambientNodes: AudioNode[] = [];
  private heartbeatTimer: number | null = null;
  private muted = false;

  private ensureCtx(): AudioCtx {
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.85;
      this.master.connect(this.ctx.destination);
      this.noiseBuffer = this.makeNoiseBuffer(this.ctx);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  private makeNoiseBuffer(ctx: AudioCtx): AudioBuffer {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  private noiseSource(): AudioBufferSourceNode {
    const ctx = this.ensureCtx();
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    return src;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.85, now(this.ctx), 0.05);
    }
  }

  resume() {
    this.ensureCtx();
  }

  dispose() {
    this.stopAmbient();
    if (this.heartbeatTimer) window.clearInterval(this.heartbeatTimer);
    this.ctx?.close().catch(() => {});
    this.ctx = null;
  }

  startAmbient() {
    const ctx = this.ensureCtx();
    this.stopAmbient();
    const gain = ctx.createGain();
    gain.gain.value = 0.22;
    gain.connect(this.master!);
    this.ambientGain = gain;

    const drone1 = ctx.createOscillator();
    drone1.type = 'sine';
    drone1.frequency.value = 54;
    const drone2 = ctx.createOscillator();
    drone2.type = 'triangle';
    drone2.frequency.value = 57;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.5;
    drone1.connect(droneGain);
    drone2.connect(droneGain);
    droneGain.connect(gain);

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.15;
    lfo.connect(lfoGain);
    lfoGain.connect(droneGain.gain);

    const wind = this.noiseSource();
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 220;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.35;
    const windLfo = ctx.createOscillator();
    windLfo.frequency.value = 0.11;
    const windLfoGain = ctx.createGain();
    windLfoGain.gain.value = 90;
    windLfo.connect(windLfoGain);
    windLfoGain.connect(windFilter.frequency);
    wind.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(gain);

    drone1.start();
    drone2.start();
    lfo.start();
    wind.start();
    windLfo.start();

    this.ambientNodes = [drone1, drone2, lfo, wind, windLfo];
  }

  stopAmbient() {
    for (const node of this.ambientNodes) {
      try {
        (node as OscillatorNode | AudioBufferSourceNode).stop();
      } catch {
        /* already stopped */
      }
      node.disconnect();
    }
    this.ambientNodes = [];
    this.ambientGain?.disconnect();
    this.ambientGain = null;
  }

  playWhisper() {
    const ctx = this.ensureCtx();
    const t = now(ctx);
    const src = this.noiseSource();
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 900 + Math.random() * 600;
    band.Q.value = 4;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.16, t + 0.15);
    gain.gain.linearRampToValueAtTime(0, t + 1.1 + Math.random() * 0.5);
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 2 - 1;
    src.connect(band);
    band.connect(gain);
    gain.connect(pan);
    pan.connect(this.master!);
    src.start(t);
    src.stop(t + 1.8);
  }

  playFootstep(pan: number, volume: number) {
    const ctx = this.ensureCtx();
    const t = now(ctx);
    const src = this.noiseSource();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(Math.min(0.6, volume), t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    src.connect(filter);
    filter.connect(gain);
    gain.connect(panner);
    panner.connect(this.master!);
    src.start(t);
    src.stop(t + 0.2);
  }

  startHeartbeat(getBpmAndVolume: () => { bpm: number; volume: number }) {
    this.stopHeartbeat();
    const beat = () => {
      const { bpm, volume } = getBpmAndVolume();
      if (volume > 0.01) this.thump(volume);
      const interval = 60000 / Math.max(30, bpm);
      this.heartbeatTimer = window.setTimeout(beat, interval);
    };
    beat();
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      window.clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private thump(volume: number) {
    const ctx = this.ensureCtx();
    const t = now(ctx);
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.12);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    osc.connect(gain);
    gain.connect(this.master!);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  playKeyPickup() {
    const ctx = this.ensureCtx();
    const t = now(ctx);
    [660, 880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      const start = t + i * 0.08;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
      osc.connect(gain);
      gain.connect(this.master!);
      osc.start(start);
      osc.stop(start + 0.4);
    });
  }

  playDoorOpen() {
    const ctx = this.ensureCtx();
    const t = now(ctx);
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.linearRampToValueAtTime(70, t + 1.1);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.22, t + 0.3);
    gain.gain.linearRampToValueAtTime(0.001, t + 1.2);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master!);
    osc.start(t);
    osc.stop(t + 1.3);
  }

  playJumpscare(intensity: 'small' | 'big' = 'big') {
    const ctx = this.ensureCtx();
    const t = now(ctx);
    const big = intensity === 'big';

    const noise = this.noiseSource();
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(big ? 0.9 : 0.5, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + (big ? 0.6 : 0.3));
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 800;
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.master!);
    noise.start(t);
    noise.stop(t + (big ? 0.7 : 0.35));

    const shriek = ctx.createOscillator();
    shriek.type = 'sawtooth';
    shriek.frequency.setValueAtTime(big ? 1400 : 900, t);
    shriek.frequency.exponentialRampToValueAtTime(big ? 90 : 200, t + (big ? 0.55 : 0.3));
    const shriekGain = ctx.createGain();
    shriekGain.gain.setValueAtTime(big ? 0.5 : 0.28, t);
    shriekGain.gain.exponentialRampToValueAtTime(0.001, t + (big ? 0.6 : 0.32));
    shriek.connect(shriekGain);
    shriekGain.connect(this.master!);
    shriek.start(t);
    shriek.stop(t + (big ? 0.65 : 0.35));

    if (big) {
      const sub = ctx.createOscillator();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(120, t);
      sub.frequency.exponentialRampToValueAtTime(30, t + 0.4);
      const subGain = ctx.createGain();
      subGain.gain.setValueAtTime(0.6, t);
      subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      sub.connect(subGain);
      subGain.connect(this.master!);
      sub.start(t);
      sub.stop(t + 0.55);
    }
  }

  playWin() {
    const ctx = this.ensureCtx();
    const t = now(ctx);
    [523, 659, 784, 1046].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      const start = t + i * 0.14;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.22, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
      osc.connect(gain);
      gain.connect(this.master!);
      osc.start(start);
      osc.stop(start + 0.55);
    });
  }

  playGameOverDrone() {
    const ctx = this.ensureCtx();
    const t = now(ctx);
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 2.2);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.3, t + 0.3);
    gain.gain.linearRampToValueAtTime(0.001, t + 2.3);
    osc.connect(gain);
    gain.connect(this.master!);
    osc.start(t);
    osc.stop(t + 2.4);
  }
}

export const horrorSound = new HorrorSoundEngine();
