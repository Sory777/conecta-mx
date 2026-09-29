import { FormEvent, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, Experiment } from '../api';
import { Empty, ErrorBox, Field, mxn, Section, useAsync } from '../components/ui';
import TransactionForm from '../components/TransactionForm';

const today = () => new Date().toLocaleDateString('en-CA');

export default function ExperimentDetail() {
  const { id } = useParams();
  const { data: e, error, reload } = useAsync(() => api.get<Experiment>(`/experiments/${id}`), [id]);
  const [f, setF] = useState({ day: today(), minutes_used: '', tasks_available: '', tasks_completed: '', problems: '', blocked: false, notes: '' });
  const [err, setErr] = useState<string | null>(null);
  if (error) return <ErrorBox error={error} />;
  if (!e) return <div className="text-slate-400">Cargando…</div>;
  const t = (e.totals || {}) as Record<string, number | string[]>;
  const running = e.status === 'EN_CURSO';
  const num = (s: string) => (s === '' ? null : Number(s));

  const addLog = async (ev: FormEvent) => {
    ev.preventDefault();
    setErr(null);
    try {
      await api.post(`/experiments/${e.id}/logs`, {
        day: f.day, minutes_used: Number(f.minutes_used || 0), tasks_available: num(f.tasks_available),
        tasks_completed: num(f.tasks_completed), problems: f.problems || null, blocked: f.blocked, notes: f.notes || null,
      });
      setF({ ...f, minutes_used: '', tasks_available: '', tasks_completed: '', problems: '', blocked: false, notes: '' });
      reload();
    } catch (x) {
      setErr((x as Error).message);
    }
  };
  const finish = async (path: 'finish' | 'cancel') => {
    if (!window.confirm(path === 'finish' ? '¿Finalizar y comparar estimación vs resultado real?' : '¿Cancelar el experimento?')) return;
    try {
      await api.post(`/experiments/${e.id}/${path}`);
      reload();
    } catch (x) {
      setErr((x as Error).message);
    }
  };
  const r = e.result;

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <Link to="/experimentos" className="text-xs text-slate-400 hover:underline">← Experimentos</Link>
        <h1 className="text-xl font-semibold">{e.name}</h1>
        <p className="text-sm text-slate-400">
          <Link className="text-sky-300 hover:underline" to={`/oportunidades/${e.opportunity_id}`}>{e.opportunity_title}</Link> ·
          {' '}{e.status} · {e.duration_days} días · objetivo {mxn(e.target_net_mxn)} · presupuesto {mxn(e.budget_mxn)}
        </p>
        {e.hypothesis && <p className="text-sm text-slate-300">Hipótesis: {e.hypothesis}</p>}
        {running && (
          <div className="flex gap-2 pt-1">
            <button className="btn-primary" onClick={() => finish('finish')}>Finalizar y evaluar</button>
            <button className="btn-ghost" onClick={() => finish('cancel')}>Cancelar</button>
          </div>
        )}
        <ErrorBox error={err} />
      </header>

      {r && (
        <Section title={`Resultado: ${e.recommendation}`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px]">
              <thead><tr><th className="th"></th><th className="th">ESTIMACIÓN (al iniciar)</th><th className="th">RESULTADO REAL</th></tr></thead>
              <tbody>
                <tr className="border-t border-slate-800"><td className="td text-slate-400">Neto del periodo</td>
                  <td className="td">{r.estimated_period_net_mxn ? `${mxn(r.estimated_period_net_mxn.base)} (${mxn(r.estimated_period_net_mxn.pesimista, 0)} a ${mxn(r.estimated_period_net_mxn.optimista, 0)})` : 'no calculable'}</td>
                  <td className="td font-semibold">{mxn(r.actual_net_mxn)}</td></tr>
                <tr className="border-t border-slate-800"><td className="td text-slate-400">Neto por hora</td>
                  <td className="td">{mxn(r.estimated_net_per_hour_mxn)}</td><td className="td">{mxn(r.actual_net_per_hour_mxn)}</td></tr>
                <tr className="border-t border-slate-800"><td className="td text-slate-400">Real / estimado</td>
                  <td className="td" colSpan={2}>{r.actual_vs_estimate_ratio === null ? '—' : `${r.actual_vs_estimate_ratio}×`}</td></tr>
                <tr className="border-t border-slate-800"><td className="td text-slate-400">Neto tras inversión</td>
                  <td className="td" colSpan={2}>{mxn(r.actual_net_after_investment_mxn)}</td></tr>
              </tbody>
            </table>
          </div>
          <ul className="ml-5 mt-3 list-disc text-sm text-slate-300">{r.reasons.map((x) => <li key={x}>{x}</li>)}</ul>
          <p className="mt-2 text-xs text-slate-500">La razón real/estimado alimenta la calibración histórica de su categoría.</p>
        </Section>
      )}

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {([['Ingresos', mxn(t.earned as number)], ['Gastos op.', mxn(t.operating as number)], ['Inversión', mxn(t.investment as number)],
          ['Neto', mxn(t.net_operating as number)], ['Horas', ((t.minutes as number) / 60 || 0).toFixed(1)], ['Retirado (recibido)', mxn(t.withdrawn_received as number)]] as [string, string][]).map(([k, v]) => (
          <div key={k} className="card"><div className="text-xs text-slate-400">{k}</div><div className="text-lg font-semibold">{v}</div></div>
        ))}
      </div>

      {running && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Section title="Registro diario">
            <form onSubmit={addLog} className="grid gap-2 sm:grid-cols-2">
              <Field label="Día"><input className="input" type="date" value={f.day} onChange={(x) => setF({ ...f, day: x.target.value })} /></Field>
              <Field label="Minutos usados"><input className="input" type="number" min={0} value={f.minutes_used} onChange={(x) => setF({ ...f, minutes_used: x.target.value })} /></Field>
              <Field label="Tareas disponibles"><input className="input" type="number" min={0} value={f.tasks_available} onChange={(x) => setF({ ...f, tasks_available: x.target.value })} /></Field>
              <Field label="Tareas completadas"><input className="input" type="number" min={0} value={f.tasks_completed} onChange={(x) => setF({ ...f, tasks_completed: x.target.value })} /></Field>
              <div className="sm:col-span-2"><Field label="Problemas"><input className="input" value={f.problems} onChange={(x) => setF({ ...f, problems: x.target.value })} /></Field></div>
              <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={f.blocked} onChange={(x) => setF({ ...f, blocked: x.target.checked })} /> Cuenta bloqueada / sin acceso</label>
              <Field label="Notas"><input className="input" value={f.notes} onChange={(x) => setF({ ...f, notes: x.target.value })} /></Field>
              <div className="sm:col-span-2"><button className="btn-primary">Guardar día</button></div>
            </form>
          </Section>
          <Section title="Registrar dinero de este experimento">
            <TransactionForm experimentId={e.id} onDone={reload} />
          </Section>
        </div>
      )}

      <Section title="Días registrados">
        {!e.logs?.length ? <Empty>Sin registros.</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead><tr>{['Día', 'Minutos', 'Disponibles', 'Completadas', 'Bloqueo', 'Problemas / notas'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
              <tbody>
                {e.logs.map((l) => (
                  <tr key={l.id} className="border-t border-slate-800">
                    <td className="td">{l.day}</td><td className="td">{l.minutes_used}</td><td className="td">{l.tasks_available ?? '—'}</td>
                    <td className="td">{l.tasks_completed ?? '—'}</td><td className="td">{l.blocked ? '⚠️ sí' : 'no'}</td>
                    <td className="td text-xs text-slate-400">{[l.problems, l.notes].filter(Boolean).join(' · ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
