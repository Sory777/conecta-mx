import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { api } from '../lib/api';
import { navigate } from '../lib/router';
import { useAsync } from '../lib/useAsync';
import { LEVEL_LABEL } from '../lib/format';
import { ErrorBox, Generating, Redirect, Spinner } from '../components/ui';

export function DiagnosisPage({ id }: { id: string }) {
  const { data, error, loading, reload } = useAsync(() => api.course(id), [id]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [planError, setPlanError] = useState<unknown>(null);

  if (loading) return <Spinner />;
  if (error || !data) return <div className="page"><ErrorBox error={error} onRetry={reload} /></div>;
  if (data.course.status !== 'diagnosing') {
    return <Redirect to={data.course.status === 'planning' ? `/curso/${id}/plan` : `/curso/${id}`} />;
  }
  const intake = data.course.intake!;

  async function createPlan(skip = false) {
    setBusy(true);
    setPlanError(null);
    try {
      await api.createPlan(id, skip ? {} : answers);
      navigate(`/curso/${id}/plan`, true);
    } catch (e) {
      setPlanError(e);
      setBusy(false);
    }
  }

  if (busy) {
    return (
      <div className="page">
        <Generating steps={['Diseñando tu camino de aprendizaje…', 'Eligiendo la mejor estructura para este tema…', 'Definiendo competencias y etapas…']} />
      </div>
    );
  }

  return (
    <div className="page max-w-2xl">
      <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Diagnóstico rápido</p>
      <h1 className="mt-1 text-2xl font-bold text-slate-900">Un par de preguntas para acertar con tu plan</h1>

      <div className="card mt-5 grid gap-3 p-4 text-sm sm:grid-cols-3">
        <div>
          <p className="text-slate-500">Tema</p>
          <p className="font-semibold text-slate-900">{intake.topic}</p>
        </div>
        <div>
          <p className="text-slate-500">Objetivo</p>
          <p className="font-semibold text-slate-900">{intake.goal}</p>
        </div>
        <div>
          <p className="text-slate-500">Nivel</p>
          <p className="font-semibold text-slate-900">{intake.level ? LEVEL_LABEL[intake.level] : 'Por definir'}</p>
        </div>
      </div>

      <form
        className="mt-6 space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          void createPlan();
        }}
      >
        {intake.questions.map((q, i) => (
          <fieldset key={q.id}>
            <legend className="mb-2 font-semibold text-slate-900">
              {i + 1}. {q.question}
            </legend>
            <div className="flex flex-wrap gap-2">
              {q.options.map((o) => {
                const on = answers[q.id] === o;
                return (
                  <button
                    type="button"
                    key={o}
                    aria-pressed={on}
                    className={`chip ${on ? 'border-brand-600 bg-brand-600 text-white hover:text-white' : ''}`}
                    onClick={() => setAnswers((a) => ({ ...a, [q.id]: o }))}
                  >
                    {o}
                  </button>
                );
              })}
            </div>
            <label className="sr-only" htmlFor={`q-${q.id}`}>
              Otra respuesta
            </label>
            <input
              id={`q-${q.id}`}
              className="input mt-2"
              placeholder="O escribe tu respuesta…"
              maxLength={300}
              value={q.options.includes(answers[q.id] ?? '') ? '' : answers[q.id] ?? ''}
              onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
            />
          </fieldset>
        ))}
        {planError !== null && <ErrorBox error={planError} />}
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="submit" className="btn-primary">
            Crear mi plan <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
          <button type="button" className="btn-ghost" onClick={() => createPlan(true)}>
            Saltar y usar valores recomendados
          </button>
        </div>
      </form>
    </div>
  );
}
