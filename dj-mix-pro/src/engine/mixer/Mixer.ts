import { ChannelStrip, type XfAssign } from './ChannelStrip';
import { crossfaderGains, masterKnobToGain, type CrossfaderCurve } from './curves';
import { LevelMeter } from './LevelMeter';

/**
 * Salida de audio:
 *  - 'stereo': master en L/R (uso normal, una sola salida).
 *  - 'split' : cable divisor; master mono a la DERECHA y auriculares (cue) mono a la IZQUIERDA.
 *  - 'quad'  : interfaz de 4 canales (p. ej. controladora con tarjeta de sonido);
 *              master en 1-2 y auriculares en 3-4. Sólo si el dispositivo lo expone.
 */
export type OutputMode = 'stereo' | 'split' | 'quad';

const SMOOTH = 0.012;

export class Mixer {
  readonly channels: ChannelStrip[];
  readonly masterMeter: LevelMeter;
  readonly cueMeter: LevelMeter;
  /** Punto de toma del master final (lo usará el grabador en la FASE 5). */
  readonly masterTap: GainNode;

  private readonly masterBus: GainNode;
  private readonly masterGain: GainNode;
  private readonly limiter: DynamicsCompressorNode;
  private readonly cueBus: GainNode;
  /** Mezcla de auriculares: cue y master. */
  private readonly phonesCue: GainNode;
  private readonly phonesMaster: GainNode;
  private readonly phonesSum: GainNode;
  private readonly phonesLevel: GainNode;

  private routed: AudioNode[] = [];
  private xfPos = 0;
  private xfCurve: CrossfaderCurve = 'smooth';
  private assigns: XfAssign[];
  private mode: OutputMode = 'stereo';

  constructor(private readonly ctx: AudioContext, channelCount: number) {
    this.channels = Array.from({ length: channelCount }, () => new ChannelStrip(ctx));
    this.assigns = this.channels.map((_, i) => (i % 2 === 0 ? 'A' : 'B'));

    this.masterBus = ctx.createGain();
    this.masterGain = ctx.createGain();
    // Limitador de seguridad: evita clipping digital si el DJ satura el master.
    this.limiter = new DynamicsCompressorNode(ctx, {
      threshold: -1,
      knee: 0,
      ratio: 20,
      attack: 0.002,
      release: 0.12,
    });
    this.masterTap = ctx.createGain();
    this.masterMeter = new LevelMeter(ctx);

    this.cueBus = ctx.createGain();
    this.cueMeter = new LevelMeter(ctx);
    this.phonesCue = ctx.createGain();
    this.phonesMaster = ctx.createGain();
    this.phonesSum = ctx.createGain();
    this.phonesLevel = ctx.createGain();

    for (const ch of this.channels) {
      ch.output.connect(this.masterBus);
      ch.cueOut.connect(this.cueBus);
    }
    this.masterBus.connect(this.masterGain).connect(this.limiter).connect(this.masterTap);
    this.masterTap.connect(this.masterMeter.input);
    this.cueBus.connect(this.cueMeter.input);

    this.cueBus.connect(this.phonesCue).connect(this.phonesSum);
    this.masterTap.connect(this.phonesMaster).connect(this.phonesSum);
    this.phonesSum.connect(this.phonesLevel);

    this.setMasterVolume(0.8);
    this.setPhonesMix(0);
    this.setPhonesLevel(0.8);
    this.applyCrossfader();
    this.route();
  }

  // ---------- Crossfader ----------

  setCrossfader(x: number): void {
    this.xfPos = x;
    this.applyCrossfader();
  }

  setCrossfaderCurve(curve: CrossfaderCurve): void {
    this.xfCurve = curve;
    this.applyCrossfader();
  }

  setAssign(channel: number, assign: XfAssign): void {
    this.assigns[channel] = assign;
    this.applyCrossfader();
  }

  private applyCrossfader(): void {
    const [a, b] = crossfaderGains(this.xfPos, this.xfCurve);
    this.channels.forEach((ch, i) => {
      const asg = this.assigns[i];
      ch.setXfaderGain(asg === 'A' ? a : asg === 'B' ? b : 1);
    });
  }

  // ---------- Master y auriculares ----------

  setMasterVolume(v: number): void {
    this.masterGain.gain.setTargetAtTime(masterKnobToGain(v), this.ctx.currentTime, SMOOTH);
  }

  /** 0 = sólo CUE, 1 = sólo MASTER en auriculares. */
  setPhonesMix(v: number): void {
    const t = this.ctx.currentTime;
    this.phonesCue.gain.setTargetAtTime(Math.cos((v * Math.PI) / 2), t, SMOOTH);
    this.phonesMaster.gain.setTargetAtTime(Math.sin((v * Math.PI) / 2), t, SMOOTH);
  }

  setPhonesLevel(v: number): void {
    this.phonesLevel.gain.setTargetAtTime(masterKnobToGain(v), this.ctx.currentTime, SMOOTH);
  }

  // ---------- Enrutado de salida ----------

  /** Modos disponibles según el hardware actual. */
  availableOutputModes(): OutputMode[] {
    const modes: OutputMode[] = ['stereo', 'split'];
    if (this.ctx.destination.maxChannelCount >= 4) modes.push('quad');
    return modes;
  }

  get outputMode(): OutputMode {
    return this.mode;
  }

  setOutputMode(mode: OutputMode): void {
    if (!this.availableOutputModes().includes(mode)) mode = 'stereo';
    this.mode = mode;
    this.route();
  }

  private route(): void {
    // Desconecta el enrutado anterior.
    this.masterTap.disconnect();
    this.masterTap.connect(this.masterMeter.input);
    this.masterTap.connect(this.phonesMaster);
    this.phonesLevel.disconnect();
    this.routed.forEach((n) => n.disconnect());
    this.routed = [];

    const dest = this.ctx.destination;

    if (this.mode === 'stereo') {
      dest.channelCount = 2;
      dest.channelInterpretation = 'speakers';
      this.masterTap.connect(dest);
      return;
    }

    if (this.mode === 'split') {
      dest.channelCount = 2;
      dest.channelInterpretation = 'discrete';
      // Suma a mono con downmix de 'speakers' ((L+R)/2).
      const masterMono = new GainNode(this.ctx, {
        channelCount: 1,
        channelCountMode: 'explicit',
        channelInterpretation: 'speakers',
      });
      const phonesMono = new GainNode(this.ctx, {
        channelCount: 1,
        channelCountMode: 'explicit',
        channelInterpretation: 'speakers',
      });
      const merger = new ChannelMergerNode(this.ctx, { numberOfInputs: 2 });
      this.masterTap.connect(masterMono).connect(merger, 0, 1); // derecha = master
      this.phonesLevel.connect(phonesMono).connect(merger, 0, 0); // izquierda = auriculares
      merger.connect(dest);
      this.routed = [masterMono, phonesMono, merger];
      return;
    }

    // quad
    dest.channelCount = 4;
    dest.channelInterpretation = 'discrete';
    const mSplit = new ChannelSplitterNode(this.ctx, { numberOfOutputs: 2 });
    const pSplit = new ChannelSplitterNode(this.ctx, { numberOfOutputs: 2 });
    const merger = new ChannelMergerNode(this.ctx, { numberOfInputs: 4 });
    this.masterTap.connect(mSplit);
    this.phonesLevel.connect(pSplit);
    mSplit.connect(merger, 0, 0);
    mSplit.connect(merger, 1, 1);
    pSplit.connect(merger, 0, 2);
    pSplit.connect(merger, 1, 3);
    merger.connect(dest);
    this.routed = [mSplit, pSplit, merger];
  }
}
