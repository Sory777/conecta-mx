import { Link } from 'react-router-dom';
import { Alert, api, Capital, OpportunitySummary } from '../api';
import DailyChart from '../components/DailyChart';
import { Empty, ErrorBox, fmtDate, Kpi, mxn, RiskBadge, Section, StatusBadge, useAsync } from '../components/ui';

type Window = { earned_mxn: number; expenses_mxn: number; net_mxn: number };
interface Dash {
  income: {
    today: Window; week: Window; month: Window; all_time: Window;
    estimated_monthly_mxn: number; estimated_monthly_low_mxn: number; real_last_30d_mxn: number; estimate_note: string;
  };
  daily: { day: string; earned: number; expenses: number }[];
  capital: Capital;
  status_counts: Record<string, number>;
  alerts: Alert[];
  unread_alerts: number;
  top_opportunities: OpportunitySummary[];
  running_experiments: number;
}

const tone = (v: number) => (v > 0 ? 'good' : v < 0 ? 'bad' : undefined);

export default function Dashboard() {
  const { data, error } = useAsync(() => api.get<Dash>('/dashboard'));
  if (error) return <ErrorBox error={error} />;
  if (!data) return <div className="text-slate-400">Cargando…</div>;
  const { income, capital } = data;
  const gap = income.real_last_30d_mxn - income.estimated_monthly_mxn;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-slate-400">Ingreso neto = ingresos − gastos operativos registrados. Todo en MXN.</p>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Hoy" value={mxn(income.today.net_mxn)} tone={tone(income.today.net_mxn)} hint={`${mxn(income.today.earned_mxn)} ingresos`} />
        <Kpi label="Esta semana" value={mxn(income.week.net_mxn)} tone={tone(income.week.net_mxn)} hint={`${mxn(income.week.earned_mxn)} ingresos`} />
        <Kpi label="Este mes" value={mxn(income.month.net_mxn)} tone={tone(income.month.net_mxn)} hint={`${mxn(income.month.expenses_mxn)} gastos`} />
        <Kpi label="Histórico" value={mxn(income.all_time.net_mxn)} tone={tone(income.all_time.net_mxn)} hint={`${mxn(income.all_time.earned_mxn)} ingresos totales`} />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Kpi label="Ingreso real (últimos 30 días)" value={mxn(income.real_last_30d_mxn)} tone={tone(income.real_last_30d_mxn)} hint="DATO OBSERVADO" />
        <Kpi label="Ingreso estimado mensual" value={mxn(income.estimated_monthly_mxn)}
          hint={`ESTIMACIÓN · pesimista ${mxn(income.estimated_monthly_low_mxn)}`} />
        <Kpi label="Real − estimado" value={mxn(gap)} tone={tone(gap)} hint={income.estimate_note} />
      </div>

      <Section title="Ingresos y gastos diarios (30 días)">
        <DailyChart data={data.daily} />
      </Section>

      <div className="grid gap-5 lg:grid-cols-3">
        <Section title="Capital" actions={<Link className="text-xs text-emerald-400" to="/configuracion">Ajustar</Link>}>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            {([
              ['Límite', capital.limit_mxn], ['Disponible', capital.available_mxn], ['Comprometido', capital.committed_mxn],
              ['Invertido', capital.invested_mxn], ['Recuperado', capital.recovered_mxn], ['Ganancia', capital.profit_mxn],
              ['Pérdida', capital.loss_mxn],
            ] as [string, number][]).map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-slate-400">{k}</dt>
                <dd className={`text-right font-medium ${k === 'Pérdida' && v > 0 ? 'text-rose-300' : ''}`}>{mxn(v)}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-[11px] text-slate-500">{capital.explanation}</p>
        </Section>

        <Section title="Oportunidades por estado">
          <ul className="space-y-2">
            {Object.entries(data.status_counts).map(([s, n]) => (
              <li key={s} className="flex items-center justify-between">
                <Link to={`/oportunidades?status=${s}`}><StatusBadge status={s} /></Link>
                <span className="text-sm text-slate-300">{n}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-400">{data.running_experiments} experimento(s) en curso.</p>
        </Section>

        <Section title="Alertas recientes" actions={<Link className="text-xs text-emerald-400" to="/alertas">Ver todas ({data.unread_alerts} sin leer)</Link>}>
          {data.alerts.length === 0 ? <Empty>Sin alertas.</Empty> : (
            <ul className="space-y-2">
              {data.alerts.map((a) => (
                <li key={a.id} className={`text-sm ${a.read ? 'text-slate-500' : 'text-slate-200'}`}>
                  <span className={a.severity === 'critica' ? 'text-rose-400' : a.severity === 'aviso' ? 'text-orange-300' : 'text-sky-300'}>● </span>
                  {a.title}
                  <div className="text-[11px] text-slate-500">{fmtDate(a.created_at)}</div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section title="Mayor prioridad (fórmula: neto/hora pesimista × confianza × riesgo)">
        {data.top_opportunities.length === 0 ? (
          <Empty>Aún no hay oportunidades. <Link className="text-emerald-400 underline" to="/agentes">Ejecuta un agente</Link> o <Link className="text-emerald-400 underline" to="/oportunidades">agrega una manualmente</Link>.</Empty>
        ) : (
          <ul className="divide-y divide-slate-800">
            {data.top_opportunities.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-3 py-2">
                <Link to={`/oportunidades/${o.id}`} className="font-medium text-slate-100 hover:text-emerald-300">{o.title}</Link>
                <StatusBadge status={o.status} /><RiskBadge risk={o.risk_level} />
                <span className="ml-auto text-sm text-slate-300">
                  {o.metrics_status === 'OK' ? `${mxn(o.net_monthly_mxn)}/mes · ${mxn(o.net_per_hour_mxn)}/h` : 'datos insuficientes'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
