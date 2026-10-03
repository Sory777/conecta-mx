import { dbToGain } from '../../shared/math';
import {
  channelFaderToGain,
  eqKnobToDb,
  filterKnobToFreqs,
  trimKnobToDb,
} from './curves';
import { LevelMeter } from './LevelMeter';

export type XfAssign = 'A' | 'THRU' | 'B';

/** Constante de tiempo del suavizado de parámetros (anti zipper-noise). */
const SMOOTH = 0.012;

/**
 * Canal del mixer:
 *
 *   in → GAIN → EQ LOW → EQ MID → EQ HIGH → HPF → LPF ─┬→ FADER → XFADER → out (bus master)
 *                                                      ├→ CUE (PFL) → cueOut (bus de auriculares)
 *                                                      └→ medidor pre-fader
 */
export class ChannelStrip {
  readonly input: GainNode;
  readonly output: GainNode; // post crossfader → bus master
  readonly cueOut: GainNode; // pre-fader → bus de cue
  readonly meter: LevelMeter;

  private readonly trim: GainNode;
  private readonly low: BiquadFilterNode;
  private readonly mid: BiquadFilterNode;
  private readonly high: BiquadFilterNode;
  private readonly hpf: BiquadFilterNode;
  private readonly lpf: BiquadFilterNode;
  private readonly fader: GainNode;

  constructor(private readonly ctx: AudioContext) {
    this.input = ctx.createGain();
    this.trim = ctx.createGain();

    this.low = new BiquadFilterNode(ctx, { type: 'lowshelf', frequency: 220 });
    this.mid = new BiquadFilterNode(ctx, { type: 'peaking', frequency: 1100, Q: 0.7 });
    this.high = new BiquadFilterNode(ctx, { type: 'highshelf', frequency: 4200 });
    this.hpf = new BiquadFilterNode(ctx, { type: 'highpass', frequency: 10, Q: 1.1 });
    this.lpf = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 22000, Q: 1.1 });

    this.fader = ctx.createGain();
    this.output = ctx.createGain();
    this.cueOut = new GainNode(ctx, { gain: 0 });
    this.meter = new LevelMeter(ctx);

    this.input
      .connect(this.trim)
      .connect(this.low)
      .connect(this.mid)
      .connect(this.high)
      .connect(this.hpf)
      .connect(this.lpf);
    this.lpf.connect(this.fader).connect(this.output);
    this.lpf.connect(this.cueOut);
    this.lpf.connect(this.meter.input);
  }

  private set(param: AudioParam, value: number): void {
    param.setTargetAtTime(value, this.ctx.currentTime, SMOOTH);
  }

  setTrim(v: number): void {
    this.set(this.trim.gain, dbToGain(trimKnobToDb(v)));
  }

  setEq(band: 'low' | 'mid' | 'high', v: number): void {
    this.set(this[band].gain, eqKnobToDb(v));
  }

  setFilter(v: number): void {
    const f = filterKnobToFreqs(v);
    this.set(this.lpf.frequency, f.lowpassHz);
    this.set(this.hpf.frequency, f.highpassHz);
  }

  setFader(v: number): void {
    this.set(this.fader.gain, channelFaderToGain(v));
  }

  /** Ganancia del crossfader ya calculada por el Mixer. */
  setXfaderGain(g: number): void {
    this.set(this.output.gain, g);
  }

  setCue(on: boolean): void {
    this.set(this.cueOut.gain, on ? 1 : 0);
  }
}
