import { Link } from 'react-router-dom';
import { Alert, api } from '../api';
import { Empty, ErrorBox, fmtDate, useAsync } from '../components/ui';

const KIND: Record<string, string> = {
  nueva_oportunidad: 'Nueva oportunidad', cambio_plataforma: 'Cambio de plataforma', no_rentable: 'Dejó de ser rentable',
  retiro_disponible: 'Retiro disponible', objetivo: 'Objetivo alcanzado', problema_cuenta: 'Problema de cuenta',
  inversion_limite: 'Límite de inversión', sospechosa: 'Plataforma sospechosa',
};

export default function Alerts({ onChange }: { onChange: (n: number) => void }) {
  const { data, error, reload } = useAsync(async () => {
    const a = await api.get<Alert[]>('/alerts');
    onChange(a.filter((x) => !x.read).length);
    return a;
  });
  const read = async (id: number) => {
    await api.post(`/alerts/${id}/read`);
    reload();
  };
  const readAll = async () => {
    await api.post('/alerts/read-all');
    reload();
  };
  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Alertas</h1>
        <button className="btn-ghost" onClick={readAll}>Marcar todas como leídas</button>
      </header>
      <ErrorBox error={error} />
      {data && data.length === 0 && <Empty>Sin alertas.</Empty>}
      <ul className="space-y-2">
        {data?.map((a) => (
          <li key={a.id} className={`card flex flex-wrap items-start gap-3 ${a.read ? 'opacity-60' : ''}`}>
            <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${a.severity === 'critica' ? 'bg-rose-500' : a.severity === 'aviso' ? 'bg-orange-400' : 'bg-sky-400'}`} />
            <div className="min-w-0 flex-1">
              <div className="text-xs uppercase tracking-wide text-slate-500">{KIND[a.kind] || a.kind} · {a.severity} · {fmtDate(a.created_at)}</div>
              <div className="font-medium">{a.title}</div>
              {a.body && <p className="text-sm text-slate-400">{a.body}</p>}
              {a.opportunity_id && <Link className="text-xs text-sky-300 hover:underline" to={`/oportunidades/${a.opportunity_id}`}>Ver oportunidad</Link>}
            </div>
            {!a.read && <button className="text-xs text-slate-400 underline" onClick={() => read(a.id)}>Leída</button>}
          </li>
        ))}
      </ul>
    </div>
  );
}
