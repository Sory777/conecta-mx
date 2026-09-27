import { useState } from 'react';
import { ArrowRight, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import type { QuizResult } from '../../shared/types';
import { api, ApiError } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { EXERCISE_LABEL } from '../lib/format';
import { Markdown } from '../components/Markdown';
import { ErrorBox, Generating, MasteryBadge, Spinner, useToast } from '../components/ui';
import { goToStep } from '../lib/steps';

const ICON = { correct: CheckCircle2, partial: AlertCircle, incorrect: XCircle };
const COLOR = { correct: 'text-emerald-600', partial: 'text-amber-600', incorrect: 'text-rose-600' };

export function QuizPage({ id }: { id: string }) {
  const toast = useToast();
  const { data, error, loading, reload } = useAsync(() => api.quiz(id), [id]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <Spinner />;
  if (error || !data) return <div className="page"><ErrorBox error={error} onRetry={reload} /></div>;
  const quiz = data;
  const shown = result ?? (quiz.kind !== 'stage' ? quiz.last_result : null);
  const byId = new Map(shown?.results.map((r) => [r.question_id, r]) ?? []);
  const missing = quiz.questions.filter((q) => !answers[q.id]?.trim()).length;

  async function submit() {
    setBusy(true);
    try {
      const r = await api.submitQuiz(id, answers);
      setResult(r);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'No se pudo enviar la evaluación.', 'error');
    } finally {
      setBusy(false);
    }
  }

  if (busy) {
    return (
      <div className="page">
        <Generating steps={['Revisando tus respuestas…', 'Evaluando tus respuestas abiertas…', 'Actualizando tu dominio de conceptos…']} />
      </div>
    );
  }

  return (
    <div className="page max-w-3xl">
      <a href={`#/curso/${quiz.course_id}`} className="text-sm text-slate-500 hover:text-slate-700">
        ← Volver al curso
      </a>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-brand-700">
        {quiz.kind === 'stage' ? 'Evaluación de etapa' : 'Examen de práctica'}
      </p>
      <h1 className="mt-1 text-2xl font-bold text-slate-900">{quiz.title}</h1>
      {!shown && <p className="mt-1 text-slate-600">{quiz.questions.length} preguntas. Necesitas {Math.round(quiz.pass_score * 100)}% para aprobar.</p>}

      {shown && (
        <section className={`card mt-5 p-5 ${shown.passed ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`} role="status">
          <p className="text-3xl font-bold text-slate-900">{Math.round(shown.score * 100)}%</p>
          <p className="mt-1 font-medium text-slate-800">
            {shown.passed ? '¡Aprobado! Demostraste que puedes aplicar lo aprendido.' : 'Aún no. Revisa el feedback: prepararemos un refuerzo sobre lo que te costó.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {result?.next ? (
              <button className="btn-primary" onClick={() => goToStep(result.next!, quiz.course_id)}>
                Continuar <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
            ) : (
              <a className="btn-primary" href={`#/curso/${quiz.course_id}`}>
                Volver al curso
              </a>
            )}
          </div>
        </section>
      )}

      <ol className="mt-6 space-y-4">
        {quiz.questions.map((q, i) => {
          const r = byId.get(q.id);
          const Icon = r ? ICON[r.verdict] : null;
          return (
            <li key={q.id} className="card p-4 sm:p-5">
              <div className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <span>
                  Pregunta {i + 1} · {EXERCISE_LABEL[q.kind]}
                </span>
                {r && Icon && (
                  <span className={`flex items-center gap-1 normal-case ${COLOR[r.verdict]}`}>
                    <Icon className="h-4 w-4" aria-hidden /> {Math.round(r.score * 100)}%
                  </span>
                )}
              </div>
              <div className="font-medium text-slate-900">
                <Markdown text={q.prompt} />
              </div>
              {q.context && (
                <div className="mt-2 rounded-xl bg-slate-50 p-3 text-sm">
                  <Markdown text={q.context} />
                </div>
              )}
              {!shown && (
                <div className="mt-3">
                  {q.kind === 'multiple_choice' ? (
                    <fieldset className="space-y-2">
                      <legend className="sr-only">Opciones</legend>
                      {q.options.map((o, j) => (
                        <label key={j} className={`flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm ${answers[q.id] === String(j) ? 'border-brand-500 bg-brand-50' : 'border-slate-200'}`}>
                          <input type="radio" name={q.id} className="h-4 w-4 accent-brand-600" checked={answers[q.id] === String(j)} onChange={() => setAnswers((a) => ({ ...a, [q.id]: String(j) }))} />
                          {o}
                        </label>
                      ))}
                    </fieldset>
                  ) : q.kind === 'true_false' ? (
                    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Verdadero o falso">
                      {[
                        ['true', 'Verdadero'],
                        ['false', 'Falso'],
                      ].map(([v, l]) => (
                        <button
                          key={v}
                          role="radio"
                          aria-checked={answers[q.id] === v}
                          className={`btn-secondary ${answers[q.id] === v ? 'border-brand-600 bg-brand-50 text-brand-700' : ''}`}
                          onClick={() => setAnswers((a) => ({ ...a, [q.id]: v }))}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <>
                      <label className="sr-only" htmlFor={`qa-${q.id}`}>
                        Tu respuesta
                      </label>
                      <textarea
                        id={`qa-${q.id}`}
                        className={`input min-h-[100px] ${q.kind === 'code' ? 'font-mono text-sm' : ''}`}
                        value={answers[q.id] ?? ''}
                        maxLength={8000}
                        onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                        placeholder="Escribe tu respuesta…"
                      />
                    </>
                  )}
                </div>
              )}
              {r && (
                <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                  <Markdown text={r.feedback} />
                  {r.correct_answer && r.verdict !== 'correct' && (
                    <p className="mt-1">
                      Respuesta correcta: <strong>{r.correct_answer}</strong>
                    </p>
                  )}
                  {r.mastery && (
                    <p className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                      Concepto: <MasteryBadge state={r.mastery.state} />
                    </p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {!shown && (
        <button className="btn-primary mt-6 w-full sm:w-auto" disabled={missing > 0} onClick={submit}>
          {missing > 0 ? `Faltan ${missing} respuesta${missing > 1 ? 's' : ''}` : 'Enviar evaluación'}
        </button>
      )}
    </div>
  );
}
