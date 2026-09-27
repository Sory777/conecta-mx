import type { NextStep } from '../../shared/types';
import { navigate } from './router';

/** Navigate to whatever the adaptive policy says comes next. */
export function goToStep(next: NextStep, courseId: string) {
  if (next.kind === 'lesson') navigate(`/actividad/${next.lesson_id}`);
  else if (next.kind === 'quiz') navigate(`/evaluacion/${next.quiz_id}`);
  else if (next.kind === 'project') navigate(`/curso/${courseId}/proyecto`);
  else navigate(`/curso/${courseId}`);
}
