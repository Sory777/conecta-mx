// Rule-based grading for auto-correctable exercises (no AI cost) and the
// storage format for answer keys.

import type { ExerciseKind } from '../../shared/types';
import type { ExerciseOut } from '../ai/schemas';

export type AnswerKey = { index: number } | { value: boolean } | { reference: string };

export const AUTO_GRADED: ReadonlySet<ExerciseKind> = new Set(['multiple_choice', 'true_false']);

/** Normalise an AI-produced exercise; returns null if it is unusable. */
export function normalizeExercise(ex: ExerciseOut): { kind: ExerciseKind; options: string[]; key: AnswerKey } | null {
  if (ex.kind === 'multiple_choice') {
    const options = ex.options.map((o) => o.trim()).filter(Boolean).slice(0, 6);
    const idx = ex.correct_option_index;
    if (options.length < 2 || idx === null || idx < 0 || idx >= options.length) return null;
    return { kind: 'multiple_choice', options, key: { index: idx } };
  }
  if (ex.kind === 'true_false') {
    if (ex.correct_boolean === null) return null;
    return { kind: 'true_false', options: [], key: { value: ex.correct_boolean } };
  }
  if (!ex.prompt.trim()) return null;
  return { kind: ex.kind, options: [], key: { reference: ex.reference_answer } };
}

export function gradeAuto(
  kind: ExerciseKind,
  key: AnswerKey,
  options: string[],
  response: string,
): { verdict: 'correct' | 'incorrect'; score: number; correct_answer: string } | null {
  const r = response.trim().toLowerCase();
  if (kind === 'multiple_choice' && 'index' in key) {
    const chosen = Number.parseInt(r, 10);
    if (!Number.isInteger(chosen) || chosen < 0 || chosen >= options.length) return null;
    const ok = chosen === key.index;
    return { verdict: ok ? 'correct' : 'incorrect', score: ok ? 1 : 0, correct_answer: options[key.index] };
  }
  if (kind === 'true_false' && 'value' in key) {
    const val = ['true', 'verdadero', 'v'].includes(r) ? true : ['false', 'falso', 'f'].includes(r) ? false : null;
    if (val === null) return null;
    const ok = val === key.value;
    return { verdict: ok ? 'correct' : 'incorrect', score: ok ? 1 : 0, correct_answer: key.value ? 'Verdadero' : 'Falso' };
  }
  return null;
}

export function verdictFor(score: number): 'correct' | 'partial' | 'incorrect' {
  return score >= 0.8 ? 'correct' : score >= 0.4 ? 'partial' : 'incorrect';
}
