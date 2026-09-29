import { FormEvent, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ExternalLink, FlaskConical, RefreshCw, Trash2 } from 'lucide-react';
import { api, Metrics, OpportunityDetail as Detail, Platform } from '../api';
import DecisionCard from '../components/DecisionCard';
import {
  AutomationBar, catLabel, Empty, ErrorBox, EvidenceBadge, Field, fmtDate, mxn, RiskBadge, Section, StatusBadge, useAsync, useMeta,
} from '../components/ui';

const tri = (v: boolean | null | undefined, yes = 'Sí', no = 'No') => (v === null || v === undefined ? 'NO VERIFICADO' : v ? yes : no);

function Scenarios({ m }: { m: Metrics }) {
  if (m.status !== 'OK' || !m.scenarios) {
    return (
      <div className="rounded-lg border border-yellow-800 bg-yellow-950/40 p-3 text-sm text-yellow-100">
        <b>Datos insuficientes: no se calcula ninguna cifra.</b>
        <ul className="ml-5 mt-1 list-disc">{m.missing?.map((x) => <li key={x}>{x}</li>)}</ul>
        <p className="mt-2 text-xs text-yellow-200/80">Agrega datos abajo (cada uno con su tipo de evidencia y fuente).</p>
      </div>
    );
  }
  const cols = ['pesimista', 'base', 'optimista'] as const;
  const rows: [string, (k: typeof cols[number]) => string][] = [
    ['Ingreso bruto mensual', (k) => mxn(m.scenarios![k].gross_mxn)],
    ...Object.keys(m.scenarios.base.costs).map((c) => [`− ${c}`, (k: typeof cols[number]) => mxn(m.scenarios![k].costs[c])] as [string, (k: typeof cols[number]) => string]),
    ['Ingreso neto mensual', (k) => mxn(m.scenarios![k].net_mxn)],
    ['Horas al mes', (k) => String(m.scenarios![k].hours)],
    ['Ingreso neto por hora', (k) => mxn(m.scenarios![k].net_per_hour_mxn)],
    ['Inversión inicial', (k) => mxn(m.scenarios![k].initial_investment_mxn)],
    ['ROI 12 meses', (k) => (m.scenarios![k].roi_12m_pct === null ? 'no aplica' : `${m.scenarios![k].roi_12m_pct}%`)],
    ['Recuperación', (k) => (m.scenarios![k].payback_months === null ? (m.scenarios![k].initial_investment_mxn > 0 ? 'nunca con estos datos' : 'no aplica') : `${m.scenarios![k].payback_months} meses`)],
  ];
  if (m.calibrated_scenarios) rows.push(['Neto calibrado (historial)', (k) => mxn(m.calibrated_scenarios![k].net_mxn)]);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px]">
        <thead><tr><th className="th">ESTIMACIÓN</th>{cols.map((c) => <th key={c} className="th capitalize">{c}</th>)}</tr></thead>
        <tbody>
          {rows.map(([label, fn]) => (
            <tr key={label} className={`border-t border-slate-800 ${label.startsWith('Ingreso neto') ? 'font-semibold' : ''}`}>
              <td className="td text-slate-400">{label}</td>
              {cols.map((c) => <td key={c} className="td">{fn(c)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AddDataPoint({ oppId, onDone }: { oppId: number; onDone: () => void }) {
  const meta = useMeta();
  const [f, setF] = useState({ field: 'gross_monthly', value: '', value_low: '', value_high: '', currency: 'MXN', evidence_type: 'SUPOSICION', source_url: '', note: '' });
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const monetary = meta?.fields.find((x) => x.field === f.field)?.monetary;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const num = (s: string) => (s.trim() === '' ? null : Number(s));
    try {
      await api.post(`/opportunities/${oppId}/data-points`, {
        field: f.field, value: Number(f.value), value_low: num(f.value_low), value_high: num(f.value_high),
        currency: monetary ? f.currency : null, evidence_type: f.evidence_type,
        source_url: f.source_url || null, note: f.note || null,
      });
      setF({ ...f, value: '', value_low: '', value_high: '', source_url: '', note: '' });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    }
  };
  return (
    <form onSubmit={submit} className="mt-3 grid gap-2 rounded-lg border border-slate-800 p-3 sm:grid-cols-2 lg:grid-cols-4">
      <Field label="Dato">
        <select className="input" value={f.field} onChange={set('field')}>
          {meta?.fields.map((x) => <option key={x.field} value={x.field}>{x.label} ({x.unit})</option>)}
        </select>
      </Field>
      <Field label="Valor"><input className="input" required type="number" step="any" value={f.value} onChange={set('value')} /></Field>
      <Field label="Mínimo (opcional)"><input className="input" type="number" step="any" value={f.value_low} onChange={set('value_low')} /></Field>
      <Field label="Máximo (opcional)"><input className="input" type="number" step="any" value={f.value_high} onChange={set('value_high')} /></Field>
      {monetary && (
        <Field label="Moneda">
          <select className="input" value={f.currency} onChange={set('currency')}>
            {meta?.currencies.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
      )}
      <Field label="Tipo de evidencia">
        <select className="input" value={f.evidence_type} onChange={set('evidence_type')}>
          {meta?.evidence_types.map((c) => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
        </select>
      </Field>
      <Field label="URL de la fuente"><input className="input" type="url" value={f.source_url} onChange={set('source_url')} /></Field>
      <Field label="Nota / cita textual"><input className="input" value={f.note} onChange={set('note')} /></Field>
      <div className="flex items-end gap-3 lg:col-span-4">
        <button className="btn-primary">Agregar dato y recalcular</button>
        <ErrorBox error={error} />
      </div>
    </form>
  );
}

function PlatformForm({ p, onDone }: { p: Platform; onDone: () => void }) {
  const [f, setF] = useState<Record<string, string>>({
    url: p.url || '', tos_url: p.tos_url || '', countries: p.countries || '', payment_methods: p.payment_methods || '',
    min_payout: p.min_payout?.toString() || '', min_payout_currency: p.min_payout_currency || 'USD', requirements: p.requirements || '',
    fees_note: p.fees_note || '', api_docs_url: p.api_docs_url || '', monitored_url: p.monitored_url || '', notes: p.notes || '',
    mexico_available: String(p.mexico_available), tos_prohibits_automation: String(p.tos_prohibits_automation),
    has_official_api: String(p.has_official_api), verification_status: p.verification_status,
  });
  const [error, setError] = useState<string | null>(null);
  const set = (k: string) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const triSel = (k: string) => (
    <select className="input" value={f[k]} onChange={set(k)}>
      <option value="null">NO VERIFICADO</option><option value="true">Sí</option><option value="false">No</option>
    </select>
  );
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const tb = (s: string) => (s === 'null' ? null : s === 'true');
    try {
      await api.put(`/platforms/${p.id}`, {
        ...Object.fromEntries(['url', 'tos_url', 'countries', 'payment_methods', 'min_payout_currency', 'requirements', 'fees_note',
          'api_docs_url', 'monitored_url', 'notes'].map((k) => [k, f[k] || null])),
        min_payout: f.min_payout ? Number(f.min_payout) : null,
        mexico_available: tb(f.mexico_available), tos_prohibits_automation: tb(f.tos_prohibits_automation),
        has_official_api: tb(f.has_official_api), verification_status: f.verification_status,
      });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    }
  };
  return (
    <form onSubmit={submit} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      <Field label="URL oficial"><input className="input" value={f.url} onChange={set('url')} /></Field>
      <Field label="Términos de servicio"><input className="input" value={f.tos_url} onChange={set('tos_url')} /></Field>
      <Field label="URL monitoreada (cambios)"><input className="input" value={f.monitored_url} onChange={set('monitored_url')} /></Field>
      <Field label="¿Disponible en México?">{triSel('mexico_available')}</Field>
      <Field label="¿Términos prohíben bots/automatización?">{triSel('tos_prohibits_automation')}</Field>
      <Field label="¿API oficial?">{triSel('has_official_api')}</Field>
      <Field label="Países"><input className="input" value={f.countries} onChange={set('countries')} /></Field>
      <Field label="Métodos de pago"><input className="input" value={f.payment_methods} onChange={set('payment_methods')} /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Pago mínimo"><input className="input" type="number" step="any" value={f.min_payout} onChange={set('min_payout')} /></Field>
        <Field label="Moneda"><input className="input" value={f.min_payout_currency} onChange={set('min_payout_currency')} /></Field>
      </div>
      <Field label="Requisitos"><input className="input" value={f.requirements} onChange={set('requirements')} /></Field>
      <Field label="Comisiones"><input className="input" value={f.fees_note} onChange={set('fees_note')} /></Field>
      <Field label="Docs de API"><input className="input" value={f.api_docs_url} onChange={set('api_docs_url')} /></Field>
      <Field label="Estado de verificación">
        <select className="input" value={f.verification_status} onChange={set('verification_status')}>
          <option value="NO_VERIFICADA">NO VERIFICADA</option><option value="VERIFICADA_PARCIAL">VERIFICADA PARCIAL</option><option value="VERIFICADA">VERIFICADA (revisé fuentes oficiales)</option>
        </select>
      </Field>
      <div className="sm:col-span-2"><Field label="Notas"><input className="input" value={f.notes} onChange={set('notes')} /></Field></div>
      <div className="flex items-center gap-3 lg:col-span-3"><button className="btn-primary">Guardar y re-evaluar</button><ErrorBox error={error} /></div>
    </form>
  );
}

export default function OpportunityDetail() {
  const { id } = useParams();
  const meta = useMeta();
  const { data, error, reload } = useAsync(() => api.get<Detail>(`/opportunities/${id}`), [id]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editPlatform, setEditPlatform] = useState(false);
  const [newStatus, setNewStatus] = useState('');

  if (error) return <ErrorBox error={error} />;
  if (!data) return <div className="text-slate-400">Cargando…</div>;
  const o = data.opportunity, m = data.metrics, p = data.platform, ra = data.risk_assessments[0];

  const act = async (fn: () => Promise<unknown>) => {
    setActionError(null);
    try {
      await fn();
      reload();
    } catch (e) {
      setActionError((e as Error).message);
    }
  };
  const changeStatus = () => act(async () => {
    const body: Record<string, unknown> = { status: newStatus };
    if (newStatus === 'DESCARTADA') {
      const reason = window.prompt('Razón del descarte (queda en el historial):');
      if (!reason) return;
      body.discard_reason = reason;
    }
    if (o.risk_level === 'ALTO' && ['EN_PRUEBA', 'ACTIVA'].includes(newStatus)) {
      if (!window.confirm('Riesgo ALTO. ¿Aceptas explícitamente el riesgo?')) return;
      body.acknowledge_high_risk = true;
    }
    await api.patch(`/opportunities/${o.id}`, body);
  });

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <Link to="/oportunidades" className="text-xs text-slate-400 hover:underline">← Oportunidades</Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">{o.title}</h1>
          <StatusBadge status={o.status} /><RiskBadge risk={o.risk_level} /><AutomationBar level={o.automation_level} />
          <span className="text-xs capitalize text-slate-400">{catLabel(o.category)}</span>
        </div>
        {o.description && <p className="max-w-3xl text-sm text-slate-300">{o.description}</p>}
        <p className="text-xs text-slate-500">Descubierta por <b>{o.discovered_by}</b>: {o.discovery_reason}</p>
        {o.discard_reason && <p className="rounded border border-rose-800 bg-rose-950/40 p-2 text-sm text-rose-200">Descartada: {o.discard_reason}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-ghost" onClick={() => act(() => api.post(`/opportunities/${o.id}/evaluate`))}><RefreshCw size={14} /> Re-evaluar</button>
          <Link className="btn-ghost" to={`/experimentos?opportunity=${o.id}`}><FlaskConical size={14} /> Iniciar experimento</Link>
          <select className="input w-auto" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
            <option value="">Cambiar estado…</option>
            {meta?.statuses.filter((s) => s !== o.status).map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
          {newStatus && <button className="btn-primary" onClick={changeStatus}>Aplicar</button>}
        </div>
        <ErrorBox error={actionError} />
      </header>

      {m && (
        <Section title="Rentabilidad">
          <pre className="mb-3 whitespace-pre-wrap rounded-lg bg-slate-950 p-3 font-sans text-sm leading-relaxed text-slate-200">{m.narrative}</pre>
          <Scenarios m={m} />
          {m.observed && (
            <div className="mt-3 grid gap-3 sm:grid-cols-4">
              <div className="rounded-lg bg-emerald-950/40 p-3 text-sm"><div className="text-xs text-emerald-300">OBSERVADO · días</div>{m.observed.days}</div>
              <div className="rounded-lg bg-emerald-950/40 p-3 text-sm"><div className="text-xs text-emerald-300">Neto total</div>{mxn(m.observed.total_net_mxn)}</div>
              <div className="rounded-lg bg-emerald-950/40 p-3 text-sm"><div className="text-xs text-emerald-300">Neto/hora real</div>{mxn(m.observed.net_per_hour_mxn)}</div>
              <div className="rounded-lg bg-emerald-950/40 p-3 text-sm"><div className="text-xs text-emerald-300">Proyección mensual</div>{mxn(m.observed.monthly_projection_mxn)}
                {m.observed.monthly_interval_mxn && <div className="text-[11px] text-slate-400">{mxn(m.observed.monthly_interval_mxn[0], 0)} a {mxn(m.observed.monthly_interval_mxn[1], 0)}</div>}</div>
            </div>
          )}
          <div className="mt-3 grid gap-3 text-xs text-slate-400 md:grid-cols-2">
            <div><b className="text-slate-300">Prioridad {m.priority.value}</b> = {m.priority.formula}<br />{m.priority.explanation}</div>
            {m.formulas && <ul className="space-y-0.5">{Object.entries(m.formulas).map(([k, v]) => <li key={k}><b>{k.replace(/_/g, ' ')}</b>: {v}</li>)}</ul>}
          </div>
          {m.warnings?.length > 0 && <ErrorBox error={m.warnings.join(' · ')} />}
        </Section>
      )}

      <Section title="Datos y su procedencia">
        {data.data_points.length === 0 ? <Empty>Sin datos. Sin datos no hay estimación.</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead><tr>{['Dato', 'Valor (rango)', 'Evidencia', 'Fuente', 'Registrado', ''].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
              <tbody>
                {data.data_points.map((d) => (
                  <tr key={d.id} className="border-t border-slate-800">
                    <td className="td">{meta?.fields.find((x) => x.field === d.field)?.label || d.field}</td>
                    <td className="td">{d.value} {d.currency || ''}{(d.value_low !== null || d.value_high !== null) && <span className="text-xs text-slate-500"> ({d.value_low ?? d.value} – {d.value_high ?? d.value})</span>}</td>
                    <td className="td"><EvidenceBadge type={d.evidence_type} /></td>
                    <td className="td max-w-xs text-xs">
                      {d.source_url ? <a className="break-all text-sky-300 hover:underline" href={d.source_url} target="_blank" rel="noreferrer">{d.source_url}</a> : <span className="text-slate-500">sin fuente</span>}
                      {d.note && <div className="text-slate-500">«{d.note}»</div>}
                    </td>
                    <td className="td text-xs text-slate-400">{d.created_by}<br />{fmtDate(d.created_at)}</td>
                    <td className="td"><button className="text-slate-500 hover:text-rose-400" title="Eliminar" onClick={() => act(() => api.del(`/data-points/${d.id}`))}><Trash2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <AddDataPoint oppId={o.id} onDone={reload} />
      </Section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Antifraude" actions={ra && <span className="text-xs text-slate-500">{fmtDate(ra.created_at)}</span>}>
          {!ra ? <Empty>Sin evaluación.</Empty> : (
            <div className="space-y-3">
              <div className="flex items-center gap-2"><RiskBadge risk={ra.risk_level} /><span className="text-sm text-slate-300">{ra.reasoning}</span></div>
              {ra.flags.length === 0 ? <p className="text-sm text-slate-400">No se detectaron señales. (Ausencia de señales ≠ legitimidad comprobada.)</p> : (
                <ul className="space-y-2">
                  {ra.flags.map((f, i) => (
                    <li key={i} className={`rounded border p-2 text-sm ${f.dismissed ? 'border-slate-800 text-slate-500 line-through' : f.severity === 'CRITICO' ? 'border-rose-800 bg-rose-950/40' : 'border-orange-900 bg-orange-950/30'}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <b>[{f.severity}] {f.code}</b><span className="text-xs text-slate-500">{f.origin}</span>
                        {!f.dismissed && f.origin !== 'usuario' && (
                          <button className="ml-auto text-xs text-slate-400 underline" onClick={() => {
                            const reason = window.prompt('¿Por qué es un falso positivo? (mínimo 10 caracteres; queda en el historial)');
                            if (reason) act(() => api.post(`/opportunities/${o.id}/dismiss-flag`, { code: f.code, reason }));
                          }}>Marcar falso positivo</button>
                        )}
                      </div>
                      <div>{f.detail}</div>
                      <div className="text-xs text-slate-400">«{f.evidence}»</div>
                      {f.dismissed && <div className="text-xs no-underline">Descartada por usuario: {f.dismissed_reason}</div>}
                    </li>
                  ))}
                </ul>
              )}
              <details className="text-xs text-slate-400">
                <summary className="cursor-pointer">Verificaciones realizadas</summary>
                <ul className="mt-1 space-y-0.5">{ra.checks.map((c) => <li key={c.check}>{c.check}: {String(c.value ?? 'NO VERIFICADO')}</li>)}</ul>
              </details>
            </div>
          )}
        </Section>

        <Section title="Automatización (evaluación, sin ejecución)">
          {data.automation_tasks.length === 0 ? <Empty>Sin evaluación.</Empty> : (
            <ul className="space-y-1.5 text-sm">
              {data.automation_tasks.map((t) => (
                <li key={t.id} className={t.allowed ? 'text-emerald-300' : 'text-rose-300'}>
                  {t.allowed ? '✓' : '✗'} {t.description} <span className="text-xs text-slate-500">({t.method})</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-slate-500">Nunca: evadir CAPTCHA, falsificar identidad, multicuentas prohibidas, manipular encuestas o métricas, evadir límites.</p>
        </Section>
      </div>

      {p && (
        <Section title={`Plataforma: ${p.name}`} actions={<button className="btn-ghost" onClick={() => setEditPlatform(!editPlatform)}>{editPlatform ? 'Cerrar' : 'Editar / verificar'}</button>}>
          {editPlatform ? <PlatformForm p={p} onDone={() => { setEditPlatform(false); reload(); }} /> : (
            <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {([
                ['URL', p.url ? <a className="inline-flex items-center gap-1 text-sky-300" href={p.url} target="_blank" rel="noreferrer">{p.domain} <ExternalLink size={12} /></a> : 'NO VERIFICADO'],
                ['Verificación', p.verification_status.replace('_', ' ')],
                ['México', tri(p.mexico_available)],
                ['Países', p.countries || 'NO VERIFICADO'],
                ['Pago', p.payment_methods || 'NO VERIFICADO'],
                ['Pago mínimo', p.min_payout !== null ? `${p.min_payout} ${p.min_payout_currency || ''}` : 'NO VERIFICADO'],
                ['Comisiones', p.fees_note || 'NO VERIFICADO'],
                ['Requisitos', p.requirements || 'NO VERIFICADO'],
                ['Términos', p.tos_url ? <a className="text-sky-300" href={p.tos_url} target="_blank" rel="noreferrer">ver términos</a> : 'NO LOCALIZADOS'],
                ['Prohíbe automatización', tri(p.tos_prohibits_automation)],
                ['API oficial', tri(p.has_official_api)],
                ['Dominio registrado', p.domain_created_at ? fmtDate(p.domain_created_at) : 'NO VERIFICADO (RDAP)'],
                ['Última revisión (monitor)', fmtDate(p.last_checked_at)],
              ] as [string, React.ReactNode][]).map(([k, v]) => (
                <div key={k}><dt className="text-xs text-slate-500">{k}</dt><dd className="text-slate-200">{v}</dd></div>
              ))}
            </dl>
          )}
        </Section>
      )}

      {data.platform_changes.length > 0 && (
        <Section title="Cambios detectados en la plataforma">
          <ul className="space-y-2">
            {data.platform_changes.map((c) => (
              <li key={c.id} className="text-sm">
                <b>{c.change_type}</b> · {c.summary} <span className="text-xs text-slate-500">{fmtDate(c.detected_at)}</span>
                {c.diff_excerpt && <pre className="mt-1 max-h-40 overflow-auto rounded bg-slate-950 p-2 text-xs text-slate-400">{c.diff_excerpt}</pre>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {data.experiments.length > 0 && (
        <Section title="Experimentos">
          <ul className="space-y-1 text-sm">
            {data.experiments.map((e) => (
              <li key={e.id}><Link className="text-sky-300 hover:underline" to={`/experimentos/${e.id}`}>{e.name}</Link> · {e.status}{e.recommendation && ` · ${e.recommendation}`}</li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Fuentes consultadas">
        {data.research_results.length === 0 ? <Empty>Sin fuentes registradas.</Empty> : (
          <ul className="space-y-2">
            {data.research_results.map((r) => (
              <li key={r.id} className="text-sm">
                <a className="break-all text-sky-300 hover:underline" href={r.url} target="_blank" rel="noreferrer">{r.title || r.url}</a>
                <div className="text-xs text-slate-500">{r.source} · consultado {fmtDate(r.retrieved_at)}{r.page_age && ` · página de ${r.page_age}`}{r.query && ` · búsqueda «${r.query}»`}</div>
                {r.content && <p className="line-clamp-3 text-xs text-slate-400">{r.content}</p>}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Historial de decisiones">
        {data.decisions.length === 0 ? <Empty>Sin decisiones.</Empty> : (
          <div className="space-y-3">{data.decisions.map((d) => <DecisionCard key={d.id} d={d} />)}</div>
        )}
      </Section>
    </div>
  );
}
