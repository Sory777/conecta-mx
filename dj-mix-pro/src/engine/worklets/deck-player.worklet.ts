/**
 * Procesador de reproducción de un deck. Se ejecuta en el hilo de audio
 * (AudioWorkletGlobalScope), nunca en el hilo de la UI.
 *
 * Por qué un worklet propio en lugar de AudioBufferSourceNode:
 *  - La posición de lectura vive aquí y es exacta a nivel de muestra.
 *  - Seek, cambio de velocidad y (en fases siguientes) loops, beat-jump,
 *    scratch y time-stretch se aplican sin recrear nodos ni cortes.
 *
 * Este archivo debe ser autocontenido (sin imports): se carga con
 * audioWorklet.addModule().
 */

// --- Tipos mínimos del ámbito del worklet (no están en lib.dom) ---
declare const sampleRate: number;
declare const currentTime: number;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  constructor();
}
declare function registerProcessor(
  name: string,
  ctor: new () => AudioWorkletProcessor,
): void;

type InMsg =
  | { type: 'load'; channels: Float32Array[] }
  | { type: 'unload' }
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'seek'; frame: number }
  | { type: 'rate'; rate: number };

/** Muestras de rampa para play/pause/seek sin clics (~3 ms a 44.1 kHz). */
const FADE_FRAMES = 128;
/** Cada cuántos bloques de 128 muestras se informa la posición (~12 ms). */
const REPORT_EVERY_BLOCKS = 4;

class DeckPlayerProcessor extends AudioWorkletProcessor {
  private left: Float32Array | null = null;
  private right: Float32Array | null = null;
  private length = 0;

  private pos = 0; // posición fraccional en frames
  private rate = 1;
  private targetRate = 1;

  private playing = false; // intención del usuario
  private gain = 0; // envolvente anti-clic 0..1
  private pendingSeek: number | null = null;

  private blockCounter = 0;

  constructor() {
    super();
    this.port.onmessage = (e: MessageEvent<InMsg>) => this.onMessage(e.data);
  }

  private onMessage(msg: InMsg): void {
    switch (msg.type) {
      case 'load': {
        this.left = msg.channels[0] ?? null;
        this.right = msg.channels[1] ?? msg.channels[0] ?? null;
        this.length = this.left ? this.left.length : 0;
        this.pos = 0;
        this.playing = false;
        this.gain = 0;
        this.pendingSeek = null;
        this.report(true);
        break;
      }
      case 'unload':
        this.left = this.right = null;
        this.length = 0;
        this.pos = 0;
        this.playing = false;
        this.gain = 0;
        this.report(true);
        break;
      case 'play':
        if (this.length > 0) {
          if (this.pos >= this.length - 1) this.pos = 0;
          this.playing = true;
        }
        this.report(true);
        break;
      case 'pause':
        this.playing = false;
        this.report(true);
        break;
      case 'seek': {
        const f = Math.max(0, Math.min(msg.frame, Math.max(0, this.length - 1)));
        if (this.gain > 0) this.pendingSeek = f; // fundido de salida, salto, fundido de entrada
        else this.pos = f;
        this.report(true);
        break;
      }
      case 'rate':
        this.targetRate = msg.rate;
        break;
    }
  }

  private report(force = false): void {
    if (!force && ++this.blockCounter < REPORT_EVERY_BLOCKS) return;
    this.blockCounter = 0;
    this.port.postMessage({
      type: 'pos',
      frame: this.pendingSeek ?? this.pos,
      playing: this.playing,
      rate: this.rate,
      time: currentTime,
    });
  }

  /** Interpolación cúbica de Hermite (4 puntos): buena calidad a cualquier velocidad. */
  private static hermite(buf: Float32Array, len: number, p: number): number {
    const i = Math.floor(p);
    const t = p - i;
    const xm1 = buf[i > 0 ? i - 1 : 0];
    const x0 = buf[i];
    const x1 = buf[i + 1 < len ? i + 1 : len - 1];
    const x2 = buf[i + 2 < len ? i + 2 : len - 1];
    const c1 = 0.5 * (x1 - xm1);
    const c2 = xm1 - 2.5 * x0 + 2 * x1 - 0.5 * x2;
    const c3 = 0.5 * (x2 - xm1) + 1.5 * (x0 - x1);
    return ((c3 * t + c2) * t + c1) * t + x0;
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const out = outputs[0];
    const outL = out[0];
    const outR = out[1] ?? out[0];
    const n = outL.length;
    const L = this.left;
    const R = this.right;

    if (!L || !R || this.length === 0) {
      outL.fill(0);
      if (outR !== outL) outR.fill(0);
      return true;
    }

    const len = this.length;
    const fadeStep = 1 / FADE_FRAMES;
    // Suavizado de velocidad por bloque (evita "zipper" al mover el pitch).
    const rateStep = (this.targetRate - this.rate) / n;
    let ended = false;

    for (let i = 0; i < n; i++) {
      const wantSound = this.playing && this.pendingSeek === null;
      if (wantSound) {
        if (this.gain < 1) this.gain = Math.min(1, this.gain + fadeStep);
      } else if (this.gain > 0) {
        this.gain = Math.max(0, this.gain - fadeStep);
      }
      if (this.gain === 0 && this.pendingSeek !== null) {
        this.pos = this.pendingSeek;
        this.pendingSeek = null;
      }

      this.rate += rateStep;

      if (this.gain > 0 && this.pos < len - 1) {
        const p = this.pos;
        outL[i] = DeckPlayerProcessor.hermite(L, len, p) * this.gain;
        if (outR !== outL) outR[i] = DeckPlayerProcessor.hermite(R, len, p) * this.gain;
        this.pos += this.rate;
        if (this.pos < 0) this.pos = 0;
      } else {
        outL[i] = 0;
        if (outR !== outL) outR[i] = 0;
      }

      if (this.playing && this.pos >= len - 1) {
        this.pos = len - 1;
        this.playing = false;
        ended = true;
      }
    }
    this.rate = this.targetRate;

    if (ended) {
      this.report(true);
      this.port.postMessage({ type: 'ended' });
    } else {
      this.report();
    }
    return true;
  }
}

registerProcessor('deck-player', DeckPlayerProcessor);
