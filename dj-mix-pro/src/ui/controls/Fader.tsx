import { useRef } from 'react';
import { clamp } from '../../shared/math';
import { useDrag } from './useDrag';

interface FaderProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  defaultValue?: number;
  orientation?: 'vertical' | 'horizontal';
  /** Vertical: true = el mínimo está arriba (convención de pitch fader). */
  invert?: boolean;
  /** Longitud del recorrido en px (se usa para la sensibilidad del arrastre). */
  length?: number;
  className?: string;
  /** Marcas visuales (posiciones 0..1 del recorrido). */
  ticks?: number[];
  centerDetent?: boolean;
  format?: (v: number) => string;
  onChange: (v: number) => void;
  testId?: string;
}

export function Fader({
  label,
  value,
  min = 0,
  max = 1,
  defaultValue,
  orientation = 'vertical',
  invert = false,
  className = '',
  ticks = [0, 0.25, 0.5, 0.75, 1],
  centerDetent = false,
  format,
  onChange,
  testId,
}: FaderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const startValue = useRef(value);
  const range = max - min;
  const def = defaultValue ?? (centerDetent ? (min + max) / 2 : min);
  const vertical = orientation === 'vertical';

  const drag = useDrag({
    onStart: () => (startValue.current = value),
    onDrag: (dx, dy, fine) => {
      const el = trackRef.current;
      if (!el) return;
      const len = vertical ? el.clientHeight : el.clientWidth;
      let px = vertical ? -dy : dx;
      if (vertical && invert) px = -px;
      const delta = (px / Math.max(40, len)) * range * (fine ? 0.2 : 1);
      let v = clamp(startValue.current + delta, min, max);
      if (centerDetent && Math.abs(v - def) < range * 0.012) v = def;
      onChange(v);
    },
    onDoubleTap: () => onChange(def),
  });

  // t = posición visual 0..1 desde abajo (vertical) o desde la izquierda.
  let t = (value - min) / range;
  if (vertical && invert) t = 1 - t;

  return (
    <div
      className={`fader ${vertical ? 'fader-v' : 'fader-h'} ${className}`}
      role="slider"
      aria-label={label}
      aria-orientation={orientation}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Number(value.toFixed(4))}
      aria-valuetext={format ? format(value) : undefined}
      tabIndex={0}
      data-testid={testId}
      onKeyDown={(e) => {
        const step = range / (e.shiftKey ? 400 : 50);
        const up = e.key === 'ArrowUp' || e.key === 'ArrowRight';
        const down = e.key === 'ArrowDown' || e.key === 'ArrowLeft';
        if (up || down) {
          const dir = (up ? 1 : -1) * (vertical && invert ? -1 : 1);
          onChange(clamp(value + dir * step, min, max));
        } else if (e.key === 'Home' || e.key === 'Enter') onChange(def);
        else return;
        e.preventDefault();
      }}
      {...drag}
    >
      <div className="fader-track" ref={trackRef}>
        {ticks.map((k) => (
          <span
            key={k}
            className="fader-tick"
            style={vertical ? { bottom: `${k * 100}%` } : { left: `${k * 100}%` }}
          />
        ))}
        <div className="fader-slot" />
        <div
          className="fader-cap"
          style={vertical ? { bottom: `${t * 100}%` } : { left: `${t * 100}%` }}
        />
      </div>
    </div>
  );
}
