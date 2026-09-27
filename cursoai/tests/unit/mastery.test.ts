import { describe, expect, it } from 'vitest';
import { aggregateState, applyResult, courseProgress, EMPTY_MASTERY, stageReady, stateFor } from '../../worker/services/mastery';

const run = (results: number[]) => results.reduce(applyResult, EMPTY_MASTERY);

describe('mastery engine', () => {
  it('starts as not started and moves to learning after one attempt', () => {
    expect(stateFor(EMPTY_MASTERY)).toBe('not_started');
    expect(run([1]).state).toBe('learning'); // one lucky answer is not mastery
  });

  it('requires sustained correct answers to master', () => {
    expect(run([1, 1]).state).toBe('mastered');
    expect(run([0.5, 1, 1, 1]).state).toBe('mastered');
    expect(run([1, 0.5]).state).toBe('learning');
  });

  it('flags two wrong answers in a row as needing reinforcement', () => {
    const m = run([0, 0]);
    expect(m.state).toBe('needs_reinforcement');
    expect(m.wrong_streak).toBe(2);
  });

  it('flags a persistently low score', () => {
    expect(run([0.3, 0.5]).state).toBe('needs_reinforcement');
  });

  it('recovers from reinforcement after good answers', () => {
    const weak = run([0, 0]);
    const recovered = [1, 1, 1].reduce(applyResult, weak);
    expect(recovered.state).not.toBe('needs_reinforcement');
    expect(recovered.wrong_streak).toBe(0);
  });

  it('clamps out-of-range scores', () => {
    expect(run([5]).score).toBe(1);
    expect(run([-1]).score).toBe(0);
  });

  it('aggregates competencies by their weakest concept', () => {
    expect(aggregateState([])).toBe('not_started');
    expect(aggregateState(['mastered', 'mastered'])).toBe('mastered');
    expect(aggregateState(['mastered', 'learning'])).toBe('learning');
    expect(aggregateState(['mastered', 'needs_reinforcement'])).toBe('needs_reinforcement');
    expect(aggregateState(['not_started', 'learning'])).toBe('learning');
  });

  it('computes progress from activities AND mastery, never 100 until completed', () => {
    expect(courseProgress({ completedLessons: 10, plannedLessons: 10, masteredConcepts: 0, totalConcepts: 10, completed: false })).toBe(50);
    expect(courseProgress({ completedLessons: 10, plannedLessons: 10, masteredConcepts: 10, totalConcepts: 10, completed: false })).toBe(99);
    expect(courseProgress({ completedLessons: 0, plannedLessons: 0, masteredConcepts: 0, totalConcepts: 0, completed: true })).toBe(100);
  });

  it('decides stage readiness', () => {
    expect(stageReady([run([1, 1]), run([1, 0.8])])).toBe(true);
    expect(stageReady([run([1, 1]), EMPTY_MASTERY])).toBe(false); // untested concept
    expect(stageReady([run([1, 1]), run([0, 0])])).toBe(false);
  });
});
