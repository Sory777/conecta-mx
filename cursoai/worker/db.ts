// Row types and ownership-checked loaders. Every loader that returns user data
// takes the userId and filters by it, so a guessed id from another account
// resolves to 404, never to someone else's data.

import type { Env } from './env';
import { notFound } from './http';
import { newId } from './util';
import type { ActivityType, CourseStatus, ExerciseKind, MasteryState, Sensitivity } from '../shared/types';

export interface CourseRow {
  id: string;
  user_id: string;
  title: string;
  topic: string;
  goal: string;
  goal_type: string;
  goal_outcome: string;
  level: string;
  domain: string;
  sensitivity: Sensitivity;
  volatility: 'stable' | 'changing';
  status: CourseStatus;
  original_request: string;
  intake_json: string;
  daily_minutes: number | null;
  current_module_id: string | null;
  current_lesson_id: string | null;
  source_course_id: string | null;
  share_code: string | null;
  created_at: string;
  updated_at: string;
  last_activity_at: string;
  completed_at: string | null;
}

export interface PlanRow {
  id: string;
  course_id: string;
  version: number;
  plan_json: string;
  status: 'draft' | 'accepted' | 'superseded';
  feedback: string | null;
  created_at: string;
}

export interface ModuleRow {
  id: string;
  course_id: string;
  position: number;
  title: string;
  kind_label: string;
  objective: string;
  estimated_minutes: number;
  status: 'locked' | 'available' | 'in_progress' | 'completed';
  outline_ready: number;
}

export interface ConceptRow {
  id: string;
  course_id: string;
  module_id: string | null;
  competency_id: string | null;
  position: number;
  name: string;
  description: string;
}

export interface MasteryRow {
  concept_id: string;
  state: MasteryState;
  score: number;
  attempts: number;
  correct: number;
  wrong_streak: number;
  last_error: string | null;
}

export interface LessonRow {
  id: string;
  course_id: string;
  module_id: string;
  position: number;
  type: ActivityType;
  title: string;
  goal: string;
  concept_ids_json: string;
  content_json: string | null;
  variants_json: string;
  active_variant: string | null;
  status: 'pending' | 'ready';
  info_kind: 'general' | 'current';
  verified_at: string | null;
}

export interface ExerciseRow {
  id: string;
  lesson_id: string;
  course_id: string;
  concept_id: string | null;
  position: number;
  variant: string;
  kind: ExerciseKind;
  prompt: string;
  context: string;
  options_json: string;
  answer_json: string;
  rubric: string;
  explanation: string;
}

export interface QuestionRow extends Omit<ExerciseRow, 'lesson_id' | 'course_id' | 'variant'> {
  quiz_id: string;
}

export async function requireCourse(env: Env, userId: string, courseId: string): Promise<CourseRow> {
  const row = await env.DB.prepare('SELECT * FROM courses WHERE id = ? AND user_id = ?').bind(courseId, userId).first<CourseRow>();
  if (!row) throw notFound('Curso');
  return row;
}

export async function requireLesson(env: Env, userId: string, lessonId: string): Promise<{ lesson: LessonRow; course: CourseRow }> {
  const lesson = await env.DB.prepare(
    `SELECT l.* FROM lessons l JOIN courses c ON c.id = l.course_id WHERE l.id = ? AND c.user_id = ?`,
  )
    .bind(lessonId, userId)
    .first<LessonRow>();
  if (!lesson) throw notFound('Actividad');
  return { lesson, course: await requireCourse(env, userId, lesson.course_id) };
}

export async function requireExercise(env: Env, userId: string, exerciseId: string): Promise<{ exercise: ExerciseRow; course: CourseRow }> {
  const exercise = await env.DB.prepare(
    `SELECT e.* FROM exercises e JOIN courses c ON c.id = e.course_id WHERE e.id = ? AND c.user_id = ?`,
  )
    .bind(exerciseId, userId)
    .first<ExerciseRow>();
  if (!exercise) throw notFound('Ejercicio');
  return { exercise, course: await requireCourse(env, userId, exercise.course_id) };
}

export async function latestPlan(env: Env, courseId: string): Promise<PlanRow | null> {
  return env.DB.prepare('SELECT * FROM course_plans WHERE course_id = ? ORDER BY version DESC LIMIT 1').bind(courseId).first<PlanRow>();
}

export async function listModules(env: Env, courseId: string): Promise<ModuleRow[]> {
  return (await env.DB.prepare('SELECT * FROM modules WHERE course_id = ? ORDER BY position').bind(courseId).all<ModuleRow>()).results;
}

export async function listConcepts(env: Env, courseId: string): Promise<ConceptRow[]> {
  return (await env.DB.prepare('SELECT * FROM concepts WHERE course_id = ? ORDER BY position').bind(courseId).all<ConceptRow>()).results;
}

export async function masteryMap(env: Env, userId: string, courseId: string): Promise<Map<string, MasteryRow>> {
  const rows = (
    await env.DB.prepare('SELECT * FROM concept_mastery WHERE user_id = ? AND course_id = ?').bind(userId, courseId).all<MasteryRow>()
  ).results;
  return new Map(rows.map((r) => [r.concept_id, r]));
}

export async function logActivity(
  env: Env,
  userId: string,
  kind: string,
  detail: string,
  courseId: string | null = null,
  lessonId: string | null = null,
): Promise<void> {
  await env.DB.prepare('INSERT INTO activity_log (id, user_id, course_id, lesson_id, kind, detail) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(newId('al_'), userId, courseId, lessonId, kind, detail.slice(0, 300))
    .run();
}

export async function touchCourse(env: Env, courseId: string, lessonId?: string | null, moduleId?: string | null): Promise<void> {
  await env.DB.prepare(
    `UPDATE courses SET last_activity_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
       current_lesson_id = COALESCE(?, current_lesson_id), current_module_id = COALESCE(?, current_module_id)
     WHERE id = ?`,
  )
    .bind(lessonId ?? null, moduleId ?? null, courseId)
    .run();
}

export async function grantAchievement(env: Env, userId: string, courseId: string | null, kind: string, title: string): Promise<void> {
  await env.DB.prepare('INSERT OR IGNORE INTO achievements (id, user_id, course_id, kind, title) VALUES (?, ?, ?, ?, ?)')
    .bind(newId('ac_'), userId, courseId, kind, title)
    .run();
}

export async function preferences(env: Env, userId: string) {
  const row = await env.DB.prepare('SELECT * FROM user_preferences WHERE user_id = ?').bind(userId).first<{
    daily_minutes: number;
    explanation_style: 'concise' | 'balanced' | 'detailed';
    practice_first: number;
  }>();
  return row ?? { daily_minutes: 30, explanation_style: 'balanced' as const, practice_first: 1 };
}
