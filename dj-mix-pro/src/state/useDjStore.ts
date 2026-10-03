import { create } from 'zustand';
import { AudioEngine } from '../engine/core/AudioEngine';
import type { DeckId, DeckState } from '../engine/deck/Deck';
import type { XfAssign } from '../engine/mixer/ChannelStrip';
import type { CrossfaderCurve } from '../engine/mixer/curves';
import type { OutputMode } from '../engine/mixer/Mixer';
import { readTrackInfo } from '../library/metadata/readTrackInfo';

/**
 * Estado de la UI. El motor de audio es la fuente de verdad del sonido;
 * este store refleja valores de controles y el estado "lento" de los decks.
 * Lo que cambia a 60 fps (posición, medidores) NO pasa por aquí: la UI lo lee
 * directamente del motor en requestAnimationFrame para no re-renderizar React.
 */
export interface ChannelControls {
  trim: number;
  high: number;
  mid: number;
  low: number;
  filter: number;
  fader: number;
  cue: boolean;
  assign: XfAssign;
}

export const CHANNEL_DEFAULTS: ChannelControls = {
  trim: 0.5,
  high: 0.5,
  mid: 0.5,
  low: 0.5,
  filter: 0,
  fader: 0.85,
  cue: false,
  assign: 'A',
};

type EngineStatus = 'idle' | 'starting' | 'ready' | 'error';

interface DjStore {
  engine: AudioEngine | null;
  status: EngineStatus;
  statusMessage: string | null;

  decks: Record<DeckId, DeckState | null>;
  channels: [ChannelControls, ChannelControls];
  crossfader: number;
  xfCurve: CrossfaderCurve;
  master: number;
  phonesMix: number;
  phonesLevel: number;
  outputMode: OutputMode;
  availableOutputModes: OutputMode[];

  startEngine: () => Promise<void>;
  loadTrack: (deck: DeckId, file: File) => Promise<void>;
  setChannel: <K extends keyof ChannelControls>(ch: 0 | 1, key: K, value: ChannelControls[K]) => void;
  setCrossfader: (x: number) => void;
  setXfCurve: (c: CrossfaderCurve) => void;
  setMaster: (v: number) => void;
  setPhonesMix: (v: number) => void;
  setPhonesLevel: (v: number) => void;
  setOutputMode: (m: OutputMode) => void;
}

const ACCEPTED = /\.(mp3|wav|wave|aac|m4a|mp4|ogg|oga|opus|flac|aif|aiff)$/i;

export function isProbablyAudio(file: File): boolean {
  return file.type.startsWith('audio/') || ACCEPTED.test(file.name);
}

export const useDjStore = create<DjStore>((set, get) => ({
  engine: null,
  status: 'idle',
  statusMessage: null,

  decks: { A: null, B: null },
  channels: [
    { ...CHANNEL_DEFAULTS, assign: 'A' },
    { ...CHANNEL_DEFAULTS, assign: 'B' },
  ],
  crossfader: 0,
  xfCurve: 'smooth',
  master: 0.8,
  phonesMix: 0,
  phonesLevel: 0.8,
  outputMode: 'stereo',
  availableOutputModes: ['stereo', 'split'],

  async startEngine() {
    if (get().status === 'starting' || get().status === 'ready') return;
    set({ status: 'starting', statusMessage: null });
    try {
      if (typeof AudioWorkletNode === 'undefined') {
        throw new Error('Este navegador no soporta AudioWorklet. Usa Chrome, Edge, Firefox o Safari recientes.');
      }
      const engine = await AudioEngine.create();
      const s = get();
      // Aplica el estado actual de los controles al motor recién creado.
      s.channels.forEach((c, i) => {
        const ch = engine.mixer.channels[i];
        ch.setTrim(c.trim);
        ch.setEq('high', c.high);
        ch.setEq('mid', c.mid);
        ch.setEq('low', c.low);
        ch.setFilter(c.filter);
        ch.setFader(c.fader);
        ch.setCue(c.cue);
        engine.mixer.setAssign(i, c.assign);
      });
      engine.mixer.setCrossfaderCurve(s.xfCurve);
      engine.mixer.setCrossfader(s.crossfader);
      engine.mixer.setMasterVolume(s.master);
      engine.mixer.setPhonesMix(s.phonesMix);
      engine.mixer.setPhonesLevel(s.phonesLevel);

      (['A', 'B'] as const).forEach((id) => {
        const deck = engine.decks[id];
        const sync = () => set((st) => ({ decks: { ...st.decks, [id]: deck.getState() } }));
        deck.subscribe(sync);
        sync();
      });

      // iOS/Safari pueden suspender el contexto (llamada entrante, bloqueo...).
      engine.ctx.onstatechange = () => {
        if (engine.ctx.state === 'running') set({ statusMessage: null });
        else set({ statusMessage: 'Audio en pausa por el sistema. Toca la pantalla para reanudar.' });
      };

      set({
        engine,
        status: 'ready',
        availableOutputModes: engine.mixer.availableOutputModes(),
      });
      if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug')) {
        (window as unknown as { __dj: AudioEngine }).__dj = engine;
      }
    } catch (err) {
      console.error(err);
      set({
        status: 'error',
        statusMessage: err instanceof Error ? err.message : 'No se pudo iniciar el motor de audio.',
      });
    }
  },

  async loadTrack(deckId, file) {
    const engine = get().engine;
    if (!engine) return;
    const deck = engine.decks[deckId];
    if (deck.getState().playing) {
      set({ statusMessage: `Deck ${deckId} está sonando: páusalo antes de cargar otra pista.` });
      return;
    }
    if (!isProbablyAudio(file)) {
      set({ statusMessage: `"${file.name}" no parece un archivo de audio.` });
      return;
    }
    const prev = deck.getState().track?.artworkUrl;
    const info = await readTrackInfo(file);
    await deck.loadFile(file, info);
    if (prev && prev !== deck.getState().track?.artworkUrl) URL.revokeObjectURL(prev);
  },

  setChannel(chIdx, key, value) {
    set((st) => {
      const channels = [...st.channels] as DjStore['channels'];
      channels[chIdx] = { ...channels[chIdx], [key]: value };
      return { channels };
    });
    const ch = get().engine?.mixer.channels[chIdx];
    if (!ch) return;
    switch (key) {
      case 'trim': ch.setTrim(value as number); break;
      case 'high':
      case 'mid':
      case 'low': ch.setEq(key, value as number); break;
      case 'filter': ch.setFilter(value as number); break;
      case 'fader': ch.setFader(value as number); break;
      case 'cue': ch.setCue(value as boolean); break;
      case 'assign': get().engine?.mixer.setAssign(chIdx, value as XfAssign); break;
    }
  },

  setCrossfader(x) {
    set({ crossfader: x });
    get().engine?.mixer.setCrossfader(x);
  },
  setXfCurve(c) {
    set({ xfCurve: c });
    get().engine?.mixer.setCrossfaderCurve(c);
  },
  setMaster(v) {
    set({ master: v });
    get().engine?.mixer.setMasterVolume(v);
  },
  setPhonesMix(v) {
    set({ phonesMix: v });
    get().engine?.mixer.setPhonesMix(v);
  },
  setPhonesLevel(v) {
    set({ phonesLevel: v });
    get().engine?.mixer.setPhonesLevel(v);
  },
  setOutputMode(m) {
    const mixer = get().engine?.mixer;
    if (!mixer) return;
    mixer.setOutputMode(m);
    set({ outputMode: mixer.outputMode });
  },
}));
