import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { navigate } from '../lib/router';
import { ErrorBox, Generating } from '../components/ui';
import { GoalInput } from './HomePage';

export function NewCoursePage({ q }: { q: string }) {
  const [phase, setPhase] = useState<'intake' | 'plan'>('intake');
  const [error, setError] = useState<unknown>(null);
  const started = useRef<string | null>(null);

  async function run(request: string) {
    setError(null);
    setPhase('intake');
    try {
      const { course_id, intake } = await api.createCourse(request);
      if (intake.questions.length > 0) {
        navigate(`/curso/${course_id}/diagnostico`, true);
        return;
      }
      setPhase('plan');
      await api.createPlan(course_id, {});
      navigate(`/curso/${course_id}/plan`, true);
    } catch (e) {
      setError(e);
    }
  }

  useEffect(() => {
    if (q && started.current !== q) {
      started.current = q;
      void run(q);
    }
  }, [q]);

  if (!q) {
    return (
      <div className="page">
        <h1 className="mb-4 text-2xl font-bold text-slate-900">Crear nuevo curso</h1>
        <GoalInput autoFocus />
      </div>
    );
  }
  return (
    <div className="page">
      <p className="mb-6 text-center text-slate-500">
        «{q}»
      </p>
      {error ? (
        <ErrorBox error={error} onRetry={() => run(q)} />
      ) : phase === 'intake' ? (
        <Generating steps={['Entendiendo tu objetivo…', 'Identificando el tema y tu meta…', 'Revisando si necesito preguntarte algo…']} />
      ) : (
        <Generating steps={['Diseñando tu camino de aprendizaje…', 'Eligiendo la mejor estructura para este tema…', 'Definiendo competencias y etapas…', 'Ajustando a tu nivel y tiempo…']} />
      )}
    </div>
  );
}
