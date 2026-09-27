import { useState } from 'react';
import { Download } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { navigate } from '../lib/router';
import { useAsync } from '../lib/useAsync';
import { LEVEL_LABEL, minutesLabel } from '../lib/format';
import { Disclaimer, ErrorBox, Spinner, useToast } from '../components/ui';

export function SharedPage({ code }: { code: string }) {
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const { data, error, loading, reload } = useAsync(() => (user ? api.shared(code) : Promise.resolve(null)), [code, user?.id]);
  if (authLoading || loading) return <Spinner />;
  if (!user) {
    return (
      <div className="page max-w-md text-center">
        <h1 className="text-xl font-bold text-slate-900">Te compartieron un curso</h1>
        <p className="mt-2 text-slate-600">Entra o crea una cuenta para verlo e importarlo.</p>
        <div className="mt-4 flex justify-center gap-2">
          <a className="btn-primary" href="#/registro">
            Crear cuenta
          </a>
          <a className="btn-secondary" href="#/entrar">
            Entrar
          </a>
        </div>
      </div>
    );
  }
  if (error || !data) return <div className="page"><ErrorBox error={error} onRetry={reload} /></div>;
  return (
    <div className="page max-w-3xl">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Curso compartido</p>
      <h1 className="mt-1 text-2xl font-bold text-slate-900">{data.title}</h1>
      <p className="mt-2 text-slate-700">{data.plan.goal_outcome}</p>
      <p className="mt-1 text-sm text-slate-500">
        {LEVEL_LABEL[data.level] ?? data.level} · {data.plan.estimated_hours} h · {data.plan.stages.length} etapas
      </p>
      {data.disclaimer && <div className="mt-3"><Disclaimer text={data.disclaimer} /></div>}
      <ol className="mt-5 space-y-2">
        {data.plan.stages.map((s, i) => (
          <li key={i} className="card p-3">
            <p className="text-xs text-slate-500">
              {s.kind_label} {i + 1} · {minutesLabel(s.estimated_minutes)}
            </p>
            <p className="font-semibold text-slate-900">{s.title}</p>
            <p className="text-sm text-slate-600">{s.objective}</p>
          </li>
        ))}
      </ol>
      <button
        className="btn-primary mt-6"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await api.importShared(code);
            toast('Curso importado. Revisa el plan y ajústalo a ti.');
            navigate(`/curso/${r.course_id}/plan`);
          } catch (e) {
            toast(e instanceof ApiError ? e.message : 'No se pudo importar.', 'error');
            setBusy(false);
          }
        }}
      >
        <Download className="h-4 w-4" aria-hidden /> Importar a mis cursos
      </button>
    </div>
  );
}
