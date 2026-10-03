import { deckPlayerWorklet } from '../worklets/deck-player.worklet';
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
    await loadWorklet(ctx, `(${deckPlayerWorklet.toString()})();`);
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

/**
 * Carga código de worklet sin archivos externos. Blob URL funciona en http(s);
 * abierto como archivo local (file://, origen opaco) Chrome lo rechaza y se usa
 * una data: URL.
 */
async function loadWorklet(ctx: AudioContext, code: string): Promise<void> {
  const blobUrl = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
  try {
    await ctx.audioWorklet.addModule(blobUrl);
    return;
  } catch (err) {
    console.warn('Worklet por Blob URL rechazado, probando data: URL', err);
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(code)));
  await ctx.audioWorklet.addModule(`data:text/javascript;base64,${b64}`);
}
