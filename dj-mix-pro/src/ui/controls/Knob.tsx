import { useRef } from 'react';
import { clamp } from '../../shared/math';
import { useDrag } from './useDrag';

interface KnobProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  defaultValue?: number;
  /** Dibuja el arco desde el centro (EQ, filtro, gain). */
  bipolar?: boolean;
  size?: number;
  accent?: string;
  format?: (v: number) => string;
  onChange: (v: number) => void;
  hint?: string;
  testId?: string;
}

const START = -135;
const SWEEP = 270;
/** Píxeles de arrastre vertical para recorrer todo el rango. */
const TRAVEL_PX = 180;

function polar(cx: number, cy: number, r: number, deg: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

function arc(cx: number, cy: number, r: number, from: number, to: number) {
  if (Math.abs(to - from) < 0.01) return '';
  const [x1, y1] = polar(cx, cy, r, Math.min(from, to));
  const [x2, y2] = polar(cx, cy, r, Math.max(from, to));
  const large = Math.abs(to - from) > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

export function Knob({
  label,
  value,
  min = 0,
  max = 1,
  defaultValue,
  bipolar = false,
  size = 46,
  accent = 'var(--accent)',
  format,
  onChange,
  hint,
  testId,
}: KnobProps) {
  const startValue = useRef(value);
  const def = defaultValue ?? (bipolar ? (min + max) / 2 : min);
  const range = max - min;

  const drag = useDrag({
    onStart: () => (startValue.current = value),
    onDrag: (dx, dy, fine) => {
      // Vertical u horizontal: lo que sea más cómodo en cada pantalla.
      const delta = (dx - dy) / (fine ? TRAVEL_PX * 5 : TRAVEL_PX);
      let v = clamp(startValue.current + delta * range, min, max);
      // Imán al centro en controles bipolares.
      if (bipolar && Math.abs(v - def) < range * 0.015) v = def;
      onChange(v);
    },
    onDoubleTap: () => onChange(def),
  });

  const t = (value - min) / range;
  const angle = START + t * SWEEP;
  const cx = size / 2;
  const r = size / 2 - 4;
  const fromAngle = bipolar ? START + ((def - min) / range) * SWEEP : START;
  const [px, py] = polar(cx, cx, r - 7, angle);

  return (
    <div className="knob" title={hint ?? label}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        style={{ width: `calc(var(--knob) * ${size / 46})`, height: `calc(var(--knob) * ${size / 46})` }}
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={Number(value.toFixed(3))}
        aria-valuetext={format ? format(value) : undefined}
        tabIndex={0}
        data-testid={testId}
        onKeyDown={(e) => {
          const step = range / (e.shiftKey ? 200 : 40);
          if (e.key === 'ArrowUp' || e.key === 'ArrowRight') onChange(clamp(value + step, min, max));
          else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') onChange(clamp(value - step, min, max));
          else if (e.key === 'Home' || e.key === 'Enter') onChange(def);
          else return;
          e.preventDefault();
        }}
        onWheel={(e) => onChange(clamp(value - Math.sign(e.deltaY) * range * 0.02, min, max))}
        {...drag}
      >
        <path d={arc(cx, cx, r, START, START + SWEEP)} className="knob-track" />
        <path d={arc(cx, cx, r, fromAngle, angle)} style={{ stroke: accent }} className="knob-value" />
        <circle cx={cx} cy={cx} r={r - 4} className="knob-cap" />
        <line x1={cx} y1={cx} x2={px} y2={py} className="knob-pointer" />
      </svg>
      <span className="knob-label">{label}</span>
    </div>
  );
}
