import { FormEvent, useEffect, useState } from 'react';
import { api, Capital, User } from '../api';
import { ErrorBox, Field, mxn, Section, useAsync } from '../components/ui';

interface SettingsResp {
  user: User;
  capital: Capital;
  integrations: Record<string, string | number | boolean>;
}

export default function SettingsPage() {
  const { data, error, reload } = useAsync(() => api.get<SettingsResp>('/settings'));
  const [f, setF] = useState({ capital_limit_mxn: '', min_hourly_rate_mxn: '', investment_alert_threshold_mxn: '' });
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (data) setF({
      capital_limit_mxn: String(data.user.capital_limit_mxn ?? 0),
      min_hourly_rate_mxn: data.user.min_hourly_rate_mxn?.toString() ?? '',
      investment_alert_threshold_mxn: data.user.investment_alert_threshold_mxn?.toString() ?? '',
    });
  }, [data]);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      await api.put('/settings', {
        capital_limit_mxn: Number(f.capital_limit_mxn || 0),
        min_hourly_rate_mxn: f.min_hourly_rate_mxn ? Number(f.min_hourly_rate_mxn) : null,
        investment_alert_threshold_mxn: f.investment_alert_threshold_mxn ? Number(f.investment_alert_threshold_mxn) : null,
      });
      setMsg('Guardado.');
      reload();
    } catch (x) {
      setErr((x as Error).message);
    }
  };
  if (error) return <ErrorBox error={error} />;
  if (!data) return <div className="text-slate-400">Cargando…</div>;
  const i = data.integrations;
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Configuración</h1>
      <Section title="Sistema de capital">
        <form onSubmit={save} className="grid gap-3 sm:grid-cols-3">
          <Field label="Capital que estoy dispuesto a usar (MXN)"><input className="input" type="number" min="0" step="any" value={f.capital_limit_mxn} onChange={(e) => setF({ ...f, capital_limit_mxn: e.target.value })} /></Field>
          <Field label="Ingreso mínimo aceptable por hora (MXN)"><input className="input" type="number" min="0" step="any" placeholder="opcional" value={f.min_hourly_rate_mxn} onChange={(e) => setF({ ...f, min_hourly_rate_mxn: e.target.value })} /></Field>
          <Field label="Alertar inversiones mayores a (MXN)"><input className="input" type="number" min="0" step="any" placeholder="opcional" value={f.investment_alert_threshold_mxn} onChange={(e) => setF({ ...f, investment_alert_threshold_mxn: e.target.value })} /></Field>
          <div className="flex items-center gap-3 sm:col-span-3"><button className="btn-primary">Guardar</button>{msg && <span className="text-xs text-emerald-300">{msg}</span>}<ErrorBox error={err} /></div>
        </form>
        <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          {([['Disponible', data.capital.available_mxn], ['Comprometido', data.capital.committed_mxn], ['Invertido', data.capital.invested_mxn], ['Recuperado', data.capital.recovered_mxn]] as [string, number][]).map(([k, v]) => (
            <div key={k} className="rounded bg-slate-950 p-2"><div className="text-xs text-slate-500">{k}</div>{mxn(v)}</div>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">Los experimentos no pueden comprometer más que el capital disponible. Las inversiones reales se registran siempre, pero generan alerta si lo exceden.</p>
      </Section>
      <Section title="Integraciones (se configuran en backend/.env; aquí nunca se muestran claves)">
        <ul className="grid gap-1 text-sm sm:grid-cols-2">
          <li>Claude (búsqueda web + extracción): <b>{i.anthropic ? `configurado (${i.anthropic_model})` : 'no configurado'}</b></li>
          <li>Brave Search API: <b>{i.brave ? 'configurado' : 'no configurado'}</b></li>
          <li>CoinGecko (clave demo): <b>{i.coingecko_key ? 'configurada' : 'sin clave (acceso público limitado)'}</b></li>
          <li>Agentes programados: <b>{i.scheduler_enabled ? `activos (monitor cada ${i.monitor_interval_hours} h, investigación cada ${i.research_interval_hours} h)` : 'desactivados'}</b></li>
          <li>Límite diario de investigaciones: <b>{String(i.max_agent_runs_per_day)}</b></li>
        </ul>
        {i.insecure_secret_key && <div className="mt-3"><ErrorBox error="SECRET_KEY usa el valor por defecto. Genera uno aleatorio en backend/.env antes de exponer la app a una red." /></div>}
      </Section>
    </div>
  );
}
