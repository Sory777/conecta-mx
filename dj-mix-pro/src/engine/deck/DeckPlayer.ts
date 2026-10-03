/**
 * Envoltorio del hilo principal para el worklet 'deck-player'.
 * Mantiene una copia del último estado reportado por el hilo de audio y
 * extrapola la posición para que la UI (60 fps) sea fluida sin pedir
 * mensajes en cada frame.
 */
export interface PlayerSnapshot {
  frame: number;
  playing: boolean;
  rate: number;
  /** AudioContext.currentTime en el que se midió `frame`. */
  time: number;
}

type OutMsg =
  | ({ type: 'pos' } & PlayerSnapshot)
  | { type: 'ended' };

export class DeckPlayer {
  readonly node: AudioWorkletNode;
  private snap: PlayerSnapshot = { frame: 0, playing: false, rate: 1, time: 0 };
  private lengthFrames = 0;
  private listeners = new Set<(e: 'ended' | 'state') => void>();

  constructor(private readonly ctx: AudioContext) {
    this.node = new AudioWorkletNode(ctx, 'deck-player', {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    });
    this.node.port.onmessage = (e: MessageEvent<OutMsg>) => {
      const msg = e.data;
      if (msg.type === 'pos') {
        const changed = msg.playing !== this.snap.playing;
        this.snap = { frame: msg.frame, playing: msg.playing, rate: msg.rate, time: msg.time };
        if (changed) this.emit('state');
      } else if (msg.type === 'ended') {
        this.emit('ended');
      }
    };
  }

  get sampleRate(): number {
    return this.ctx.sampleRate;
  }

  get duration(): number {
    return this.lengthFrames / this.ctx.sampleRate;
  }

  get isPlaying(): boolean {
    return this.snap.playing;
  }

  on(fn: (e: 'ended' | 'state') => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(e: 'ended' | 'state'): void {
    this.listeners.forEach((fn) => fn(e));
  }

  /**
   * Transfiere (sin copiar de nuevo) las muestras al hilo de audio.
   * El AudioBuffer original puede liberarse después.
   */
  load(buffer: AudioBuffer): void {
    const channels: Float32Array[] = [];
    const count = Math.min(2, buffer.numberOfChannels);
    for (let c = 0; c < count; c++) channels.push(buffer.getChannelData(c).slice());
    this.lengthFrames = buffer.length;
    this.snap = { frame: 0, playing: false, rate: this.snap.rate, time: this.ctx.currentTime };
    this.node.port.postMessage(
      { type: 'load', channels },
      channels.map((c) => c.buffer as ArrayBuffer),
    );
    this.emit('state');
  }

  unload(): void {
    this.lengthFrames = 0;
    this.snap = { ...this.snap, frame: 0, playing: false };
    this.node.port.postMessage({ type: 'unload' });
    this.emit('state');
  }

  play(): void {
    if (this.lengthFrames === 0) return;
    // Optimista: la UI responde al instante; el worklet confirmará.
    this.snap = { ...this.snap, playing: true, time: this.ctx.currentTime };
    this.node.port.postMessage({ type: 'play' });
    this.emit('state');
  }

  pause(): void {
    this.snap = { ...this.snap, frame: this.positionFrames(), playing: false, time: this.ctx.currentTime };
    this.node.port.postMessage({ type: 'pause' });
    this.emit('state');
  }

  seek(seconds: number): void {
    const frame = Math.max(0, Math.min(seconds * this.ctx.sampleRate, this.lengthFrames - 1));
    this.snap = { ...this.snap, frame, time: this.ctx.currentTime };
    this.node.port.postMessage({ type: 'seek', frame });
  }

  setRate(rate: number): void {
    this.node.port.postMessage({ type: 'rate', rate });
  }

  /** Posición extrapolada en frames. */
  positionFrames(): number {
    const s = this.snap;
    if (!s.playing) return s.frame;
    const elapsed = Math.max(0, this.ctx.currentTime - s.time);
    const f = s.frame + elapsed * this.ctx.sampleRate * s.rate;
    return Math.min(f, this.lengthFrames);
  }

  position(): number {
    return this.positionFrames() / this.ctx.sampleRate;
  }

  dispose(): void {
    this.node.port.onmessage = null;
    this.node.disconnect();
    this.listeners.clear();
  }
}
