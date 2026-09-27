import type { ActivityType, ExerciseKind, MasteryState } from '../../shared/types';

export const MASTERY_LABEL: Record<MasteryState, string> = {
  not_started: 'No iniciado',
  learning: 'En aprendizaje',
  needs_reinforcement: 'Necesita refuerzo',
  mastered: 'Dominado',
};

export const ACTIVITY_LABEL: Record<ActivityType, string> = {
  lesson: 'Lección',
  practice: 'Práctica',
  simulation: 'Simulación',
  conversation: 'Conversación',
  case: 'Caso real',
  challenge: 'Reto',
  project: 'Proyecto',
  reinforcement: 'Refuerzo',
  quiz: 'Evaluación',
};

export const EXERCISE_LABEL: Record<ExerciseKind, string> = {
  multiple_choice: 'Opción múltiple',
  true_false: 'Verdadero o falso',
  short_answer: 'Respuesta escrita',
  problem: 'Problema',
  code: 'Código',
  scenario: 'Escenario',
  conversation: 'Conversación',
};

export const LEVEL_LABEL: Record<string, string> = {
  beginner: 'Principiante',
  intermediate: 'Intermedio',
  advanced: 'Avanzado',
};

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return 'justo ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  if (d === 1) return 'ayer';
  if (d < 30) return `hace ${d} días`;
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function minutesLabel(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
