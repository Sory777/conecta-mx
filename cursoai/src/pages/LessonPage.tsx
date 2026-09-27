import { useCallback, useState } from 'react';
import { AlertTriangle, ArrowRight, BookOpen, ExternalLink, Lightbulb, MessageCircle, Sparkles, Wand2, X } from 'lucide-react';
import type { AnswerResult, ContentBlock, LessonDTO, NextStep, RegenAction } from '../../shared/types';
import { api, ApiError } from '../lib/api';
import { navigate } from '../lib/router';
import { goToStep } from '../lib/steps';
import { useAsync } from '../lib/useAsync';
import { ACTIVITY_LABEL, formatDate } from '../lib/format';
import { ExerciseCard } from '../components/ExerciseCard';
import { Markdown } from '../components/Markdown';
import { TutorPanel } from '../components/TutorPanel';
import { Disclaimer, ErrorBox, Generating, MasteryBadge, useToast } from '../components/ui';

const REGEN: { action: RegenAction; label: string }[] = [
  { action: 'simpler', label: 'Hazla más sencilla' },
  { action: 'advanced', label: 'Hazla más avanzada' },
  { action: 'more_examples', label: 'Dame más ejemplos' },
  { action: 'more_practical', label: 'Hazla más práctica' },
  { action: 'eli10', label: 'Explícamelo como si tuviera 10 años' },
];

const BLOCK_STYLE: Record<ContentBlock['kind'], string> = {
  text: '',
  example: 'border-l-4 border-sky-400 bg-sky-50/60 pl-4 py-3 pr-3 rounded-r-xl',
  analogy: 'border-l-4 border-violet-400 bg-violet-50/60 pl-4 py-3 pr-3 rounded-r-xl',
  tip: 'border-l-4 border-emerald-400 bg-emerald-50/60 pl-4 py-3 pr-3 rounded-r-xl',
  warning: 'border-l-4 border-amber-400 bg-amber-50/60 pl-4 py-3 pr-3 rounded-r-xl',
  summary: 'rounded-xl bg-slate-100 p-4',
  code: '',
};


