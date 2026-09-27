import { useState } from 'react';
import { BookOpen, PlayCircle } from 'lucide-react';
import type { CourseSummary } from '../../shared/types';
import { api } from '../lib/api';
import { navigate } from '../lib/router';
import { useAsync } from '../lib/useAsync';
import { relativeTime } from '../lib/format';
import { CourseActions } from '../components/CourseActions';
import { EmptyState, ErrorBox, ProgressBar, Spinner } from '../components/ui';

const FILTERS: { key: string; label: string; test: (c: CourseSummary) => boolean }[] = [
  { key: 'all', label: 'Todos', test: () => true },
  { key: 'active', label: 'Activos', test: (c) => c.status === 'active' },
  { key: 'planning', label: 'Por empezar', test: (c) => c.status === 'planning' || c.status === 'diagnosing' },
  { key: 'paused', label: 'Pausados', test: (c) => c.status === 'paused' },
  { key: 'completed', label: 'Terminados', test: (c) => c.status === 'completed' },
  { key: 'shared', label: 'Compartidos', test: (c) => c.shared || Boolean(c.source_course_id) },
];

const STATUS: Record<CourseSummary['status'], string> = {
  diagnosing: 'Diagnóstico pendiente',
  planning: 'Plan por aceptar',
  active: 'Activo',
  paused: 'Pausado',
  completed: 'Terminado',
};

function openHref(c: CourseSummary) {
  if (c.status === 'diagnosing') return `#/curso/${c.id}/diagnostico`;
  if (c.status === 'planning') return `#/curso/${c.id}/plan`;
  if (c.current_lesson && c.status === 'active') return `#/actividad/${c.current_lesson.id}`;
  return `#/curso/${c.id}`;
}

export function LibraryPage() {
  const { data, error, loading, reload } = useAsync(() => api.courses(), []);
  const [filter, setFilter] = useState('all');
  const [code, setCode] = useState('');
  if (loading && !data) return <Spinner />;
  if (error || !data) return <div className="page"><ErrorBox error={error} onRetry={reload} /></div>;
  const f = FILTERS.find((x) => x.key === filter)!;
  const list = data.courses.filter(f.test);

  return (
    <div className="page space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Mis cursos</h1>
        <a href="#/nuevo" className="btn-primary">
          Crear nuevo curso
        </a>
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label="Filtrar cursos">
        {FILTERS.map((x) => {
          const n = data.courses.filter(x.test).length;
          return (
            <button
              key={x.key}
              role="tab"
              aria-selected={filter === x.key}
              className={`chip shrink-0 ${filter === x.key ? 'border-brand-600 bg-brand-600 text-white hover:text-white' : ''}`}
              onClick={() => setFilter(x.key)}
            >
              {x.label} <span className="ml-1 opacity-70">{n}</span>
            </button>
          );
        })}
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-6 w-6" />}
          title={filter === 'all' ? 'Tu biblioteca está vacía' : 'No hay cursos en esta categoría'}
          text={filter === 'all' ? 'Crea tu primer curso escribiendo lo que quieres aprender o conseguir.' : 'Prueba con otro filtro.'}
          action={filter === 'all' ? <a className="btn-primary" href="#/">Crear curso</a> : undefined}
        />
      ) : (
        <ul className="space-y-3">
          {list.map((c) => (
            <li key={c.id} className="card p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {STATUS[c.status]}
                    {c.shared ? ' · Compartido' : ''}
                    {c.source_course_id ? ' · Importado/duplicado' : ''}
                  </p>
                  <a href={`#/curso/${c.id}`} className="text-lg font-semibold text-slate-900 hover:text-brand-700">
                    {c.title}
                  </a>
                  <p className="line-clamp-2 text-sm text-slate-600">{c.goal_outcome || c.goal}</p>
                  <p className="mt-1 text-xs text-slate-500">Última actividad {relativeTime(c.last_activity_at)}</p>
                </div>
                <a className="btn-primary shrink-0" href={openHref(c)}>
                  <PlayCircle className="h-4 w-4" aria-hidden /> {c.status === 'completed' ? 'Ver' : c.status === 'active' ? 'Continuar' : 'Abrir'}
                </a>
              </div>
              {(c.status === 'active' || c.status === 'paused' || c.status === 'completed') && (
                <div className="mt-3">
                  <ProgressBar value={c.progress} label={`${c.mastered_concepts}/${c.total_concepts} conceptos dominados`} />
                </div>
              )}
              <div className="mt-3 border-t border-slate-100 pt-3">
                <CourseActions course={c} onChanged={reload} compact />
              </div>
            </li>
          ))}
        </ul>
      )}

      <section className="card p-4" aria-labelledby="import">
        <h2 id="import" className="font-semibold text-slate-900">
          ¿Te compartieron un curso?
        </h2>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const c = code.trim().replace(/.*compartido\//, '').toUpperCase();
            if (c) navigate(`/compartido/${c}`);
          }}
        >
          <label htmlFor="share-code" className="sr-only">
            Código o enlace
          </label>
          <input id="share-code" className="input" placeholder="Pega el código o el enlace" value={code} onChange={(e) => setCode(e.target.value)} />
          <button className="btn-secondary shrink-0" type="submit" disabled={!code.trim()}>
            Ver
          </button>
        </form>
      </section>
    </div>
  );
}
