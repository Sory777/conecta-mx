import workletUrl from '../worklets/deck-player.worklet.ts?worker&url';
import { Deck, type DeckId } from '../deck/Deck';
import { Mixer } from '../mixer/Mixer';

/**
 * Punto de entrada del motor de audio. Un único AudioContext para toda la app:
 * todos los decks, el mixer y (en fases siguientes) FX, sampler y grabador
 * comparten el mismo reloj de audio, lo que permite sincronía exacta.
 */
export class AudioEngine {
  readonly decks: Record<DeckId, Deck>;

  private constructor(
    readonly ctx: AudioContext,
    readonly mixer: Mixer,
  ) {
    this.decks = { A: new Deck('A', ctx), B: new Deck('B', ctx) };
    this.decks.A.player.node.connect(mixer.channels[0].input);
    this.decks.B.player.node.connect(mixer.channels[1].input);
  }

  /**
   * Debe llamarse desde un gesto del usuario (tap/clic): iOS y Chrome
   * bloquean el audio hasta entonces.
   */
  static async create(): Promise<AudioEngine> {
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    await ctx.audioWorklet.addModule(workletUrl);
    if (ctx.state !== 'running') await ctx.resume();
    return new AudioEngine(ctx, new Mixer(ctx, 2));
  }

  /** Latencia de salida estimada en ms (si el navegador la expone). */
  get outputLatencyMs(): number {
    const base = this.ctx.baseLatency ?? 0;
    const out = (this.ctx as AudioContext & { outputLatency?: number }).outputLatency ?? 0;
    return (base + out) * 1000;
  }

  async resume(): Promise<void> {
    if (this.ctx.state !== 'running') await this.ctx.resume();
  }
}
