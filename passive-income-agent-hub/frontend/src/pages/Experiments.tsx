import { FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, Experiment, OpportunitySummary } from '../api';
import { Empty, ErrorBox, Field, fmtDate, mxn, Section, useAsync } from '../components/ui';

export default function Experiments() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { data, error } = useAsync(() => api.get<Experiment[]>('/experiments'));
  const opps = useAsync(() => api.get<OpportunitySummary[]>('/opportunities'));
  const [f, setF] = useState({
    opportunity_id: params.get('opportunity') || '', name: '', hypothesis: '', duration_days: '7', target_net_mxn: '0',
    budget_mxn: '0', planned_hours: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const candidates = (opps.data || []).filter((o) => o.status !== 'DESCARTADA');
  const selected = candidates.find((o) => String(o.id) === f.opportunity_id);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      const body: Record<string, unknown> = {
        opportunity_id: Number(f.opportunity_id), name: f.name, hypothesis: f.hypothesis, duration_days: Number(f.duration_days),
        target_net_mxn: Number(f.target_net_mxn), budget_mxn: Number(f.budget_mxn),
        planned_hours: f.planned_hours ? Number(f.planned_hours) : null,
      };
      if (selected?.risk_level === 'ALTO') {
        if (!window.confirm('Esta oportunidad tiene riesgo ALTO. ¿Aceptas explícitamente el riesgo?')) return;
        body.acknowledge_high_risk = true;
      }
      const exp = await api.post<Experiment>('/experiments', body);
      nav(`/experimentos/${exp.id}`);
    } catch (err) {
      setFormError((err as Error).message);
    }
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold">Experimentos</h1>
        <p className="text-sm text-slate-400">Cada oportunidad se prueba con duración, objetivo y presupuesto acotados. Al final se compara ESTIMACIÓN vs RESULTADO REAL.</p>
      </header>

      <Section title="Nuevo experimento">
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <Field label="Oportunidad">
              <select className="input" required value={f.opportunity_id} onChange={set('opportunity_id')}>
                <option value="">Selecciona…</option>
                {candidates.map((o) => <option key={o.id} value={o.id}>{o.title} · riesgo {o.risk_level ?? 'sin evaluar'}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Nombre"><input className="input" required value={f.name} onChange={set('name')} placeholder="Plataforma X - semana 1" /></Field>
          <Field label="Duración (días)"><input className="input" type="number" min={1} value={f.duration_days} onChange={set('duration_days')} /></Field>
          <Field label="Objetivo neto (MXN)"><input className="input" type="number" min={0} step="any" value={f.target_net_mxn} onChange={set('target_net_mxn')} /></Field>
          <Field label="Presupuesto máximo (MXN)"><input className="input" type="number" min={0} step="any" value={f.budget_mxn} onChange={set('budget_mxn')} /></Field>
          <Field label="Horas planeadas (opcional)"><input className="input" type="number" min={0} step="any" value={f.planned_hours} onChange={set('planned_hours')} /></Field>
          <Field label="Hipótesis"><input className="input" value={f.hypothesis} onChange={set('hypothesis')} placeholder="Se pueden obtener $X/h…" /></Field>
          <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-4">
            <button className="btn-primary">Iniciar experimento</button>
            <span className="text-xs text-slate-500">El presupuesto se compromete contra tu capital; si lo excede, se bloquea.</span>
          </div>
          <div className="sm:col-span-2 lg:col-span-4"><ErrorBox error={formError} /></div>
        </form>
      </Section>

      <ErrorBox error={error} />
      {data && data.length === 0 && <Empty>Aún no hay experimentos.</Empty>}
      {data && data.length > 0 && (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[800px]">
            <thead className="border-b border-slate-800"><tr>{['Experimento', 'Oportunidad', 'Estado', 'Días reg.', 'Neto real', 'Objetivo', 'Recomendación', 'Inicio'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody>
              {data.map((e) => (
                <tr key={e.id} className="border-t border-slate-800/70 hover:bg-slate-800/40">
                  <td className="td"><Link className="font-medium text-slate-100 hover:text-emerald-300" to={`/experimentos/${e.id}`}>{e.name}</Link></td>
                  <td className="td"><Link className="text-sky-300 hover:underline" to={`/oportunidades/${e.opportunity_id}`}>{e.opportunity_title}</Link></td>
                  <td className="td">{e.status}</td>
                  <td className="td">{String(e.totals?.days_logged ?? 0)} / {e.duration_days}</td>
                  <td className="td">{mxn(e.totals?.net_operating as number)}</td>
                  <td className="td">{mxn(e.target_net_mxn)}</td>
                  <td className="td">{e.recommendation ?? '—'}</td>
                  <td className="td text-xs">{fmtDate(e.started_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
