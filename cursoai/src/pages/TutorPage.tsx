import { api } from '../lib/api';
import { navigate } from '../lib/router';
import { useAsync } from '../lib/useAsync';
import { TutorPanel } from '../components/TutorPanel';
import { ErrorBox, Spinner, useToast } from '../components/ui';
import { ApiError } from '../lib/api';

export function TutorPage({ id, lesson }: { id: string; lesson: string | null }) {
  const toast = useToast();
  const { data, error, loading, reload } = useAsync(() => api.course(id), [id]);
  if (loading) return <Spinner />;
  if (error || !data) return <div className="page"><ErrorBox error={error} onRetry={reload} /></div>;
  const lessonId = lesson ?? data.course.current_lesson?.id ?? null;
  return (
    <div className="mx-auto flex h-[calc(100dvh-3.5rem-56px)] max-w-3xl flex-col md:h-[calc(100dvh-3.5rem)]">
      <div className="border-b border-slate-200 bg-white px-4 py-3">
        <a href={`#/curso/${id}`} className="text-sm text-slate-500">
          ← {data.course.title}
        </a>
        <h1 className="font-semibold text-slate-900">Tutor personal</h1>
      </div>
      <div className="min-h-0 flex-1">
        <TutorPanel
          courseId={id}
          lessonId={lessonId}
          onQuizRequested={async () => {
            try {
              const q = await api.createQuiz(id);
              navigate(`/evaluacion/${q.id}`);
            } catch (e) {
              toast(e instanceof ApiError ? e.message : 'No se pudo crear el examen.', 'error');
            }
          }}
        />
      </div>
    </div>
  );
}
