import type { Env } from './env';
import { HttpError } from './http';

// ── Rate limiting (fixed window, stored in D1) ──
export async function rateLimit(env: Env, key: string, limit: number, windowSec: number): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % windowSec);
  const row = await env.DB.prepare(
    `INSERT INTO rate_limits (key, window_start, count) VALUES (?1, ?2, 1)
     ON CONFLICT(key) DO UPDATE SET
       count = CASE WHEN rate_limits.window_start = ?2 THEN rate_limits.count + 1 ELSE 1 END,
       window_start = ?2
     RETURNING count`,
  )
    .bind(key, windowStart)
    .first<{ count: number }>();
  if (row && row.count > limit) {
    const retry = windowStart + windowSec - now;
    throw new HttpError(429, 'rate_limited', `Demasiadas solicitudes. Intenta de nuevo en ${retry} s.`, { retry_after: retry });
  }
}

export function clientIp(req: Request): string {
  return req.headers.get('CF-Connecting-IP') ?? req.headers.get('X-Forwarded-For')?.split(',')[0].trim() ?? 'local';
}

// ── Plans & quotas ──
export const PLAN_LIMITS = {
  free: { active_courses: 3, ai_generations_per_day: 60, tutor_messages_per_day: 30 },
  premium: { active_courses: 50, ai_generations_per_day: 600, tutor_messages_per_day: 400 },
} as const;

export type Plan = keyof typeof PLAN_LIMITS;

const dayStart = () => new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z';

export async function usageToday(env: Env, userId: string): Promise<{ generations: number; tutor: number }> {
  const row = await env.DB.prepare(
    `SELECT
       SUM(CASE WHEN task != 'tutor' THEN 1 ELSE 0 END) AS generations,
       SUM(CASE WHEN task = 'tutor' THEN 1 ELSE 0 END) AS tutor
     FROM usage_events WHERE user_id = ? AND created_at >= ? AND cached = 0`,
  )
    .bind(userId, dayStart())
    .first<{ generations: number | null; tutor: number | null }>();
  return { generations: row?.generations ?? 0, tutor: row?.tutor ?? 0 };
}

export async function activeCourseCount(env: Env, userId: string): Promise<number> {
  const row = await env.DB.prepare(`SELECT COUNT(*) AS n FROM courses WHERE user_id = ? AND status != 'completed'`)
    .bind(userId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export async function assertCanCreateCourse(env: Env, userId: string, plan: Plan): Promise<void> {
  const n = await activeCourseCount(env, userId);
  if (n >= PLAN_LIMITS[plan].active_courses) {
    throw new HttpError(
      402,
      'quota_courses',
      `Tu plan permite ${PLAN_LIMITS[plan].active_courses} cursos activos. Termina o elimina uno para crear otro.`,
    );
  }
}

export async function assertAiQuota(env: Env, userId: string, plan: Plan, task: string): Promise<void> {
  // Burst protection against automated abuse, on top of the daily quota.
  await rateLimit(env, `ai:${userId}`, Number(env.AI_RATE_PER_MIN ?? '20') || 20, 60);
  const used = await usageToday(env, userId);
  const limits = PLAN_LIMITS[plan];
  if (task === 'tutor' ? used.tutor >= limits.tutor_messages_per_day : used.generations >= limits.ai_generations_per_day) {
    throw new HttpError(
      402,
      'quota_ai',
      task === 'tutor'
        ? 'Alcanzaste el límite diario de mensajes al tutor. Vuelve mañana.'
        : 'Alcanzaste el límite diario de generaciones con IA. Vuelve mañana.',
    );
  }
  // Global circuit breaker across all users.
  const budget = Number(env.AI_DAILY_BUDGET_USD ?? '0');
  if (budget > 0) {
    const spent = await env.DB.prepare(`SELECT COALESCE(SUM(cost_micro_usd), 0) AS c FROM usage_events WHERE created_at >= ?`)
      .bind(dayStart())
      .first<{ c: number }>();
    if ((spent?.c ?? 0) / 1e6 >= budget) {
      throw new HttpError(503, 'budget_exhausted', 'El servicio de IA alcanzó su presupuesto diario. Inténtalo más tarde.');
    }
  }
}
