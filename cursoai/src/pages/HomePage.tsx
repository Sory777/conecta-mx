import { useState } from 'react';
import { ArrowRight, BookOpen, Brain, CheckCircle2, Lightbulb, PlayCircle, Plus, Target, TrendingUp } from 'lucide-react';
import { api } from '../lib/api';
import { pendingRequest, useAuth } from '../lib/auth';
import { navigate } from '../lib/router';
import { useAsync } from '../lib/useAsync';
import { relativeTime } from '../lib/format';
import { EmptyState, ErrorBox, ProgressBar, Spinner } from '../components/ui';
import type { CourseSummary } from '../../shared/types';

const EXAMPLES = [
  'Quiero aprender Excel para conseguir trabajo',
  'Quiero aprender inglés para poder conversar',
  'Quiero aprender Python desde cero',
  'Quiero aprender finanzas personales para administrar mejor mi dinero',
  'Quiero aprender marketing digital para vender en mi negocio',
];

export function GoalInput({ autoFocus = false }: { autoFocus?: boolean }) {
  const { user } = useAuth();
  const [q, setQ] = useState('');
  function go(text: string) {
    const t = text.trim();
    if (!t) return;
    if (!user) {
      pendingRequest.set(t);
      navigate('/registro');
      return;
    }
    navigate(`/nuevo?q=${encodeURIComponent(t)}`);
  }
  return (
    <div>
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          go(q);
        }}
      >
        <label htmlFor="goal" className="sr-only">
          ¿Qué quieres aprender o conseguir?
        </label>
        <input
          id="goal"
          className="input h-14 text-base sm:text-lg"
          placeholder="Quiero aprender…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          maxLength={600}
          autoFocus={autoFocus}
          autoComplete="off"
        />
        <button type="submit" className="btn-primary h-14 px-6 text-base" disabled={!q.trim()}>
          Empezar <ArrowRight className="h-5 w-5" aria-hidden />
        </button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2" aria-label="Ejemplos">
        {EXAMPLES.map((e) => (
          <button key={e} type="button" className="chip text-xs sm:text-sm" onClick={() => setQ(e)}>
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}

function Landing() {
  const steps = [
    { icon: Target, title: 'Entiende tu objetivo', text: 'No solo el tema: para qué lo quieres, tu nivel y tu tiempo.' },
    { icon: Lightbulb, title: 'Crea tu camino', text: 'Un plan con la estructura que tu tema necesita, que puedes ajustar.' },
    { icon: Brain, title: 'Te enseña haciendo', text: 'Explicaciones breves, práctica real y un tutor que te conoce.' },
    { icon: TrendingUp, title: 'Se adapta a ti', text: 'Detecta lo que te cuesta y lo refuerza con otro enfoque.' },
  ];
  return (
    <div className="page">
      <section className="py-8 sm:py-14">
        <h1 className="max-w-3xl text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl">¿Qué quieres aprender o conseguir?</h1>
        <p className="mt-3 max-w-2xl text-lg text-slate-600">
          Dile a la IA tu objetivo. Diseña tu camino de aprendizaje, te enseña, comprueba lo que aprendes y se adapta hasta que lo consigas.
        </p>
        <div className="mt-8 max-w-3xl">
          <GoalInput autoFocus />
        </div>
      </section>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Cómo funciona">
        {steps.map((s) => (
          <div key={s.title} className="card p-5">
            <s.icon className="h-6 w-6 text-brand-600" aria-hidden />
            <h2 className="mt-3 font-semibold text-slate-900">{s.title}</h2>
            <p className="mt-1 text-sm text-slate-600">{s.text}</p>
          </div>
        ))}
      </section>
      <p className="mt-8 text-center text-sm text-slate-500">
        ¿Ya tienes cuenta?{' '}
        <a className="font-semibold text-brand-700" href="#/entrar">
          Entra aquí
        </a>
      </p>
    </div>
  );
}

function CourseMini({ c }: { c: CourseSummary }) {
  return (
    <a href={`#/curso/${c.id}`} className="card block p-4 transition hover:border-brand-500">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-slate-900">{c.title}</h3>
        {c.weak_concepts > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">Refuerzo</span>}
      </div>
      <p className="mt-1 line-clamp-2 text-sm text-slate-500">{c.goal_outcome || c.goal}</p>
      <div className="mt-3">
        <ProgressBar value={c.progress} label={`${c.mastered_concepts} de ${c.total_concepts} conceptos dominados`} />
      </div>
    </a>
  );
}

function Dashboard() {
  const { data, error, loading, reload } = useAsync(() => api.dashboard(), []);
  if (loading) return <Spinner />;
  if (error || !data) return <div className="page"><ErrorBox error={error} onRetry={reload} /></div>;
  const active = data.courses.filter((c) => c.status === 'active');
  const firstName = data.user.name.split(' ')[0];
  return (
    <div className="page space-y-8">
      <section>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {firstName ? `Hola, ${firstName}. ` : ''}¿Qué quieres aprender o conseguir?
        </h1>
        <div className="mt-4">
          <GoalInput />
        </div>
      </section>

      {data.resume && (
        <section className="card flex flex-col gap-4 border-brand-100 bg-gradient-to-br from-brand-50 to-white p-5 sm:flex-row sm:items-center sm:justify-between" aria-labelledby="resume-title">
          <div>
            <h2 id="resume-title" className="text-sm font-semibold uppercase tracking-wide text-brand-700">
              Continuar aprendiendo
            </h2>
            <p className="mt-1 text-slate-800">{data.resume.message}</p>
          </div>
          <a
            className="btn-primary shrink-0"
            href={data.resume.lesson_id ? `#/actividad/${data.resume.lesson_id}` : `#/curso/${data.resume.course_id}`}
          >
            <PlayCircle className="h-5 w-5" aria-hidden /> Continuar
          </a>
        </section>
      )}

      {data.recommendations.length > 0 && (
        <section aria-labelledby="rec-title">
          <h2 id="rec-title" className="mb-3 font-semibold text-slate-900">
            Recomendado para ti
          </h2>
          <ul className="space-y-2">
            {data.recommendations.map((r, i) => (
              <li key={i}>
                <a href={`#/curso/${r.course_id}`} className="card flex items-center gap-3 p-3.5 text-sm text-slate-700 hover:border-brand-500">
                  <Lightbulb className="h-5 w-5 shrink-0 text-amber-500" aria-hidden />
                  <span className="flex-1">{r.text}</span>
                  <ArrowRight className="h-4 w-4 text-slate-400" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="courses-title">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="courses-title" className="font-semibold text-slate-900">
            Mis cursos
          </h2>
          <a href="#/cursos" className="text-sm font-semibold text-brand-700">
            Ver todos
          </a>
        </div>
        {data.courses.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="h-6 w-6" />}
            title="Aún no tienes cursos"
            text="Escribe arriba lo que quieres aprender o conseguir y la IA creará tu primer camino de aprendizaje."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {(active.length ? active : data.courses).slice(0, 4).map((c) => (
              <CourseMini key={c.id} c={c} />
            ))}
            <button className="card flex min-h-[120px] items-center justify-center gap-2 border-dashed p-4 text-sm font-semibold text-brand-700 hover:border-brand-500" onClick={() => document.getElementById('goal')?.focus()}>
              <Plus className="h-5 w-5" aria-hidden /> Crear nuevo curso
            </button>
          </div>
        )}
        {data.courses.some((c) => c.status === 'completed') && (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-slate-500">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden />
            {data.courses.filter((c) => c.status === 'completed').length} curso(s) terminado(s). Última actividad {relativeTime(data.courses[0].last_activity_at)}.
          </p>
        )}
      </section>
    </div>
  );
}

export function HomePage() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  return user ? <Dashboard /> : <Landing />;
}
