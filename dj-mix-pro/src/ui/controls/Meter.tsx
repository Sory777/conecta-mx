import { useRef } from 'react';
import type { LevelMeter } from '../../engine/mixer/LevelMeter';
import { useFrame } from '../useFrame';

interface MeterProps {
  meter: LevelMeter | null | undefined;
  segments?: number;
  label?: string;
  testId?: string;
}

/** Medidor de LEDs de -36 dBFS a 0 dBFS. Se actualiza fuera de React. */
export function Meter({ meter, segments = 15, label, testId }: MeterProps) {
  const ref = useRef<HTMLDivElement>(null);

  useFrame(() => {
    const el = ref.current;
    if (!el || !meter) return;
    const db = meter.readDb();
    const lit = Math.round(((db + 36) / 36) * segments);
    el.dataset.db = db.toFixed(1);
    const kids = el.children;
    for (let i = 0; i < kids.length; i++) {
      // hijos de arriba (0 dB) hacia abajo
      const segIndex = segments - 1 - i;
      (kids[i] as HTMLElement).classList.toggle('on', segIndex < lit);
    }
  });

  return (
    <div className="meter" ref={ref} aria-label={label} data-testid={testId} data-db="-90">
      {Array.from({ length: segments }, (_, i) => {
        const segIndex = segments - 1 - i;
        const zone = segIndex >= segments - 2 ? 'clip' : segIndex >= segments - 5 ? 'hot' : 'ok';
        return <span key={i} className={`seg ${zone}`} />;
      })}
    </div>
  );
}
