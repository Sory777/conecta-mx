import { useRef } from 'react';
import type { DeckId } from '../../engine/deck/Deck';
import { clamp } from '../../shared/math';
import { useDjStore } from '../../state/useDjStore';
import { useFrame } from '../useFrame';

/**
 * Barra de posición con búsqueda por toque/arrastre ("needle search").
 * En la FASE 2 se sustituye por la waveform completa con beatgrid; aquí no
 * se dibuja una forma de onda falsa.
 */
export function TrackStrip({ deckId }: { deckId: DeckId }) {
  const engine = useDjStore((s) => s.engine);
  const state = useDjStore((s) => s.decks[deckId]);
  const deck = engine?.decks[deckId];
  const barRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const activePointer = useRef<number | null>(null);

  const duration = state?.track?.duration ?? 0;

  useFrame(() => {
    if (!deck || !fillRef.current || !headRef.current) return;
    const t = duration > 0 ? clamp(deck.player.position() / duration, 0, 1) : 0;
    const pct = `${t * 100}%`;
    fillRef.current.style.width = pct;
    headRef.current.style.left = pct;
  });

  const seekFromEvent = (clientX: number) => {
    const el = barRef.current;
    if (!el || !deck || duration <= 0) return;
    const r = el.getBoundingClientRect();
    deck.seek(clamp((clientX - r.left) / r.width, 0, 1) * duration);
  };

  const cuePct = duration > 0 && state ? (state.cuePoint / duration) * 100 : 0;

  return (
    <div
      className={`track-strip ${duration > 0 ? '' : 'empty'}`}
      ref={barRef}
      data-testid={`strip-${deckId}`}
      onPointerDown={(e) => {
        if (duration <= 0) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        activePointer.current = e.pointerId;
        seekFromEvent(e.clientX);
      }}
      onPointerMove={(e) => {
        if (activePointer.current === e.pointerId) seekFromEvent(e.clientX);
      }}
      onPointerUp={() => (activePointer.current = null)}
      onPointerCancel={() => (activePointer.current = null)}
    >
      <div className="strip-fill" ref={fillRef} />
      {duration > 0 && <div className="strip-cue" style={{ left: `${cuePct}%` }} title="Punto CUE" />}
      <div className="strip-head" ref={headRef} />
      {duration <= 0 && <span className="strip-hint">Waveform y beatgrid: Fase 2</span>}
    </div>
  );
}
