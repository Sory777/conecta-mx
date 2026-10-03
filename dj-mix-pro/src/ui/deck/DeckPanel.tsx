import { useRef, useState } from 'react';
import type { DeckId } from '../../engine/deck/Deck';
import { formatPercent, formatTime } from '../../shared/time';
import { useDjStore } from '../../state/useDjStore';
import { Fader } from '../controls/Fader';
import { useFrame } from '../useFrame';
import { TrackStrip } from './TrackStrip';

const PITCH_RANGES = [0.08, 0.16, 0.5];
const BEND_AMOUNT = 0.04;

export function DeckPanel({ id }: { id: DeckId }) {
  const engine = useDjStore((s) => s.engine);
  const state = useDjStore((s) => s.decks[id]);
  const loadTrack = useDjStore((s) => s.loadTrack);
  const deck = engine?.decks[id];
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const elapsedRef = useRef<HTMLSpanElement>(null);
  const remainRef = useRef<HTMLSpanElement>(null);

  const track = state?.track ?? null;
  const duration = track?.duration ?? 0;

  useFrame(() => {
    if (!deck || !elapsedRef.current || !remainRef.current) return;
    const pos = deck.player.position();
    elapsedRef.current.textContent = formatTime(pos);
    const remaining = Math.max(0, duration - pos);
    remainRef.current.textContent = `-${formatTime(remaining)}`;
    // Aviso de fin de pista (últimos 30 s) como en reproductores de club.
    remainRef.current.classList.toggle('warn', !!track && remaining < 30 && remaining > 0);
  });

  const rate = deck ? deck.rate : 1;
  const effectiveBpm = track?.bpm ? track.bpm * rate : null;

  const onFiles = (files: FileList | null) => {
    const f = files?.[0];
    if (f) void loadTrack(id, f);
  };

  const pitch = state?.pitch ?? 0;
  const pitchRange = state?.pitchRange ?? 0.08;
  const playing = state?.playing ?? false;
  const mirrored = id === 'B';

  const pitchColumn = (
    <div className="deck-pitch">
      <button
        className="btn small"
        onClick={() => {
          const i = PITCH_RANGES.indexOf(pitchRange);
          deck?.setPitchRange(PITCH_RANGES[(i + 1) % PITCH_RANGES.length]);
        }}
        title="Rango del pitch fader"
        data-testid={`pitch-range-${id}`}
      >
        ±{Math.round(pitchRange * 100)}%
      </button>
      <Fader
        label={`Pitch deck ${id}`}
        value={pitch}
        min={-pitchRange}
        max={pitchRange}
        defaultValue={0}
        centerDetent
        invert
        className="pitch-fader"
        ticks={[0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1]}
        format={(v) => formatPercent(v)}
        onChange={(v) => deck?.setPitch(v)}
        testId={`pitch-${id}`}
      />
      <div className="bend">
        <HoldButton label="−" title="Pitch bend: frenar" onHold={(on) => deck?.setBend(on ? -BEND_AMOUNT : 0)} />
        <HoldButton label="+" title="Pitch bend: acelerar" onHold={(on) => deck?.setBend(on ? BEND_AMOUNT : 0)} />
      </div>
    </div>
  );

  return (
    <section
      className={`deck deck-${id.toLowerCase()} ${dragOver ? 'drag-over' : ''} ${mirrored ? 'mirrored' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        onFiles(e.dataTransfer.files);
      }}
      aria-label={`Deck ${id}`}
    >
      <header className="deck-head">
        <span className="deck-badge">{id}</span>
        <div className="deck-art">
          {track?.artworkUrl ? <img src={track.artworkUrl} alt="" /> : <span>♪</span>}
        </div>
        <div className="deck-title">
          <strong data-testid={`title-${id}`}>
            {state?.loading ? 'Cargando…' : track ? track.title : 'Sin pista'}
          </strong>
          <span>{track ? `${track.artist} · ${formatTime(duration, false)}` : 'Toca CARGAR o arrastra un archivo'}</span>
        </div>
        <div className="deck-load">
          <button className="btn load" onClick={() => fileRef.current?.click()} data-testid={`load-${id}`}>
            CARGAR
          </button>
          <button className="btn small" onClick={() => deck?.eject()} disabled={!track || playing} title="Expulsar">
            ⏏
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="audio/*,.mp3,.wav,.m4a,.aac,.flac,.ogg"
            hidden
            data-testid={`file-${id}`}
            onChange={(e) => {
              onFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </div>
      </header>

      {state?.error && <p className="deck-error">{state.error}</p>}

      <div className="deck-readout">
        <div className="readout">
          <label>TIEMPO</label>
          <span ref={elapsedRef} className="digits" data-testid={`elapsed-${id}`}>0:00.0</span>
        </div>
        <div className="readout">
          <label>RESTA</label>
          <span ref={remainRef} className="digits">-0:00.0</span>
        </div>
        <div className="readout">
          <label>BPM</label>
          <span className="digits" title={track?.bpm ? 'BPM de la etiqueta del archivo (el análisis llega en la Fase 2)' : 'Análisis de BPM: Fase 2'}>
            {effectiveBpm ? effectiveBpm.toFixed(1) : '—'}
          </span>
        </div>
        <div className="readout">
          <label>TEMPO</label>
          <span className="digits small">{formatPercent(rate - 1)}</span>
        </div>
        <div className="readout">
          <label>KEY</label>
          <span className="digits small" title="Detección de tonalidad: Fase 2">{track?.key ?? '—'}</span>
        </div>
      </div>

      <div className="deck-body">
        {!mirrored && pitchColumn}
        <div className="deck-main">
          <TrackStrip deckId={id} />
          <div className="deck-reserved" aria-label="Funciones de próximas fases">
            <button className="btn ghost" disabled title="Sincronización de BPM y beats — Fase 2">SYNC</button>
            <button className="btn ghost" disabled title="Loops automáticos y manuales — Fase 3">LOOP</button>
            <button className="btn ghost" disabled title="8 Hot Cues — Fase 3">HOT CUE</button>
          </div>
          <div className="transport">
            <button
              className={`btn cue ${track && !playing ? 'armed' : ''}`}
              disabled={!track}
              onPointerDown={(e) => {
                e.preventDefault();
                (e.currentTarget as Element).setPointerCapture(e.pointerId);
                deck?.cueDown();
              }}
              onPointerUp={() => deck?.cueUp()}
              onPointerCancel={() => deck?.cueUp()}
              data-testid={`cue-${id}`}
              title="CUE: en pausa fija el punto; en reproducción vuelve a él. Mantén para previsualizar."
            >
              CUE
            </button>
            <button
              className={`btn play ${playing ? 'on' : ''}`}
              disabled={!track}
              onPointerDown={(e) => {
                e.preventDefault();
                deck?.playPause();
              }}
              data-testid={`play-${id}`}
              aria-pressed={playing}
            >
              {playing ? '❚❚' : '▶'}
            </button>
          </div>
        </div>
        {mirrored && pitchColumn}
      </div>
    </section>
  );
}

function HoldButton({ label, title, onHold }: { label: string; title: string; onHold: (on: boolean) => void }) {
  return (
    <button
      className="btn small hold"
      title={title}
      onPointerDown={(e) => {
        e.preventDefault();
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
        onHold(true);
      }}
      onPointerUp={() => onHold(false)}
      onPointerCancel={() => onHold(false)}
    >
      {label}
    </button>
  );
}
