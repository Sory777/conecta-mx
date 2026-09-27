// Deterministic mastery engine. No AI involved: the AI grades individual
// answers, this module decides what the learner has actually mastered.

import type { MasteryState } from '../../shared/types';

export interface MasteryRecord {
  state: MasteryState;
  score: number; // 0..1, exponentially weighted
  attempts: number;
  correct: number;
  wrong_streak: number;
}

export const EMPTY_MASTERY: MasteryRecord = { state: 'not_started', score: 0, attempts: 0, correct: 0, wrong_streak: 0 };

const WEIGHT_NEW = 0.4;
export const MASTERED_SCORE = 0.8;
const MASTERED_MIN_CORRECT = 2;
const WEAK_SCORE = 0.5;

/** Apply one graded result (0..1) to a concept's mastery record. */
export function applyResult(prev: MasteryRecord, result: number): MasteryRecord {
  const r = Math.min(1, Math.max(0, result));
  const attempts = prev.attempts + 1;
  const score = prev.attempts === 0 ? r : prev.score * (1 - WEIGHT_NEW) + r * WEIGHT_NEW;
  const isCorrect = r >= 0.8;
  const isWrong = r < 0.4;
  const correct = prev.correct + (isCorrect ? 1 : 0);
  const wrong_streak = isWrong ? prev.wrong_streak + 1 : 0;
  return { state: stateFor({ score, attempts, correct, wrong_streak }), score: round(score), attempts, correct, wrong_streak };
}

export function stateFor(m: Pick<MasteryRecord, 'score' | 'attempts' | 'correct' | 'wrong_streak'>): MasteryState {
  if (m.attempts === 0) return 'not_started';
  if (m.score >= MASTERED_SCORE && m.correct >= MASTERED_MIN_CORRECT) return 'mastered';
  if (m.wrong_streak >= 2 || (m.attempts >= 2 && m.score < WEAK_SCORE)) return 'needs_reinforcement';
  return 'learning';
}

/** A competency is only as strong as its weakest attempted concept. */
export function aggregateState(states: MasteryState[]): MasteryState {
  if (states.length === 0 || states.every((s) => s === 'not_started')) return 'not_started';
  if (states.every((s) => s === 'mastered')) return 'mastered';
  if (states.includes('needs_reinforcement')) return 'needs_reinforcement';
  return 'learning';
}

export function averageScore(scores: number[]): number {
  return scores.length ? round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
}

/**
 * Course progress mixes completed activities with mastered concepts so the
 * number can't be inflated by clicking through without learning.
 */
export function courseProgress(input: {
  completedLessons: number;
  plannedLessons: number;
  masteredConcepts: number;
  totalConcepts: number;
  completed: boolean;
}): number {
  if (input.completed) return 100;
  const lessonPart = input.plannedLessons ? input.completedLessons / input.plannedLessons : 0;
  const masteryPart = input.totalConcepts ? input.masteredConcepts / input.totalConcepts : 0;
  return Math.min(99, Math.round((lessonPart * 0.5 + masteryPart * 0.5) * 100));
}

/** A stage is passable when nothing needs reinforcement and most concepts are solid. */
export function stageReady(records: MasteryRecord[]): boolean {
  if (records.length === 0) return true;
  if (records.some((r) => r.state === 'needs_reinforcement')) return false;
  const attempted = records.filter((r) => r.attempts > 0);
  return attempted.length === records.length && averageScore(records.map((r) => r.score)) >= 0.6;
}

const round = (n: number) => Math.round(n * 1000) / 1000;
