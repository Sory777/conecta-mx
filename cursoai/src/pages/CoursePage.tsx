import { useState } from 'react';
import { Award, CheckCircle2, Circle, ClipboardCheck, Lock, MessageCircle, PlayCircle, Target, Trophy } from 'lucide-react';
import type { LessonSummary, ModuleDTO } from '../../shared/types';
import { api, ApiError } from '../lib/api';
import { navigate } from '../lib/router';
import { useAsync } from '../lib/useAsync';
import { ACTIVITY_LABEL, LEVEL_LABEL, minutesLabel } from '../lib/format';
import { CompetencyTable } from '../components/CompetencyTable';
import { CourseActions } from '../components/CourseActions';
import { Disclaimer, ErrorBox, MasteryBadge, ProgressBar, Redirect, Spinner, useToast } from '../components/ui';

function LessonRow({ l, locked }: { l: LessonSummary; locked: boolean }) {
  const Icon = l.status === 'completed' ? CheckCircle2 : l.status === 'in_progress' ? PlayCircle : Circle;
  const color = l.status === 'completed' ? 'text-emerald-500' : l.status === 'in_progress' ? 'text-brand-600' : 'text-slate-300';
  const inner = (
    <>
      <Icon className={`h-5 w-5 shrink-0 ${color}`} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-slate-800">{l.title}</span>
        <span className="text-xs text-slate-500">{ACTIVITY_LABEL[l.type]}</span>
      </span>
      <span className="sr-only">{l.status === 'completed' ? 'completada' : l.status === 'in_progress' ? 'en curso' : 'pendiente'}</span>
    </>
  );
  return locked ? (
    <div className="flex items-center gap-3 px-3 py-2.5 opacity-60">{inner}</div>
  ) : (
    <a href={`#/actividad/${l.id}`} className="flex min-h-[48px] items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-slate-50">
      {inner}
    </a>
  );
}

