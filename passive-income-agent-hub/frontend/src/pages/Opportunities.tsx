import { FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { api, OpportunitySummary } from '../api';
import { AutomationBar, catLabel, Empty, ErrorBox, Field, mxn, RiskBadge, Section, StatusBadge, useAsync, useMeta } from '../components/ui';

const MODES = [
  ['no_investment', 'Sin inversión', 'Inversión inicial = $0 (conocida)'],
  ['low_risk', 'Bajo riesgo', 'Riesgo antifraude BAJO'],
  ['max_automation', 'Automatización máxima', 'Automatización ≥ 75%'],
  ['within_capital', 'Dentro de mi capital', 'Inversión ≤ capital disponible'],
] as const;

function NewOpportunity({ onCreated }: { onCreated: (o: OpportunitySummary) => void }) {
  const meta = useMeta();
  const [f, setF] = useState({ title: '', category: 'otra', description: '', discovery_reason: '', pname: '', url: '', tos_url: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = {
        title: f.title, category: f.category, description: f.description, discovery_reason: f.discovery_reason,
        platform: f.pname || f.url ? { name: f.pname || f.title, url: f.url || null, tos_url: f.tos_url || null } : undefined,
      };
      onCreated(await api.post<OpportunitySummary>('/opportunities', body));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="grid gap-3 md:grid-cols-3">
      <Field label="Nombre"><input className="input" required value={f.title} onChange={set('title')} /></Field>
      <Field label="Categoría">
        <select className="input" value={f.category} onChange={set('category')}>
          {meta?.categories.map((c) => <option key={c} value={c}>{catLabel(c)}</option>)}
        </select>
      </Field>
      <Field label="Plataforma (nombre)"><input className="input" value={f.pname} onChange={set('pname')} /></Field>
      <Field label="URL oficial"><input className="input" type="url" placeholder="https://" value={f.url} onChange={set('url')} /></Field>
      <Field label="URL de términos de servicio"><input className="input" type="url" placeholder="https://" value={f.tos_url} onChange={set('tos_url')} /></Field>
      <Field label="¿Por qué la agregas?"><input className="input" value={f.discovery_reason} onChange={set('discovery_reason')} /></Field>
      <div className="md:col-span-3">
        <Field label="Descripción (el antifraude la analiza)">
          <textarea className="input min-h-[70px]" value={f.description} onChange={set('description')} />
        </Field>
      </div>
      <div className="flex items-center gap-3 md:col-span-3">
        <button className="btn-primary" disabled={busy}>{busy ? 'Evaluando…' : 'Crear y evaluar'}</button>
        <span className="text-xs text-slate-500">Se ejecutan antifraude → automatización → rentabilidad. Quedará como INVESTIGANDO.</span>
      </div>
      <div className="md:col-span-3"><ErrorBox error={error} /></div>
    </form>
  );
}

export default function Opportunities() {
  const meta = useMeta();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [showNew, setShowNew] = useState(false);
  const qs = params.toString();
  const { data, error } = useAsync(() => api.get<OpportunitySummary[]>(`/opportunities?${qs}`), [qs]);

  const setParam = (k: string, v: string | null) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v);
    else p.delete(k);
    setParams(p);
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Oportunidades</h1>
          <p className="text-sm text-slate-400">Cifras del escenario base en MXN/mes. «—» = sin datos suficientes (no se inventa).</p>
        </div>
        <button className="btn-primary" onClick={() => setShowNew(!showNew)}><Plus size={16} /> Nueva oportunidad</button>
      </header>

      {showNew && (
        <Section title="Agregar oportunidad manualmente">
          <NewOpportunity onCreated={(o) => nav(`/oportunidades/${o.id}`)} />
        </Section>
      )}

      <div className="card space-y-3">
        <div className="flex flex-wrap gap-2">
          {MODES.map(([k, label, hint]) => {
            const on = params.get(k) === 'true';
            return (
              <button key={k} title={hint} onClick={() => setParam(k, on ? null : 'true')}
                className={`btn ${on ? 'bg-emerald-700 text-white' : 'border border-slate-700 text-slate-300 hover:bg-slate-800'}`}>
                {on ? '✓ ' : ''}{label}
              </button>
            );
          })}
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <input className="input" placeholder="Buscar…" defaultValue={params.get('q') || ''}
            onKeyDown={(e) => e.key === 'Enter' && setParam('q', (e.target as HTMLInputElement).value || null)} />
          <select className="input" value={params.get('status') || ''} onChange={(e) => setParam('status', e.target.value || null)}>
            <option value="">Todos los estados</option>
            {meta?.statuses.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
          <select className="input" value={params.get('category') || ''} onChange={(e) => setParam('category', e.target.value || null)}>
            <option value="">Todas las categorías</option>
            {meta?.categories.map((c) => <option key={c} value={c}>{catLabel(c)}</option>)}
          </select>
          <select className="input" value={params.get('sort') || 'priority'} onChange={(e) => setParam('sort', e.target.value)}>
            <option value="priority">Ordenar: prioridad</option>
            <option value="net">Ordenar: neto mensual</option>
            <option value="net_per_hour">Ordenar: neto por hora</option>
            <option value="recent">Ordenar: recientes</option>
          </select>
        </div>
      </div>

      <ErrorBox error={error} />
      {data && data.length === 0 && <Empty>No hay oportunidades con estos filtros.</Empty>}
      {data && data.length > 0 && (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[980px]">
            <thead className="border-b border-slate-800">
              <tr>
                {['Oportunidad', 'Categoría', 'Inversión', 'Ingreso estimado', 'Costo', 'Neto', 'Horas', 'Riesgo', 'Automatización', 'Estado'].map((h) => (
                  <th key={h} className="th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((o) => (
                <tr key={o.id} className="cursor-pointer border-t border-slate-800/70 hover:bg-slate-800/40" onClick={() => nav(`/oportunidades/${o.id}`)}>
                  <td className="td min-w-[240px]">
                    <Link to={`/oportunidades/${o.id}`} className="font-medium text-slate-100">{o.title}</Link>
                    <div className="text-[11px] text-slate-500">
                      {o.confidence ? `confianza ${o.confidence}` : 'sin estimación'}
                      {o.observed_days > 0 && ` · ${o.observed_days} días observados`}
                      {o.mexico_available === null ? ' · México: NO VERIFICADO' : o.mexico_available ? ' · México ✓' : ' · México ✗'}
                    </div>
                  </td>
                  <td className="td capitalize">{catLabel(o.category)}</td>
                  <td className="td">{mxn(o.initial_investment_mxn)}</td>
                  <td className="td">{mxn(o.gross_monthly_mxn)}</td>
                  <td className="td">{mxn(o.costs_monthly_mxn)}</td>
                  <td className="td">
                    <div className={o.net_monthly_mxn !== null && o.net_monthly_mxn < 0 ? 'text-rose-300' : ''}>{mxn(o.net_monthly_mxn)}</div>
                    {o.net_monthly_low_mxn !== null && (
                      <div className="text-[11px] text-slate-500">{mxn(o.net_monthly_low_mxn, 0)} a {mxn(o.net_monthly_high_mxn, 0)}</div>
                    )}
                  </td>
                  <td className="td">{o.hours_monthly ?? '—'}</td>
                  <td className="td"><RiskBadge risk={o.risk_level} /></td>
                  <td className="td"><AutomationBar level={o.automation_level} /></td>
                  <td className="td"><StatusBadge status={o.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
