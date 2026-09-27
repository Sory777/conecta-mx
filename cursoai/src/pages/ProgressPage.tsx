import { BarChart3, CheckCircle2, Clock } from 'lucide-react';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { relativeTime } from '../lib/format';
import { EmptyState, ErrorBox, ProgressBar, Spinner } from '../components/ui';

const KIND: Record<string, string> = {
  course_created: 'Nuevo curso',
  plan_revised: 'Plan modificado',
  plan_accepted: 'Plan aceptado',
  lesson_completed: 'Actividad terminada',
  answer: 'Respuesta',
  reinforcement_created: 'Refuerzo creado',
  quiz_submitted: 'Evaluación',
  quiz_created: 'Examen creado',
  stage_completed: 'Etapa superada',
  project_submitted: 'Proyecto enviado',
  course_completed: 'Curso terminado',
  certificate_issued: 'Certificado',
  tutor: 'Tutor',
  lesson_regenerated: 'Actividad adaptada',
  content_added: 'Contenido agregado',
  course_paused: 'Curso pausado',
  course_resumed: 'Curso reanudado',
  progress_reset: 'Progreso reiniciado',
  course_duplicated: 'Curso duplicado',
  course_imported: 'Curso importado',
};

export function ProgressPage() {
  const { data, error, loading, reload } = useAsync(() => api.progress(), []);
  if (loading) return <Spinner />;
  if (error || !data) return <div className="page"><ErrorBox error={error} onRetry={reload} /></div>;
  const started = data.courses.filter((c) => c.status !== 'diagnosing' && c.status !== 'planning');
  const accuracy = data.stats.answers ? Math.round((data.stats.correct / data.stats.answers) * 100) : 0;
  return (
    <div className="page space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Tu progreso</h1>
      <dl className="grid grid-cols-3 gap-3">
        {[
          { label: 'Cursos', value: started.length },
          { label: 'Respuestas', value: data.stats.answers },
          { label: 'Aciertos', value: `${accuracy}%` },
        ].map((s) => (
          <div key={s.label} className="card p-4">
            <dt className="text-xs text-slate-500">{s.label}</dt>
            <dd className="text-2xl font-bold text-slate-900">{s.value}</dd>
          </div>
        ))}
      </dl>

      {started.length === 0 ? (
        <EmptyState icon={<BarChart3 className="h-6 w-6" />} title="Aún no hay progreso" text="Cuando empieces un curso verás aquí tu avance y dominio por competencias." action={<a className="btn-primary" href="#/">Crear un curso</a>} />
      ) : (
        <section aria-labelledby="by-course" className="space-y-3">
          <h2 id="by-course" className="font-semibold text-slate-900">
            Por curso
          </h2>
          {started.map((c) => (
            <a key={c.id} href={`#/curso/${c.id}`} className="card block p-4 hover:border-brand-500">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-slate-900">{c.title}</h3>
                {c.status === 'completed' && <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-label="Terminado" />}
              </div>
              <div className="mt-2">
                <ProgressBar value={c.progress} label="Progreso" />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {c.mastered_concepts} dominados · {c.weak_concepts} por reforzar · {c.total_concepts} conceptos en total
              </p>
            </a>
          ))}
        </section>
      )}

      {data.history.length > 0 && (
        <section aria-labelledby="history">
          <h2 id="history" className="mb-3 font-semibold text-slate-900">
            Historial reciente
          </h2>
          <ol className="card divide-y divide-slate-100">
            {data.history.map((h, i) => (
              <li key={i} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-slate-800">
                    <strong>{KIND[h.kind] ?? h.kind}</strong>
                    {h.detail ? `: ${h.detail}` : ''}
                  </p>
                  <p className="text-xs text-slate-500">
                    {h.course_title ? `${h.course_title} · ` : ''}
                    {relativeTime(h.created_at)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
