import { gainToDb } from '../../shared/math';

/**
 * Medidor de nivel con caída (decay) estilo hardware.
 * Lo consulta la UI desde requestAnimationFrame; no genera tráfico de mensajes.
 */
export class LevelMeter {
  readonly input: AnalyserNode;
  private readonly buf: Float32Array<ArrayBuffer>;
  private held = -90;
  private lastRead = 0;

  constructor(private readonly ctx: AudioContext) {
    this.input = new AnalyserNode(ctx, { fftSize: 1024, smoothingTimeConstant: 0 });
    this.buf = new Float32Array(this.input.fftSize);
  }

  /** Nivel de pico en dBFS con caída de ~20 dB/s. */
  readDb(): number {
    this.input.getFloatTimeDomainData(this.buf);
    let peak = 0;
    for (let i = 0; i < this.buf.length; i++) {
      const a = Math.abs(this.buf[i]);
      if (a > peak) peak = a;
    }
    const db = Math.max(-90, gainToDb(peak));
    const now = this.ctx.currentTime;
    const dt = Math.max(0, now - this.lastRead);
    this.lastRead = now;
    this.held = Math.max(db, this.held - 20 * dt);
    return this.held;
  }
}
