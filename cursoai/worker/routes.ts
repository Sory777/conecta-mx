import { z } from 'zod';
import type { Env } from './env';
import { HttpError, json, readJson, Router } from './http';
import {
  authenticate,
  clearedCookie,
  createSession,
  createUser,
  currentUser,
  destroySession,
  requireUser,
  sessionCookie,
  toUserDTO,
  type UserRow,
} from './auth';
import { clientIp, rateLimit } from './guard';
import { getProvider, type AIContext } from './ai/runner';
import * as courses from './services/courses';
import * as learning from './services/learning';
import * as outcomes from './services/outcomes';
import * as tutor from './services/tutor';
import * as profile from './services/profile';

export interface Ctx {
  env: Env;
  req: Request;
}

const text = (max: number) => z.string().trim().min(1).max(max);
const REGEN = z.enum(['simpler', 'advanced', 'more_examples', 'more_practical', 'eli10']);

async function user(c: Ctx): Promise<UserRow> {
  return requireUser(c.env, c.req);
}

/** AI context for a request (rate limits apply per real provider call, see ai/runner). */
function ai(c: Ctx, u: UserRow): AIContext {
  // Resolved lazily: flows that need no AI (e.g. multiple-choice grading) work even if AI is not configured.
  return {
    env: c.env,
    userId: u.id,
    plan: u.plan,
    get provider() {
      return getProvider(c.env);
    },
  };
}

