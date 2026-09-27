import { useState } from 'react';
import { CheckCircle2, Clock, Flag, Layers, Pencil, Target, Trophy } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { navigate } from '../lib/router';
import { useAsync } from '../lib/useAsync';
import { ACTIVITY_LABEL, LEVEL_LABEL, minutesLabel } from '../lib/format';
import { Disclaimer, ErrorBox, Generating, Redirect, Spinner, useToast } from '../components/ui';

const CHANGES = ['Hazlo más práctico', 'Hazlo más corto', 'Quiero profundizar más', 'Tengo solamente 20 minutos diarios'];

export function PlanPage({ id }: { id: string }) {
  const toast = useToast();
  const { data, setData, error, loading, reload } = useAsync(() => api.course(id), [id]);
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState<null | 'revise' | 'accept'>(null);

  if (loading) return <Spinner />;
  if (error || !data) return <div className="page"><ErrorBox error={error} onRetry={reload} /></div>;
  if (data.course.status === 'diagnosing') return <Redirect to={`/curso/${id}/diagnostico`} />;
  if (!data.plan) return <div className="page"><ErrorBox error={new ApiError(404, 'not_found', 'Este curso aún no tiene plan.')} /></div>;
  const plan = data.plan.plan;
  const editable = data.course.status === 'planning';

  async function revise(text: string) {
    if (!text.trim()) return;
    setBusy('revise');
    try {
      setData(await api.revisePlan(id, text.trim()));
      setFeedback('');
      toast('Plan actualizado');
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'No se pudo modificar el plan.', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function accept() {
    setBusy('accept');
    try {
      await api.acceptPlan(id);
      const next = await api.next(id);
      navigate(next.kind === 'lesson' ? `/actividad/${next.lesson_id}` : `/curso/${id}`, true);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'No se pudo aceptar el plan.', 'error');
      setBusy(null);
    }
  }

  if (busy === 'accept') {
    return (
      <div className="page">
        <Generating steps={['Preparando tu primera etapa…', 'Creando actividades adaptadas a ti…', 'Casi listo…']} />
      </div>
    );
  }

  return (
    <div className="page max-w-3xl">
      <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">
        Tu plan de aprendizaje {data.plan.version > 1 && <span className="text-slate-400">· versión {data.plan.version}</span>}
      </p>
      <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">{plan.title}</h1>

      <section className="card mt-5 border-brand-100 bg-brand-50/60 p-5" aria-labelledby="outcome">
        <h2 id="outcome" className="flex items-center gap-2 text-sm font-semibold text-brand-800">
          <Target className="h-4 w-4" aria-hidden /> Qué podrás hacer al terminar
        </h2>
        <p className="mt-2 text-lg font-medium text-slate-900">{plan.goal_outcome}</p>
      </section>

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { icon: Flag, label: 'Nivel', value: LEVEL_LABEL[plan.level] ?? plan.level },
          { icon: Clock, label: 'Duración estimada', value: `${plan.estimated_hours} h` },
          { icon: Clock, label: 'Ritmo', value: `${plan.daily_minutes} min/día` },
          { icon: Layers, label: 'Etapas', value: String(plan.stages.length) },
        ].map((x) => (
          <div key={x.label} className="card p-3">
            <dt className="flex items-center gap-1.5 text-xs text-slate-500">
              <x.icon className="h-3.5 w-3.5" aria-hidden />
              {x.label}
            </dt>
            <dd className="mt-0.5 font-semibold text-slate-900">{x.value}</dd>
          </div>
        ))}
      </dl>

      {data.disclaimer && (
        <div className="mt-4">
          <Disclaimer text={data.disclaimer} />
        </div>
      )}

      <section className="mt-6">
        <h2 className="font-semibold text-slate-900">Enfoque</h2>
        <p className="mt-1 text-slate-700">{plan.approach}</p>
        <p className="mt-1 text-sm text-slate-500">{plan.structure_rationale}</p>
      </section>

      <section className="mt-6" aria-labelledby="stages">
        <h2 id="stages" className="mb-3 font-semibold text-slate-900">
          Etapas
        </h2>
        <ol className="space-y-3">
          {plan.stages.map((s, i) => (
            <li key={i} className="card p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {s.kind_label} · {minutesLabel(s.estimated_minutes)}
                  </p>
                  <h3 className="font-semibold text-slate-900">{s.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{s.objective}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {s.concepts.map((k) => (
                      <span key={k.name} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700" title={k.description}>
                        {k.name}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">Actividades: {s.activity_types.map((t) => ACTIVITY_LABEL[t]).join(' → ')}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-6" aria-labelledby="comps">
        <h2 id="comps" className="mb-2 font-semibold text-slate-900">
          Competencias que desarrollarás
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {plan.competencies.map((c) => (
            <li key={c.name} className="flex gap-2 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
              <span>
                <strong className="text-slate-800">{c.name}.</strong> <span className="text-slate-600">{c.description}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {plan.final_project && (
        <section className="card mt-6 p-4">
          <h2 className="flex items-center gap-2 font-semibold text-slate-900">
            <Trophy className="h-4 w-4 text-amber-500" aria-hidden /> Resultado final: {plan.final_project.title}
          </h2>
          <p className="mt-1 text-sm text-slate-600">{plan.final_project.brief}</p>
        </section>
      )}
      {plan.safety_note && <p className="mt-4 text-sm text-slate-500">{plan.safety_note}</p>}

      {editable ? (
        <div className="no-print sticky bottom-16 z-20 mt-8 md:bottom-4">
          <div className="card space-y-2.5 p-3 shadow-lg sm:space-y-3 sm:p-4">
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" aria-label="Cambios rápidos">
              {CHANGES.map((c) => (
                <button key={c} className="chip shrink-0 text-xs" disabled={busy !== null} onClick={() => revise(c)}>
                  {c}
                </button>
              ))}
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void revise(feedback);
              }}
            >
              <label htmlFor="feedback" className="sr-only">
                ¿Qué quieres cambiar del plan?
              </label>
              <input
                id="feedback"
                className="input"
                placeholder="¿Qué quieres cambiar?"
                value={feedback}
                maxLength={800}
                onChange={(e) => setFeedback(e.target.value)}
                disabled={busy !== null}
              />
              <button type="submit" className="btn-secondary shrink-0" disabled={busy !== null || !feedback.trim()} aria-label="Modificar plan">
                <Pencil className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">{busy === 'revise' ? 'Modificando…' : 'Modificar'}</span>
              </button>
            </form>
            <button className="btn-primary w-full" disabled={busy !== null} onClick={accept}>
              {busy === 'revise' ? 'Actualizando el plan…' : 'Aceptar plan y empezar'}
            </button>
          </div>
        </div>
      ) : (
        <a href={`#/curso/${id}`} className="btn-primary mt-8">
          Ir al curso
        </a>
      )}
    </div>
  );
}
