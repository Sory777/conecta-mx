import { describe, expect, it } from 'vitest';
import { gradeAuto, normalizeExercise, verdictFor } from '../../worker/services/grading';
import type { ExerciseOut } from '../../worker/ai/schemas';

const base: ExerciseOut = {
  kind: 'multiple_choice',
  concept: 'X',
  prompt: '¿?',
  context: '',
  options: ['a', 'b', 'c'],
  correct_option_index: 1,
  correct_boolean: null,
  reference_answer: '',
  rubric: '',
  explanation: '',
};

describe('grading', () => {
  it('normalizes and rejects malformed exercises', () => {
    expect(normalizeExercise(base)?.key).toEqual({ index: 1 });
    expect(normalizeExercise({ ...base, correct_option_index: 7 })).toBeNull();
    expect(normalizeExercise({ ...base, options: ['solo una'] })).toBeNull();
    expect(normalizeExercise({ ...base, kind: 'true_false', correct_boolean: null })).toBeNull();
    expect(normalizeExercise({ ...base, kind: 'true_false', correct_boolean: true })?.key).toEqual({ value: true });
    expect(normalizeExercise({ ...base, kind: 'code', reference_answer: 'x' })?.key).toEqual({ reference: 'x' });
  });

  it('grades multiple choice by index', () => {
    expect(gradeAuto('multiple_choice', { index: 1 }, ['a', 'b'], '1')?.verdict).toBe('correct');
    expect(gradeAuto('multiple_choice', { index: 1 }, ['a', 'b'], '0')).toMatchObject({ verdict: 'incorrect', correct_answer: 'b' });
    expect(gradeAuto('multiple_choice', { index: 1 }, ['a', 'b'], '5')).toBeNull();
    expect(gradeAuto('multiple_choice', { index: 1 }, ['a', 'b'], 'hola')).toBeNull();
  });

  it('grades true/false in Spanish or English', () => {
    expect(gradeAuto('true_false', { value: false }, [], 'falso')?.verdict).toBe('correct');
    expect(gradeAuto('true_false', { value: false }, [], 'true')?.verdict).toBe('incorrect');
    expect(gradeAuto('true_false', { value: true }, [], 'quizás')).toBeNull();
  });

  it('maps scores to verdicts', () => {
    expect(verdictFor(0.85)).toBe('correct');
    expect(verdictFor(0.5)).toBe('partial');
    expect(verdictFor(0.1)).toBe('incorrect');
  });
});
