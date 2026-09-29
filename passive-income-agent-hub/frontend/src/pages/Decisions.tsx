import { useState } from 'react';
import { api, Decision } from '../api';
import DecisionCard from '../components/DecisionCard';
import { Empty, ErrorBox, useAsync } from '../components/ui';

const AGENTS = ['', 'investigador', 'antifraude', 'rentabilidad', 'automatizacion', 'monitor', 'usuario'];

export default function Decisions() {
  const [agent, setAgent] = useState('');
  const { data, error } = useAsync(() => api.get<Decision[]>(`/decisions?limit=200${agent ? `&agent=${agent}` : ''}`), [agent]);
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Historial de decisiones</h1>
          <p className="text-sm text-slate-400">Cada agente explica qué encontró, con qué datos, qué riesgos vio y por qué decidió. Sin cajas negras.</p>
        </div>
        <select className="input w-auto" value={agent} onChange={(e) => setAgent(e.target.value)}>
          {AGENTS.map((a) => <option key={a} value={a}>{a || 'Todos los agentes'}</option>)}
        </select>
      </header>
      <ErrorBox error={error} />
      {data && data.length === 0 && <Empty>Sin decisiones registradas.</Empty>}
      <div className="space-y-3">{data?.map((d) => <DecisionCard key={d.id} d={d} showOpportunity />)}</div>
    </div>
  );
}
