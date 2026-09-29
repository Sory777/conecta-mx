import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { api, Meta } from '../api';

export const mxn = (v: number | null | undefined, digits = 2) =>
  v === null || v === undefined || Number.isNaN(v)
    ? '—'
    : new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: digits }).format(v);

export const fmtDate = (s: string | null | undefined) => {
  if (!s) return '—';
  if (s.length <= 10) return s; // fecha sin hora (YYYY-MM-DD): se muestra tal cual, sin zona horaria
  const d = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(s) ? s : s + 'Z'); // el backend guarda UTC sin zona
  return d.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
};

const STATUS: Record<string, [string, string]> = {
  ACTIVA: ['🟢 ACTIVA', 'bg-emerald-900/60 text-emerald-300 border-emerald-700'],
  EN_PRUEBA: ['🟡 EN PRUEBA', 'bg-yellow-900/50 text-yellow-200 border-yellow-700'],
  INVESTIGANDO: ['🔵 INVESTIGANDO', 'bg-sky-900/50 text-sky-200 border-sky-700'],
  REQUIERE_ACCION: ['🟠 REQUIERE ACCIÓN', 'bg-orange-900/50 text-orange-200 border-orange-700'],
  DESCARTADA: ['🔴 DESCARTADA', 'bg-rose-900/50 text-rose-200 border-rose-700'],
};
const RISK: Record<string, string> = {
  BAJO: 'bg-emerald-900/60 text-emerald-300 border-emerald-700',
  MEDIO: 'bg-yellow-900/50 text-yellow-200 border-yellow-700',
  ALTO: 'bg-orange-900/50 text-orange-200 border-orange-700',
  DESCARTAR: 'bg-rose-900/60 text-rose-200 border-rose-700',
};
const EVIDENCE: Record<string, [string, string]> = {
  OBSERVADO: ['DATO OBSERVADO', 'bg-emerald-900/60 text-emerald-300 border-emerald-700'],
  ESTIMACION: ['ESTIMACIÓN', 'bg-sky-900/50 text-sky-200 border-sky-700'],
  SUPOSICION: ['SUPOSICIÓN', 'bg-violet-900/50 text-violet-200 border-violet-700'],
  PROMESA_PLATAFORMA: ['PROMESA DE LA PLATAFORMA', 'bg-orange-900/50 text-orange-200 border-orange-700'],
  NO_VERIFICADA: ['NO VERIFICADA', 'bg-rose-900/50 text-rose-200 border-rose-700'],
};

const pill = 'inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold';

export function StatusBadge({ status }: { status: string }) {
  const [label, cls] = STATUS[status] || [status, 'border-slate-600 text-slate-300'];
  return <span className={`${pill} ${cls}`}>{label}</span>;
}
export function RiskBadge({ risk }: { risk: string | null }) {
  if (!risk) return <span className={`${pill} border-slate-600 text-slate-400`}>SIN EVALUAR</span>;
  return <span className={`${pill} ${RISK[risk]}`}>{risk}</span>;
}
export function EvidenceBadge({ type }: { type: string }) {
  const [label, cls] = EVIDENCE[type] || [type, 'border-slate-600 text-slate-300'];
  return <span className={`${pill} ${cls}`}>{label}</span>;
}
export function AutomationBar({ level }: { level: number | null }) {
  if (level === null || level === undefined) return <span className="text-xs text-slate-500">—</span>;
  return (
    <div className="flex items-center gap-2" title={`${level}% automatizable`}>
      <div className="h-1.5 w-14 overflow-hidden rounded bg-slate-800">
        <div className="h-full bg-emerald-500" style={{ width: `${level}%` }} />
      </div>
      <span className="text-xs text-slate-300">{level}%</span>
    </div>
  );
}

export function Kpi({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'good' | 'bad' }) {
  const color = tone === 'good' ? 'text-emerald-300' : tone === 'bad' ? 'text-rose-300' : 'text-slate-100';
  return (
    <div className="card">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${color}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

export function ErrorBox({ error }: { error: string | null }) {
  if (!error) return null;
  return <div className="rounded-lg border border-rose-800 bg-rose-950/60 px-3 py-2 text-sm text-rose-200">{error}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">{children}</div>;
}

export function Section({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    fn()
      .then((d) => alive && (setData(d), setError(null)))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { data, error, loading, reload: () => setTick((t) => t + 1), setData };
}

const MetaCtx = createContext<Meta | null>(null);
export function MetaProvider({ children }: { children: ReactNode }) {
  const { data } = useAsync(() => api.get<Meta>('/meta'));
  return <MetaCtx.Provider value={data}>{children}</MetaCtx.Provider>;
}
export const useMeta = () => useContext(MetaCtx);

export const catLabel = (c: string) => c.replace(/_/g, ' ');
