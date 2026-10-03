import { DeckPlayer } from './DeckPlayer';
import type { TrackInfo } from './types';

export type DeckId = 'A' | 'B';

export interface DeckState {
  id: DeckId;
  track: TrackInfo | null;
  loading: boolean;
  error: string | null;
  playing: boolean;
  cuePoint: number; // segundos
  /** Desviación de tempo del fader de pitch, p. ej. 0.04 = +4 % */
  pitch: number;
  pitchRange: number; // 0.08 | 0.16 | 0.5
  /** Pitch bend temporal (nudge) */
  bend: number;
}

/**
 * Lógica de transporte de un deck (CUE estilo reproductor de club, PLAY,
 * pitch y pitch bend). Independiente de React: la UI sólo llama métodos y
 * se suscribe a cambios.
 */
export class Deck {
  readonly player: DeckPlayer;
  private state: DeckState;
  private listeners = new Set<() => void>();
  private cueHeld = false;
  private playPressedDuringCue = false;
  private loadToken = 0;

  constructor(
    readonly id: DeckId,
    private readonly ctx: AudioContext,
  ) {
    this.player = new DeckPlayer(ctx);
    this.state = {
      id,
      track: null,
      loading: false,
      error: null,
      playing: false,
      cuePoint: 0,
      pitch: 0,
      pitchRange: 0.08,
      bend: 0,
    };
    this.player.on((e) => {
      if (e === 'ended') this.cueHeld = false;
      this.patch({ playing: this.player.isPlaying });
    });
  }

  getState(): DeckState {
    return this.state;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private patch(p: Partial<DeckState>): void {
    let changed = false;
    for (const k in p) {
      if ((p as Record<string, unknown>)[k] !== (this.state as unknown as Record<string, unknown>)[k]) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    this.state = { ...this.state, ...p };
    this.listeners.forEach((fn) => fn());
  }

  // ---------- Carga ----------

  async loadFile(file: File, info: TrackInfo): Promise<void> {
    const token = ++this.loadToken;
    this.patch({ loading: true, error: null });
    try {
      const data = await file.arrayBuffer();
      // decodeAudioData decodifica fuera del hilo principal y re-muestrea
      // a la frecuencia del AudioContext.
      const buffer = await this.ctx.decodeAudioData(data);
      if (token !== this.loadToken) return; // se cargó otra pista mientras tanto
      this.player.pause();
      this.player.load(buffer);
      this.cueHeld = false;
      this.patch({
        loading: false,
        track: { ...info, duration: buffer.duration },
        cuePoint: 0,
        playing: false,
      });
    } catch (err) {
      if (token !== this.loadToken) return;
      console.error(err);
      this.patch({
        loading: false,
        error:
          'No se pudo decodificar el archivo. Puede que el formato no sea compatible con este navegador o que esté protegido (DRM).',
      });
    }
  }

  eject(): void {
    if (this.state.playing) return; // como en hardware: no se expulsa en reproducción
    this.player.unload();
    this.patch({ track: null, cuePoint: 0, playing: false, error: null });
  }

  // ---------- Transporte ----------

  playPause(): void {
    if (!this.state.track) return;
    if (this.cueHeld) {
      // PLAY mientras se mantiene CUE: al soltar CUE sigue sonando.
      this.playPressedDuringCue = true;
      return;
    }
    if (this.player.isPlaying) this.player.pause();
    else this.player.play();
  }

  /** CUE presionado. */
  cueDown(): void {
    if (!this.state.track) return;
    const pos = this.player.position();
    if (this.player.isPlaying) {
      // En reproducción: vuelve al punto CUE y se detiene.
      this.player.pause();
      this.player.seek(this.state.cuePoint);
      return;
    }
    if (Math.abs(pos - this.state.cuePoint) > 0.01) {
      // En pausa fuera del CUE: fija un nuevo punto CUE aquí.
      this.patch({ cuePoint: pos });
      return;
    }
    // En pausa sobre el CUE: previsualiza mientras se mantenga.
    this.cueHeld = true;
    this.playPressedDuringCue = false;
    this.player.play();
  }

  /** CUE soltado. */
  cueUp(): void {
    if (!this.cueHeld) return;
    this.cueHeld = false;
    if (this.playPressedDuringCue) {
      this.playPressedDuringCue = false;
      return;
    }
    this.player.pause();
    this.player.seek(this.state.cuePoint);
  }

  seek(seconds: number): void {
    if (!this.state.track) return;
    this.player.seek(seconds);
  }

  // ---------- Tempo ----------

  setPitch(pitch: number): void {
    const r = this.state.pitchRange;
    this.patch({ pitch: Math.max(-r, Math.min(r, pitch)) });
    this.applyRate();
  }

  setPitchRange(range: number): void {
    this.patch({ pitchRange: range });
    this.setPitch(this.state.pitch);
  }

  /** Pitch bend temporal; 0 lo libera. */
  setBend(bend: number): void {
    this.patch({ bend });
    this.applyRate();
  }

  /** Velocidad de reproducción efectiva (1 = original). */
  get rate(): number {
    return (1 + this.state.pitch) * (1 + this.state.bend);
  }

  private applyRate(): void {
    this.player.setRate(this.rate);
  }

  dispose(): void {
    this.player.dispose();
    this.listeners.clear();
  }
}