export function LessonPage({ id }: { id: string }) {
  const toast = useToast();
  const { data, setData, error, loading, reload } = useAsync(() => api.lesson(id), [id]);
  const [busy, setBusy] = useState<null | 'regen' | 'complete' | 'quiz'>(null);
  const [tutorOpen, setTutorOpen] = useState(false);
  const [prefill, setPrefill] = useState<string | null>(null);
  const [regenOpen, setRegenOpen] = useState(false);
  const [nextStep, setNextStep] = useState<NextStep | null>(null);

  const onAnswered = useCallback(
    (exId: string, r: AnswerResult) => {
      setData((d: LessonDTO | null) =>
        d
          ? {
              ...d,
              exercises: d.exercises.map((e) => (e.id === exId ? { ...e, last_answer: r } : e)),
              concepts: r.mastery ? d.concepts.map((k) => (k.id === r.mastery!.concept_id ? { ...k, state: r.mastery!.state } : k)) : d.concepts,
            }
          : d,
      );
    },
    [setData],
  );

  if (loading && !data) {
    return (
      <div className="page">
        <Generating steps={['Preparando tu actividad…', 'Adaptándola a tu nivel y objetivo…', 'Creando ejercicios prácticos…']} />
      </div>
    );
  }
  if (error || !data) return <div className="page"><ErrorBox error={error} onRetry={reload} /></div>;
  const lesson = data;
  const pending = lesson.exercises.filter((e) => !e.last_answer).length;

  async function regenerate(action: RegenAction | null, fresh: boolean) {
    setBusy('regen');
    setRegenOpen(false);
    try {
      setData(fresh && action ? await api.regenerate(id, action) : await api.variant(id, action));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'No se pudo modificar la actividad.', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function complete() {
    setBusy('complete');
    try {
      const r = await api.completeLesson(id);
      setNextStep(r.next);
      setData({ ...lesson, status: 'completed' });
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'No se pudo terminar la actividad.', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function exam() {
    setBusy('quiz');
    try {
      const quiz = await api.createQuiz(lesson.course_id, lesson.module_id);
      navigate(`/evaluacion/${quiz.id}`);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'No se pudo crear el examen.', 'error');
      setBusy(null);
    }
  }

  function askTutor(message: string) {
    setPrefill(message);
    setTutorOpen(true);
  }

  return (
    <div className="page max-w-3xl pb-44 md:pb-24">
      <a href={`#/curso/${lesson.course_id}`} className="text-sm text-slate-500 hover:text-slate-700">
        ← Volver al curso
      </a>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-brand-700">{ACTIVITY_LABEL[lesson.type]}</p>
      <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">{lesson.title}</h1>
      {lesson.goal && <p className="mt-1 text-slate-600">{lesson.goal}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {lesson.concepts.map((k) => (
          <span key={k.id} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white py-0.5 pl-2.5 pr-1 text-xs text-slate-700">
            {k.name} <MasteryBadge state={k.state} />
          </span>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        {lesson.disclaimer && <Disclaimer text={lesson.disclaimer} />}
        {lesson.verification_note && (
          <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {lesson.verification_note}
          </div>
        )}
        {lesson.info_kind === 'current' && lesson.verified_at && (
          <p className="text-xs text-slate-500">Información actualizada con fuentes externas · consultadas el {formatDate(lesson.verified_at)}</p>
        )}
      </div>

      {/* Regeneration */}
      <div className="no-print mt-4 flex flex-wrap items-center gap-2">
        <button className="btn-secondary text-xs" onClick={() => setRegenOpen((o) => !o)} aria-expanded={regenOpen} disabled={busy !== null}>
          <Wand2 className="h-4 w-4" aria-hidden /> {busy === 'regen' ? 'Reescribiendo…' : 'Cambiar esta actividad'}
        </button>
        {(lesson.available_variants.length > 0 || lesson.active_variant) && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Versiones">
            <button className={`chip text-xs ${!lesson.active_variant ? 'border-brand-600 text-brand-700' : ''}`} onClick={() => regenerate(null, false)} disabled={busy !== null}>
              Original
            </button>
            {lesson.available_variants.map((v) => (
              <button
                key={v}
                className={`chip text-xs ${lesson.active_variant === v ? 'border-brand-600 text-brand-700' : ''}`}
                onClick={() => regenerate(v, false)}
                disabled={busy !== null}
              >
                {REGEN.find((r) => r.action === v)?.label ?? v}
              </button>
            ))}
          </div>
        )}
      </div>
      {regenOpen && (
        <div className="card mt-2 flex flex-wrap gap-2 p-3">
          {REGEN.map((r) => (
            <button key={r.action} className="chip text-xs" onClick={() => regenerate(r.action, !lesson.available_variants.includes(r.action))}>
              {r.label}
            </button>
          ))}
          <button className="chip text-xs" onClick={() => regenerate('more_practical', !lesson.available_variants.includes('more_practical'))}>
            Convierte esto en un ejercicio
          </button>
          <button className="chip text-xs" onClick={exam}>
            Hazme un examen
          </button>
        </div>
      )}

      {busy === 'regen' ? (
        <div className="mt-6">
          <Generating steps={['Reescribiendo solo esta actividad…', 'Manteniendo el resto de tu curso intacto…']} />
        </div>
      ) : (
        <>
          <article className="mt-6 space-y-5 text-slate-800">
            {lesson.intro && <p className="text-lg text-slate-700">{lesson.intro}</p>}
            {lesson.blocks.map((b, i) => (
              <section key={i} className={BLOCK_STYLE[b.kind]}>
                {b.title && (
                  <h2 className="mb-1 flex items-center gap-1.5 font-semibold text-slate-900">
                    {b.kind === 'tip' && <Lightbulb className="h-4 w-4 text-emerald-600" aria-hidden />}
                    {b.kind === 'analogy' && <Sparkles className="h-4 w-4 text-violet-600" aria-hidden />}
                    {b.kind === 'example' && <BookOpen className="h-4 w-4 text-sky-600" aria-hidden />}
                    {b.title}
                  </h2>
                )}
                {b.kind === 'code' ? (
                  <pre className="overflow-x-auto rounded-xl bg-slate-900 p-4 text-sm text-slate-100" aria-label={`Código ${'language' in b ? b.language : ''}`}>
                    <code>{b.body}</code>
                  </pre>
                ) : (
                  <Markdown text={b.body} />
                )}
              </section>
            ))}
          </article>

          {lesson.sources.length > 0 && (
            <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4" aria-labelledby="sources">
              <h2 id="sources" className="text-sm font-semibold text-slate-900">
                Fuentes consultadas
              </h2>
              <ul className="mt-2 space-y-1.5 text-sm">
                {lesson.sources.map((s) => (
                  <li key={s.url} className="flex gap-1.5">
                    <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                    <span>
                      <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="text-brand-700 underline">
                        {s.title || s.url}
                      </a>
                      <span className="text-slate-500">
                        {' '}
                        · {s.page_age ? `publicada ${s.page_age} · ` : ''}consultada {formatDate(s.retrieved_at)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {lesson.exercises.length > 0 && (
            <section className="mt-8 space-y-4" aria-labelledby="practice">
              <h2 id="practice" className="text-lg font-semibold text-slate-900">
                Practica
              </h2>
              {lesson.exercises.map((ex, i) => (
                <ExerciseCard key={`${lesson.active_variant ?? 'o'}-${ex.id}`} exercise={ex} index={i} onAnswered={onAnswered} onAskTutor={askTutor} />
              ))}
            </section>
          )}

          <div className="no-print mt-8">
            {nextStep ? (
              <div className="card flex flex-col gap-3 border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between" role="status">
                <p className="text-sm text-emerald-900">{nextStep.reason}</p>
                <button className="btn-primary shrink-0" onClick={() => goToStep(nextStep, lesson.course_id)}>
                  Siguiente <ArrowRight className="h-4 w-4" aria-hidden />
                </button>
              </div>
            ) : (
              <button className="btn-primary w-full sm:w-auto" onClick={complete} disabled={busy !== null || pending > 0}>
                {busy === 'complete'
                  ? 'Guardando…'
                  : pending > 0
                    ? `Responde ${pending} ejercicio${pending > 1 ? 's' : ''} para continuar`
                    : lesson.status === 'completed'
                      ? 'Continuar con lo siguiente'
                      : 'Terminar y continuar'}
                {pending === 0 && <ArrowRight className="h-4 w-4" aria-hidden />}
              </button>
            )}
          </div>
        </>
      )}

      {/* Tutor */}
      <button
        className="no-print fixed bottom-20 right-4 z-30 flex h-14 items-center gap-2 rounded-full bg-brand-600 px-5 font-semibold text-white shadow-lg hover:bg-brand-700 md:bottom-6"
        onClick={() => setTutorOpen(true)}
        aria-label="Abrir tutor"
      >
        <MessageCircle className="h-5 w-5" aria-hidden /> <span className="hidden sm:inline">Tutor</span>
      </button>
      {tutorOpen && (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/30" onClick={() => setTutorOpen(false)}>
          <aside
            className="flex h-full w-full flex-col bg-slate-50 shadow-xl sm:max-w-md"
            onClick={(e) => e.stopPropagation()}
            aria-label="Tutor personal"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
              <div>
                <p className="font-semibold text-slate-900">Tutor personal</p>
                <p className="text-xs text-slate-500">Conoce tu curso y esta actividad</p>
              </div>
              <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={() => setTutorOpen(false)} aria-label="Cerrar tutor">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <TutorPanel courseId={lesson.course_id} lessonId={lesson.id} prefill={prefill} onQuizRequested={exam} />
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