export const router = new Router<Ctx>()
  // ── Auth ──
  .on('POST', '/api/auth/register', async (c) => {
    await rateLimit(c.env, `register:${clientIp(c.req)}`, 20, 3600);
    const body = await readJson(
      c.req,
      z.object({
        email: z.string().trim().toLowerCase().email().max(200),
        password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.').max(200),
        name: z.string().trim().max(120).default(''),
      }),
    );
    const u = await createUser(c.env, body.email, body.password, body.name);
    const s = await createSession(c.env, u.id);
    return json({ user: toUserDTO(u) }, { status: 201, headers: { 'Set-Cookie': sessionCookie(c.env, s.token, s.expires) } });
  })
  .on('POST', '/api/auth/login', async (c) => {
    await rateLimit(c.env, `login:${clientIp(c.req)}`, 10, 300);
    const body = await readJson(c.req, z.object({ email: z.string().trim().toLowerCase().max(200), password: z.string().max(200) }));
    await rateLimit(c.env, `login-email:${body.email}`, 10, 900);
    const u = await authenticate(c.env, body.email, body.password);
    const s = await createSession(c.env, u.id);
    return json({ user: toUserDTO(u) }, { headers: { 'Set-Cookie': sessionCookie(c.env, s.token, s.expires) } });
  })
  .on('POST', '/api/auth/logout', async (c) => {
    await destroySession(c.env, c.req);
    return json({ ok: true }, { headers: { 'Set-Cookie': clearedCookie(c.env) } });
  })
  .on('GET', '/api/auth/me', async (c) => {
    const u = await currentUser(c.env, c.req);
    return json({ user: u ? toUserDTO(u) : null });
  })

  // ── Profile & dashboard ──
  .on('GET', '/api/dashboard', async (c) => {
    const u = await user(c);
    return json(await courses.dashboard(c.env, toUserDTO(u)));
  })
  .on('GET', '/api/profile', async (c) => {
    const u = await user(c);
    return json({ user: toUserDTO(u), ...(await profile.getProfile(c.env, u.id, u.plan)) });
  })
  .on('PATCH', '/api/profile', async (c) => {
    const u = await user(c);
    const body = await readJson(
      c.req,
      z.object({
        name: z.string().trim().max(120).optional(),
        daily_minutes: z.number().int().min(5).max(480).optional(),
        explanation_style: z.enum(['concise', 'balanced', 'detailed']).optional(),
        practice_first: z.boolean().optional(),
        background: z.string().trim().max(1000).optional(),
      }),
    );
    await profile.updateProfile(c.env, u.id, body);
    const fresh = (await currentUser(c.env, c.req))!;
    return json({ user: toUserDTO(fresh), ...(await profile.getProfile(c.env, u.id, u.plan)) });
  })
  .on('GET', '/api/progress', async (c) => {
    const u = await user(c);
    return json(await profile.progressOverview(c.env, u.id));
  })

  // ── Course creation: intake → diagnosis → plan → accept ──
  .on('POST', '/api/courses', async (c) => {
    const u = await user(c);
    const body = await readJson(c.req, z.object({ request: text(600) }));
    return json(await courses.createCourse(ai(c, u), body.request), { status: 201 });
  })
  .on('GET', '/api/courses', async (c) => {
    const u = await user(c);
    return json({ courses: await courses.listCourses(c.env, u.id) });
  })
  .on('GET', '/api/courses/:id', async (c, p) => {
    const u = await user(c);
    return json(await courses.courseDetail(c.env, u.id, p.id));
  })
  .on('POST', '/api/courses/:id/plan', async (c, p) => {
    const u = await user(c);
    const body = await readJson(c.req, z.object({ answers: z.record(z.string(), z.string().max(300)).default({}) }));
    return json(await courses.createPlan(ai(c, u), p.id, body.answers));
  })
  .on('POST', '/api/courses/:id/plan/revise', async (c, p) => {
    const u = await user(c);
    const body = await readJson(c.req, z.object({ feedback: text(800) }));
    return json(await courses.revisePlanFor(ai(c, u), p.id, body.feedback));
  })
  .on('POST', '/api/courses/:id/plan/accept', async (c, p) => {
    const u = await user(c);
    return json(await courses.acceptPlan(ai(c, u), p.id));
  })

  // ── Library ──
  .on('PATCH', '/api/courses/:id', async (c, p) => {
    const u = await user(c);
    const body = await readJson(c.req, z.object({ title: text(120).optional(), status: z.enum(['active', 'paused']).optional() }));
    if (body.title) await courses.renameCourse(c.env, u.id, p.id, body.title);
    if (body.status) await courses.setStatus(c.env, u.id, p.id, body.status);
    return json(await courses.courseDetail(c.env, u.id, p.id));
  })
  .on('DELETE', '/api/courses/:id', async (c, p) => {
    const u = await user(c);
    await courses.deleteCourse(c.env, u.id, p.id);
    return json({ ok: true });
  })
  .on('POST', '/api/courses/:id/duplicate', async (c, p) => {
    const u = await user(c);
    return json(await courses.duplicateCourse(ai(c, u), p.id), { status: 201 });
  })
  .on('POST', '/api/courses/:id/reset', async (c, p) => {
    const u = await user(c);
    await courses.resetProgress(c.env, u.id, p.id);
    return json(await courses.courseDetail(c.env, u.id, p.id));
  })
  .on('POST', '/api/courses/:id/share', async (c, p) => {
    const u = await user(c);
    const body = await readJson(c.req, z.object({ enabled: z.boolean() }));
    return json(await courses.setSharing(c.env, u.id, p.id, body.enabled));
  })
  .on('POST', '/api/courses/:id/content', async (c, p) => {
    const u = await user(c);
    const body = await readJson(c.req, z.object({ request: text(600) }));
    return json(await courses.addContent(ai(c, u), p.id, body.request));
  })
  .on('GET', '/api/shared/:code', async (c, p) => {
    await user(c);
    return json(await courses.sharedPreview(c.env, p.code.toUpperCase()));
  })
  .on('POST', '/api/shared/:code/import', async (c, p) => {
    const u = await user(c);
    return json(await courses.importShared(ai(c, u), p.code.toUpperCase()), { status: 201 });
  })

  // ── Adaptive loop ──
  .on('GET', '/api/courses/:id/next', async (c, p) => {
    const u = await user(c);
    return json(await learning.nextStep(ai(c, u), p.id));
  })
  .on('GET', '/api/lessons/:id', async (c, p) => {
    const u = await user(c);
    return json(await learning.getLesson(ai(c, u), p.id));
  })
  .on('POST', '/api/lessons/:id/regenerate', async (c, p) => {
    const u = await user(c);
    const body = await readJson(c.req, z.object({ action: REGEN }));
    return json(await learning.regenerateLesson(ai(c, u), p.id, body.action));
  })
  .on('POST', '/api/lessons/:id/variant', async (c, p) => {
    const u = await user(c);
    const body = await readJson(c.req, z.object({ action: REGEN.nullable() }));
    return json(await learning.switchVariant(c.env, u.id, p.id, body.action));
  })
  .on('POST', '/api/lessons/:id/complete', async (c, p) => {
    const u = await user(c);
    const next = await learning.completeLesson(ai(c, u), p.id);
    await profile.refreshPace(c.env, u.id);
    return json({ next });
  })
  .on('POST', '/api/exercises/:id/answer', async (c, p) => {
    const u = await user(c);
    const body = await readJson(
      c.req,
      z.object({
        response: text(8000),
        conversation: z.array(z.object({ role: z.enum(['alumno', 'interlocutor']), text: z.string().max(1000) })).max(20).optional(),
      }),
    );
    return json(await learning.answerExercise(ai(c, u), p.id, body.response, body.conversation));
  })

  // ── Evaluations, project, certificate ──
  .on('POST', '/api/courses/:id/quiz', async (c, p) => {
    const u = await user(c);
    const body = await readJson(c.req, z.object({ module_id: z.string().max(80).nullable().default(null) }));
    return json(await outcomes.createOnDemandQuiz(ai(c, u), p.id, body.module_id), { status: 201 });
  })
  .on('GET', '/api/quizzes/:id', async (c, p) => {
    const u = await user(c);
    return json(await outcomes.getQuiz(c.env, u.id, p.id));
  })
  .on('POST', '/api/quizzes/:id/submit', async (c, p) => {
    const u = await user(c);
    const body = await readJson(c.req, z.object({ answers: z.record(z.string(), z.string().max(8000)) }));
    const ctx = ai(c, u);
    const result = await outcomes.submitQuiz(ctx, p.id, body.answers);
    const quiz = await outcomes.getQuiz(c.env, u.id, p.id);
    // After a stage evaluation, advance the course right away (unlocks/generates the next stage).
    const next = quiz.kind === 'stage' ? await learning.nextStepSafe(ctx, quiz.course_id) : null;
    return json({ ...result, next });
  })
  .on('GET', '/api/courses/:id/project', async (c, p) => {
    const u = await user(c);
    return json(await outcomes.getOrCreateProject(ai(c, u), p.id));
  })
  .on('POST', '/api/courses/:id/project/submit', async (c, p) => {
    const u = await user(c);
    const body = await readJson(c.req, z.object({ content: text(20000) }));
    return json(await outcomes.submitProject(ai(c, u), p.id, body.content));
  })
  .on('POST', '/api/courses/:id/certificate', async (c, p) => {
    const u = await user(c);
    const body = await readJson(c.req, z.object({ name: z.string().trim().max(120).optional() }));
    const name = body.name || u.name || u.email.split('@')[0];
    return json(await outcomes.issueCertificate(ai(c, u), p.id, name));
  })
  .on('GET', '/api/certificates/:code', async (c, p) => {
    await rateLimit(c.env, `cert:${clientIp(c.req)}`, 60, 60);
    return json(await outcomes.getCertificate(c.env, p.code));
  })

  // ── Tutor ──
  .on('GET', '/api/courses/:id/tutor', async (c, p) => {
    const u = await user(c);
    return json({ messages: await tutor.tutorHistory(c.env, u.id, p.id) });
  })
  .on('POST', '/api/courses/:id/tutor', async (c, p) => {
    const u = await user(c);
    const body = await readJson(c.req, z.object({ message: text(2000), lesson_id: z.string().max(80).nullable().default(null) }));
    return json({ messages: await tutor.askTutor(ai(c, u), p.id, body.message, body.lesson_id) });
  })
  .on('GET', '/api/health', async (c) => {
    // Reports configuration state without exposing secrets.
    let ai_status = 'ok';
    try {
      getProvider(c.env);
    } catch (err) {
      ai_status = err instanceof HttpError ? err.code : 'error';
    }
    return json({ ok: true, ai_provider: c.env.AI_PROVIDER, ai_status });
  });
