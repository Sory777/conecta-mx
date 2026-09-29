import { Link } from 'react-router-dom';
import { Decision } from '../api';
import { fmtDate } from './ui';

const LABELS: [string, string][] = [
  ['found_because', 'Encontré esta oportunidad porque…'],
  ['data_used', 'Estos son los datos utilizados'],
  ['risks', 'Estos son los riesgos'],
  ['can_automate', 'Esto puede automatizarse'],
  ['cannot_automate', 'Esto NO puede automatizarse'],
  ['discard_reason', 'Razón por la que fue descartada'],
  ['conclusion', 'Conclusión'],
];

export default function DecisionCard({ d, showOpportunity = false }: { d: Decision; showOpportunity?: boolean }) {
  return (
    <article className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
      <header className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded bg-slate-800 px-2 py-0.5 font-semibold text-emerald-300">{d.agent_key}</span>
        <span className="text-slate-300">{d.action.replace(/_/g, ' ')}</span>
        {showOpportunity && d.opportunity_id && (
          <Link className="text-sky-300 hover:underline" to={`/oportunidades/${d.opportunity_id}`}>{d.opportunity_title}</Link>
        )}
        <span className="ml-auto text-slate-500">{fmtDate(d.created_at)}</span>
      </header>
      <div className="space-y-2">
        {LABELS.filter(([k]) => d.sections[k]).map(([k, label]) => {
          const v = d.sections[k];
          return (
            <div key={k}>
              <div className={`text-[11px] font-semibold uppercase tracking-wide ${k === 'discard_reason' ? 'text-rose-300' : 'text-slate-400'}`}>{label}</div>
              {Array.isArray(v) ? (
                <ul className="ml-4 list-disc text-sm text-slate-300">{v.map((x, i) => <li key={i} className="break-words">{x}</li>)}</ul>
              ) : (
                <p className="whitespace-pre-line break-words text-sm text-slate-300">{v}</p>
              )}
            </div>
          );
        })}
      </div>
    </article>
  );
}