function Stage({ m, index }: { m: ModuleDTO; index: number }) {
  const locked = m.status === 'locked';
  return (
    <li className={`card overflow-hidden ${locked ? 'bg-slate-50' : ''}`}>
      <div className="flex items-start gap-3 p-4">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${m.status === 'completed' ? 'bg-emerald-500 text-white' : locked ? 'bg-slate-200 text-slate-500' : 'bg-brand-600 text-white'}`}
        >
          {m.status === 'completed' ? <CheckCircle2 className="h-4 w-4" aria-label="Completada" /> : locked ? <Lock className="h-4 w-4" aria-label="Bloqueada" /> : index + 1}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {m.kind_label} · {minutesLabel(m.estimated_minutes)}
          </p>
          <h3 className="font-semibold text-slate-900">{m.title}</h3>
          <p className="text-sm text-slate-600">{m.objective}</p>
        </div>
      </div>
      {m.lessons.length > 0 ? (
        <div className="border-t border-slate-100 px-1 py-1">
          {m.lessons.map((l) => (
            <LessonRow key={l.id} l={l} locked={locked} />
          ))}
        </div>
      ) : (
        !locked && <p className="border-t border-slate-100 px-4 py-3 text-sm text-slate-500">Las actividades se crearán al empezar esta etapa.</p>
      )}
      {locked && <p className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">Se desbloquea al superar la etapa anterior. Se adaptará a tu desempeño.</p>}
    </li>
  );
}

export function CoursePage({ id }: { id: string }) {
  const toast = useToast();
  const { data, error, loading, reload } = useAsync(() => api.course(id), [id]);
  const [going, setGoing] = useState(false);

  if (loading && !data) return <Spinner />;
  if (error || !data) return <div className="page"><ErrorBox error={error} onRetry={reload} /></div>;
  const { course } = data;
  if (course.status === 'diagnosing') return <Redirect to={`/curso/${id}/diagnostico`} />;
  if (course.status === 'planning') return <Redirect to={`/curso/${id}/plan`} />;

  async function continueLearning() {
    setGoing(true);
    try {
      const next = await api.next(id);
      if (next.kind === 'lesson') navigate(`/actividad/${next.lesson_id}`);
      else if (next.kind === 'quiz') navigate(`/evaluacion/${next.quiz_id}`);
      else if (next.kind === 'project') navigate(`/curso/${id}/proyecto`);
      else if (next.kind === 'certificate') {
        const cert = await api.issueCertificate(id);
        navigate(`/certificado/${cert.code}`);
      } else {
        toast(next.reason, 'info');
        await reload();
      }
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'No se pudo continuar.', 'error');
    } finally {
      setGoing(false);
    }
  }

  async function practiceExam() {
    setGoing(true);
    try {
      const quiz = await api.createQuiz(id);
      navigate(`/evaluacion/${quiz.id}`);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'No se pudo crear el examen.', 'error');
      setGoing(false);
    }
  }

  const weak = data.concepts.filter((k) => k.state === 'needs_reinforcement');

  return (
    <div className="page space-y-6">
      <section>
        <a href="#/cursos" className="text-sm text-slate-500 hover:text-slate-700">
          ← Mis cursos
        </a>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{course.title}</h1>
          {course.status === 'paused' && <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-700">Pausado</span>}
          {course.status === 'completed' && <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">Terminado</span>}
        </div>
        <p className="mt-2 flex gap-2 text-slate-700">
          <Target className="mt-1 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
          {course.goal_outcome}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          {LEVEL_LABEL[course.level] ?? course.level}
          {course.daily_minutes ? ` · ${course.daily_minutes} min/día` : ''} · <a className="underline" href={`#/curso/${id}/plan`}>ver plan</a>
        </p>
      </section>

      {data.disclaimer && <Disclaimer text={data.disclaimer} />}

      <section className="card space-y-4 p-5">
        <ProgressBar value={course.progress} label="Progreso del curso" />
        <div className="flex flex-col gap-2 sm:flex-row">
          {course.status === 'paused' ? (
            <p className="text-sm text-slate-600">Curso pausado. Reanúdalo para seguir aprendiendo.</p>
          ) : data.certificate ? (
            <a className="btn-primary" href={`#/certificado/${data.certificate.code}`}>
              <Award className="h-5 w-5" aria-hidden /> Ver certificado
            </a>
          ) : (
            <button className="btn-primary" onClick={continueLearning} disabled={going}>
              <PlayCircle className="h-5 w-5" aria-hidden /> {going ? 'Preparando…' : course.progress > 0 ? 'Continuar' : 'Empezar'}
            </button>
          )}
          <a className="btn-secondary" href={`#/curso/${id}/tutor`}>
            <MessageCircle className="h-4 w-4" aria-hidden /> Tutor
          </a>
          {course.status !== 'paused' && (
            <button className="btn-secondary" onClick={practiceExam} disabled={going}>
              <ClipboardCheck className="h-4 w-4" aria-hidden /> Hazme un examen
            </button>
          )}
        </div>
        {weak.length > 0 && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Necesitas reforzar: {weak.map((w) => w.name).join(', ')}. Al continuar tendrás una actividad de refuerzo con otro enfoque.
          </p>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section aria-labelledby="stages-title">
          <h2 id="stages-title" className="mb-3 font-semibold text-slate-900">
            Camino de aprendizaje
          </h2>
          <ol className="space-y-3">
            {data.modules.map((m, i) => (
              <Stage key={m.id} m={m} index={i} />
            ))}
            {data.plan?.plan.final_project && (
              <li className="card p-4">
                <div className="flex items-start gap-3">
                  <Trophy className="h-6 w-6 shrink-0 text-amber-500" aria-hidden />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Proyecto final</p>
                    <h3 className="font-semibold text-slate-900">{data.project?.title ?? data.plan.plan.final_project.title}</h3>
                    {data.project?.last_submission?.passed ? (
                      <p className="text-sm text-emerald-700">Aprobado · {Math.round(data.project.last_submission.score * 100)}%</p>
                    ) : data.modules.every((m) => m.status === 'completed') ? (
                      <a className="text-sm font-semibold text-brand-700" href={`#/curso/${id}/proyecto`}>
                        Abrir proyecto →
                      </a>
                    ) : (
                      <p className="text-sm text-slate-500">Se desbloquea al completar todas las etapas.</p>
                    )}
                  </div>
                </div>
              </li>
            )}
          </ol>
        </section>

        <aside className="space-y-6">
          <section aria-labelledby="mastery-title">
            <h2 id="mastery-title" className="mb-3 font-semibold text-slate-900">
              Dominio por competencia
            </h2>
            <CompetencyTable competencies={data.competencies} />
          </section>
          <section aria-labelledby="concepts-title">
            <h2 id="concepts-title" className="mb-3 font-semibold text-slate-900">
              Conceptos
            </h2>
            <ul className="card divide-y divide-slate-100">
              {data.concepts
                .filter((k) => k.state !== 'not_started')
                .concat(data.concepts.filter((k) => k.state === 'not_started').slice(0, 5))
                .map((k) => (
                  <li key={k.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span className="text-slate-700">{k.name}</span>
                    <MasteryBadge state={k.state} />
                  </li>
                ))}
            </ul>
          </section>
          <section aria-labelledby="manage-title">
            <h2 id="manage-title" className="mb-3 font-semibold text-slate-900">
              Gestionar
            </h2>
            <CourseActions course={course} onChanged={reload} />
          </section>
        </aside>
      </div>
    </div>
  );
}
