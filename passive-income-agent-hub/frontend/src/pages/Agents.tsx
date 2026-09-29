import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Play } from 'lucide-react';
import { api, ResearchResult } from '../api';
import { catLabel, Empty, ErrorBox, fmtDate, Section, useAsync, useMeta } from '../components/ui';

interface AgentRow { id: number; key: string; name: string; description: string; phase: number; enabled: boolean; last_run_at: string | null; runs: number; runnable: boolean; category: string | null; preset_queries: string[] }
interface AgentsResp { agents: AgentRow[]; search_provider: string | null; runs_today: number; max_runs_per_day: number }
interface Run { id: number; agent_key: string; trigger: string; status: string; summary: string | null; error: string | null; started_at: string; finished_at: string | null; input: Record<string, string> | null }

const RESEARCH = new Set(['investigador', 'microtareas', 'encuestas', 'mineria', 'depin', 'afiliados', 'productos_digitales', 'ia']);

function AgentCard({ a, provider, onRun }: { a: AgentRow; provider: string | null; onRun: () => void }) {
  const meta = useMeta();
  const [query, setQuery] = useState(a.preset_queries[0] || '');
  const [category, setCategory] = useState(a.category || '');
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isResearch = RESEARCH.has(a.key);
  const run = async () => {
    setError(null);
    setMsg(null);
    try {
      await api.post(`/agents/${a.key}/run`, isResearch ? { query, category: category || null } : {});
      setMsg('En cola. El resultado aparecerá en «Ejecuciones».');
      onRun();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <div className="card flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <h3 className="font-semibold text-slate-100">{a.name}</h3>
        <span className="ml-auto text-[11px] text-slate-500">{a.runs} ejecuciones</span>
      </div>
      <p className="text-sm text-slate-400">{a.description}</p>
      {isResearch && (
        <>
          <textarea className="input min-h-[56px]" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="¿Qué buscar?" />
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Cualquier categoría (incluye nuevas)</option>
            {meta?.categories.map((c) => <option key={c} value={c}>{catLabel(c)}</option>)}
          </select>
        </>
      )}
      <div className="mt-auto flex items-center gap-2">
        {a.runnable && (
          <button className="btn-primary" onClick={run} disabled={isResearch && !provider}>
            <Play size={14} /> {a.key === 'monitor' ? 'Revisar cambios ahora' : isResearch ? 'Investigar' : 'Re-evaluar todo'}
          </button>
        )}
        <span className="text-[11px] text-slate-500">Última: {fmtDate(a.last_run_at)}</span>
      </div>
      {msg && <p className="text-xs text-emerald-300">{msg}</p>}
      <ErrorBox error={error} />
    </div>
  );
}

export default function Agents() {
  const agents = useAsync(() => api.get<AgentsResp>('/agents'));
  const runs = useAsync(() => api.get<Run[]>('/agent-runs?limit=30'));
  const research = useAsync(() => api.get<ResearchResult[]>('/research-results?limit=40'));
  const pending = runs.data?.some((r) => r.status === 'EN_CURSO');

  useEffect(() => {
    // mientras haya ejecuciones en curso, refrescar periódicamente
    const t = setInterval(() => {
      runs.reload();
      research.reload();
    }, pending ? 4000 : 20000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  const d = agents.data;
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold">Agentes</h1>
        <p className="text-sm text-slate-400">
          Toda búsqueda guarda URL, fecha y fuente. Lo encontrado entra como INVESTIGANDO y NO VERIFICADO hasta que lo revises.
        </p>
      </header>
      <ErrorBox error={agents.error} />
      {d && (
        <div className={`rounded-lg border p-3 text-sm ${d.search_provider ? 'border-emerald-800 bg-emerald-950/30 text-emerald-200' : 'border-yellow-800 bg-yellow-950/30 text-yellow-100'}`}>
          {d.search_provider
            ? <>Búsqueda web: <b>{d.search_provider}</b> · ejecuciones de investigación hoy {d.runs_today}/{d.max_runs_per_day}</>
            : <>Sin proveedor de búsqueda. Configura <code>ANTHROPIC_API_KEY</code> (búsqueda + extracción) o <code>BRAVE_API_KEY</code> (solo resultados) en <code>backend/.env</code>. Los agentes de antifraude, rentabilidad y monitor funcionan sin IA.</>}
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {d?.agents.map((a) => <AgentCard key={a.key} a={a} provider={d.search_provider} onRun={() => setTimeout(runs.reload, 500)} />)}
      </div>

      <Section title="Ejecuciones">
        {!runs.data?.length ? <Empty>Sin ejecuciones.</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead><tr>{['Agente', 'Disparador', 'Estado', 'Entrada', 'Resumen / error', 'Inicio'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
              <tbody>
                {runs.data.map((r) => (
                  <tr key={r.id} className="border-t border-slate-800">
                    <td className="td">{r.agent_key}</td><td className="td text-xs">{r.trigger}</td>
                    <td className={`td text-xs font-semibold ${r.status === 'OK' ? 'text-emerald-300' : r.status === 'ERROR' ? 'text-rose-300' : 'text-yellow-200'}`}>{r.status}</td>
                    <td className="td max-w-[220px] text-xs text-slate-400">{r.input?.query ?? '—'}</td>
                    <td className="td text-xs">{r.error ? <span className="text-rose-300">{r.error}</span> : r.summary}</td>
                    <td className="td text-xs">{fmtDate(r.started_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Resultados de investigación (fuentes)">
        {!research.data?.length ? <Empty>Sin resultados todavía.</Empty> : (
          <ul className="space-y-2">
            {research.data.map((r) => (
              <li key={r.id} className="text-sm">
                <a className="break-all text-sky-300 hover:underline" href={r.url} target="_blank" rel="noreferrer">{r.title || r.url}</a>
                {r.opportunity_id && <Link className="ml-2 text-xs text-emerald-300" to={`/oportunidades/${r.opportunity_id}`}>→ oportunidad</Link>}
                <div className="text-xs text-slate-500">{r.source} · {fmtDate(r.retrieved_at)} · «{r.query}»</div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
