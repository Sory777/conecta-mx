import { useState } from 'react';
import { mxn } from './ui';

// Paleta categórica validada (modo oscuro): slot 1 azul, slot 2 naranja.
const SERIES = [
  { key: 'earned', label: 'Ingresos', color: '#3987e5' },
  { key: 'expenses', label: 'Gastos operativos', color: '#d95926' },
] as const;

type Row = { day: string; earned: number; expenses: number };

export default function DailyChart({ data }: { data: Row[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const max = Math.max(1, ...data.flatMap((d) => [d.earned, d.expenses]));
  const W = 720, H = 180, pad = 24, slot = (W - pad) / data.length, bw = Math.max(2, slot / 2 - 2);
  const y = (v: number) => H - pad - (v / max) * (H - pad * 1.5);
  const bar = (x: number, v: number, color: string) => {
    if (v <= 0) return null;
    const top = y(v), h = H - pad - top, r = Math.min(4, bw / 2, h);
    // extremo de datos redondeado (4px), anclado a la línea base
    return <path d={`M${x},${H - pad} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${H - pad} Z`} fill={color} />;
  };
  const h = hover !== null ? data[hover] : null;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-4 text-xs text-slate-300">
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} /> {s.label}
          </span>
        ))}
        <button className="ml-auto text-slate-400 underline" onClick={() => setTable(!table)}>
          {table ? 'Ver gráfica' : 'Ver tabla'}
        </button>
      </div>
      {table ? (
        <div className="max-h-56 overflow-auto">
          <table className="w-full">
            <thead><tr><th className="th">Día</th><th className="th">Ingresos</th><th className="th">Gastos</th></tr></thead>
            <tbody>
              {data.filter((d) => d.earned || d.expenses).map((d) => (
                <tr key={d.day} className="border-t border-slate-800">
                  <td className="td">{d.day}</td><td className="td">{mxn(d.earned)}</td><td className="td">{mxn(d.expenses)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="h-44 w-full" role="img" aria-label="Ingresos y gastos diarios, últimos 30 días"
            onMouseLeave={() => setHover(null)}>
            <line x1={pad} x2={W} y1={H - pad} y2={H - pad} stroke="#334155" />
            <line x1={pad} x2={W} y1={y(max)} y2={y(max)} stroke="#1e293b" strokeDasharray="3 3" />
            <text x={pad - 4} y={y(max) + 4} fill="#94a3b8" fontSize="10" textAnchor="end">{Math.round(max)}</text>
            {data.map((d, i) => {
              const x = pad + i * slot + 1;
              return (
                <g key={d.day}>
                  {hover === i && <rect x={x - 1} y={0} width={slot} height={H - pad} fill="#1e293b" />}
                  {bar(x, d.earned, SERIES[0].color)}
                  {bar(x + bw + 2, d.expenses, SERIES[1].color)}
                  <rect x={x - 1} y={0} width={slot} height={H} fill="transparent" onMouseEnter={() => setHover(i)} />
                  {i % 5 === 0 && <text x={x + bw} y={H - 8} fill="#94a3b8" fontSize="10" textAnchor="middle">{d.day.slice(5)}</text>}
                </g>
              );
            })}
          </svg>
          {h && (
            <div className="pointer-events-none absolute top-0 rounded-lg border border-slate-700 bg-slate-950/95 px-3 py-2 text-xs shadow"
              style={{ left: `${Math.min(80, ((hover ?? 0) / data.length) * 100)}%` }}>
              <div className="font-semibold text-slate-100">{h.day}</div>
              <div className="text-slate-300">Ingresos: {mxn(h.earned)}</div>
              <div className="text-slate-300">Gastos: {mxn(h.expenses)}</div>
              <div className="text-slate-400">Neto: {mxn(h.earned - h.expenses)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
