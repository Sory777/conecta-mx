import type { Env } from '../env';
import { PLAN_LIMITS, activeCourseCount, usageToday, type Plan } from '../guard';
import type { UsageDTO } from '../../shared/types';
import { listCourses } from './courses';

export async function usage(env: Env, userId: string, plan: Plan): Promise<UsageDTO> {
  const used = await usageToday(env, userId);
  return {
    plan,
    limits: { ...PLAN_LIMITS[plan] },
    used: {
      active_courses: await activeCourseCount(env, userId),
      ai_generations_today: used.generations,
      tutor_messages_today: used.tutor,
    },
  };
}

export async function getProfile(env: Env, userId: string, plan: Plan) {
  const prefs = await env.DB.prepare('SELECT daily_minutes, explanation_style, practice_first FROM user_preferences WHERE user_id = ?')
    .bind(userId)
    .first<{ daily_minutes: number; explanation_style: string; practice_first: number }>();
  const profile = await env.DB.prepare('SELECT learning_pace, background FROM user_profiles WHERE user_id = ?')
    .bind(userId)
    .first<{ learning_pace: string; background: string }>();
  const achievements = (
    await env.DB.prepare('SELECT kind, title, created_at FROM achievements WHERE user_id = ? ORDER BY created_at DESC LIMIT 30')
      .bind(userId)
      .all<{ kind: string; title: string; created_at: string }>()
  ).results;
  return {
    preferences: { ...prefs, practice_first: Boolean(prefs?.practice_first) },
    profile,
    usage: await usage(env, userId, plan),
    achievements,
  };
}

export async function updateProfile(
  env: Env,
  userId: string,
  patch: { name?: string; daily_minutes?: number; explanation_style?: string; practice_first?: boolean; background?: string },
) {
  const stmts: D1PreparedStatement[] = [];
  if (patch.name !== undefined) stmts.push(env.DB.prepare('UPDATE users SET name = ? WHERE id = ?').bind(patch.name, userId));
  if (patch.daily_minutes !== undefined || patch.explanation_style !== undefined || patch.practice_first !== undefined) {
    stmts.push(
      env.DB.prepare(
        `UPDATE user_preferences SET daily_minutes = COALESCE(?, daily_minutes), explanation_style = COALESCE(?, explanation_style),
           practice_first = COALESCE(?, practice_first), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE user_id = ?`,
      ).bind(patch.daily_minutes ?? null, patch.explanation_style ?? null, patch.practice_first === undefined ? null : patch.practice_first ? 1 : 0, userId),
    );
  }
  if (patch.background !== undefined) {
    stmts.push(env.DB.prepare(`UPDATE user_profiles SET background = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE user_id = ?`).bind(patch.background, userId));
  }
  if (stmts.length) await env.DB.batch(stmts);
}

/** Learning pace derived from evidence, stored on the profile and used by generators. */
export async function refreshPace(env: Env, userId: string) {
  const row = await env.DB.prepare(
    `SELECT AVG(score) AS avg, COUNT(*) AS n FROM (SELECT score FROM answers WHERE user_id = ? ORDER BY created_at DESC LIMIT 30)`,
  )
    .bind(userId)
    .first<{ avg: number | null; n: number }>();
  if (!row || row.n < 8 || row.avg === null) return;
  const pace = row.avg >= 0.85 ? 'fast' : row.avg < 0.5 ? 'slow' : 'normal';
  await env.DB.prepare('UPDATE user_profiles SET learning_pace = ? WHERE user_id = ?').bind(pace, userId).run();
}

export async function progressOverview(env: Env, userId: string) {
  const courses = await listCourses(env, userId);
  const history = (
    await env.DB.prepare(
      `SELECT a.kind, a.detail, a.created_at, a.course_id, c.title AS course_title FROM activity_log a
       LEFT JOIN courses c ON c.id = a.course_id WHERE a.user_id = ? ORDER BY a.created_at DESC LIMIT 40`,
    )
      .bind(userId)
      .all<{ kind: string; detail: string; created_at: string; course_id: string | null; course_title: string | null }>()
  ).results;
  const stats = await env.DB.prepare(
    `SELECT COUNT(*) AS answers, SUM(CASE WHEN verdict = 'correct' THEN 1 ELSE 0 END) AS correct FROM answers WHERE user_id = ?`,
  )
    .bind(userId)
    .first<{ answers: number; correct: number | null }>();
  return { courses, history, stats: { answers: stats?.answers ?? 0, correct: stats?.correct ?? 0 } };
}
