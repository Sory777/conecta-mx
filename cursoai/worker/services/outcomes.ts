// Evaluations (stage / on-demand quizzes), final project and certificate.

import type { Env } from '../env';
import { badRequest, conflict, HttpError, notFound } from '../http';
import {
  grantAchievement,
  latestPlan,
  listConcepts,
  listModules,
  logActivity,
  masteryMap,
  requireCourse,
  touchCourse,
  type ConceptRow,
  type CourseRow,
  type ModuleRow,
  type QuestionRow,
} from '../db';
import { humanCode, newId, nowIso, parseJson } from '../util';
import type { AIContext } from '../ai/runner';
import { evaluateProject, makeProject, makeQuiz } from '../ai/tasks';
import type { PlanOut, ProjectOut } from '../ai/schemas';
import { normalizeExercise, type AnswerKey } from './grading';
import { conceptCtx, courseCtx, gradeResponse, updateMastery } from './learning';
import type { AnswerResult, CertificateDTO, ProjectDTO, ProjectEvaluation, QuizDTO, QuizResult } from '../../shared/types';

// ───────────── Quizzes ─────────────

interface QuizRow {
  id: string;
  course_id: string;
  module_id: string | null;
  lesson_id: string | null;
  kind: QuizDTO['kind'];
  title: string;
  pass_score: number;
  created_at: string;
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

async function createQuiz(
  ctx: AIContext,
  course: CourseRow,
  kind: QuizDTO['kind'],
  scope: string,
  concepts: ConceptRow[],
  moduleId: string | null,
  count: number,
): Promise<QuizRow> {
  const { env, userId } = ctx;
  if (concepts.length === 0) throw conflict('No hay conceptos que evaluar todavía.');
  const mastery = await masteryMap(env, userId, course.id);
  const out = await makeQuiz(ctx, { course: await courseCtx(env, course, userId), scope, concepts: conceptCtx(concepts, mastery), count });
  const id = newId('q_');
  const stmts: D1PreparedStatement[] = [
    env.DB.prepare('INSERT INTO quizzes (id, course_id, module_id, kind, title, pass_score) VALUES (?, ?, ?, ?, ?, ?)').bind(
      id,
      course.id,
      moduleId,
      kind,
      (out.title || scope).slice(0, 160),
      0.7,
    ),
  ];
  let pos = 0;
  for (const q of out.questions.slice(0, 10)) {
    const n = normalizeExercise(q);
    if (!n) continue;
    const concept = concepts.find((c) => norm(c.name) === norm(q.concept)) ?? concepts[pos % concepts.length];
    stmts.push(
      env.DB.prepare(
        `INSERT INTO questions (id, quiz_id, concept_id, position, kind, prompt, context, options_json, answer_json, rubric, explanation)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        newId('qq_'),
        id,
        concept.id,
        pos++,
        n.kind,
        q.prompt.slice(0, 3000),
        q.context.slice(0, 4000),
        JSON.stringify(n.options),
        JSON.stringify(n.key),
        q.rubric.slice(0, 2000),
        q.explanation.slice(0, 2000),
      ),
    );
  }
  if (pos === 0) throw new HttpError(502, 'ai_unavailable', 'La IA no generó preguntas válidas. Inténtalo de nuevo.');
  await env.DB.batch(stmts);
  return (await env.DB.prepare('SELECT * FROM quizzes WHERE id = ?').bind(id).first<QuizRow>())!;
}

export async function ensureStageQuiz(ctx: AIContext, course: CourseRow, mod: ModuleRow, concepts: ConceptRow[]): Promise<QuizRow> {
  const existing = await ctx.env.DB.prepare(`SELECT * FROM quizzes WHERE module_id = ? AND kind = 'stage' ORDER BY created_at DESC LIMIT 1`)
    .bind(mod.id)
    .first<QuizRow>();
  if (existing) {
    // A failed stage quiz is retaken with fresh questions (the old answers are known by now).
    const last = await lastQuizResult(ctx.env, ctx.userId, existing.id);
    if (!last || last.passed) return existing;
    const retakeReady = await ctx.env.DB.prepare(
      `SELECT COUNT(*) AS n FROM lesson_progress lp JOIN lessons l ON l.id = lp.lesson_id
       WHERE lp.user_id = ? AND l.module_id = ? AND l.type = 'reinforcement' AND lp.status = 'completed' AND lp.completed_at > ?`,
    )
      .bind(ctx.userId, mod.id, existing.created_at)
      .first<{ n: number }>();
    if (!retakeReady?.n) return existing;
  }
  return createQuiz(ctx, course, 'stage', `Evaluación de la etapa «${mod.title}»`, concepts, mod.id, Math.min(6, Math.max(4, concepts.length + 2)));
}

export async function createOnDemandQuiz(ctx: AIContext, courseId: string, moduleId: string | null): Promise<QuizDTO> {
  const { env, userId } = ctx;
  const course = await requireCourse(env, userId, courseId);
  if (course.status !== 'active' && course.status !== 'completed') throw conflict('Acepta el plan antes de pedir una evaluación.');
  const all = await listConcepts(env, courseId);
  const mastery = await masteryMap(env, userId, courseId);
  let concepts = moduleId ? all.filter((c) => c.module_id === moduleId) : all.filter((c) => (mastery.get(c.id)?.attempts ?? 0) > 0);
  if (concepts.length === 0) {
    const current = course.current_module_id;
    concepts = all.filter((c) => c.module_id === current);
  }
  const quiz = await createQuiz(ctx, course, 'on_demand', 'Examen de práctica', concepts.slice(0, 8), moduleId, 5);
  await logActivity(env, userId, 'quiz_created', quiz.title, courseId);
  return quizDTO(env, userId, quiz);
}

export async function lastQuizResult(env: Env, userId: string, quizId: string): Promise<QuizResult | null> {
  const last = await env.DB.prepare(
    `SELECT MAX(a.created_at) AS at FROM answers a JOIN questions q ON q.id = a.question_id WHERE q.quiz_id = ? AND a.user_id = ?`,
  )
    .bind(quizId, userId)
    .first<{ at: string | null }>();
  if (!last?.at) return null;
  const rows = (
    await env.DB.prepare(
      `SELECT a.question_id, a.feedback_json FROM answers a JOIN questions q ON q.id = a.question_id
       WHERE q.quiz_id = ? AND a.user_id = ? AND a.created_at = ? ORDER BY q.position`,
    )
      .bind(quizId, userId, last.at)
      .all<{ question_id: string; feedback_json: string }>()
  ).results;
  const quiz = await env.DB.prepare('SELECT pass_score FROM quizzes WHERE id = ?').bind(quizId).first<{ pass_score: number }>();
  const results = rows.map((r) => ({ question_id: r.question_id, ...parseJson<AnswerResult>(r.feedback_json, {} as AnswerResult) }));
  const score = results.length ? results.reduce((s, r) => s + (r.score ?? 0), 0) / results.length : 0;
  return { score: Math.round(score * 1000) / 1000, passed: score >= (quiz?.pass_score ?? 0.7), results };
}

async function quizDTO(env: Env, userId: string, quiz: QuizRow): Promise<QuizDTO> {
  const questions = (
    await env.DB.prepare('SELECT * FROM questions WHERE quiz_id = ? ORDER BY position').bind(quiz.id).all<QuestionRow>()
  ).results;
  return {
    id: quiz.id,
    kind: quiz.kind,
    title: quiz.title,
    course_id: quiz.course_id,
    module_id: quiz.module_id,
    pass_score: quiz.pass_score,
    questions: questions.map((q) => ({ id: q.id, kind: q.kind, prompt: q.prompt, context: q.context, options: parseJson<string[]>(q.options_json, []) })),
    last_result: await lastQuizResult(env, userId, quiz.id),
  };
}

async function requireQuiz(env: Env, userId: string, quizId: string): Promise<{ quiz: QuizRow; course: CourseRow }> {
  const quiz = await env.DB.prepare(`SELECT q.* FROM quizzes q JOIN courses c ON c.id = q.course_id WHERE q.id = ? AND c.user_id = ?`)
    .bind(quizId, userId)
    .first<QuizRow>();
  if (!quiz) throw notFound('Evaluación');
  return { quiz, course: await requireCourse(env, userId, quiz.course_id) };
}

export async function getQuiz(env: Env, userId: string, quizId: string): Promise<QuizDTO> {
  const { quiz } = await requireQuiz(env, userId, quizId);
  return quizDTO(env, userId, quiz);
}

export async function submitQuiz(ctx: AIContext, quizId: string, responses: Record<string, string>): Promise<QuizResult> {
  const { env, userId } = ctx;
  const { quiz, course } = await requireQuiz(env, userId, quizId);
  if (course.status !== 'active' && course.status !== 'completed') throw conflict('El curso no está activo.');
  const questions = (await env.DB.prepare('SELECT * FROM questions WHERE quiz_id = ? ORDER BY position').bind(quiz.id).all<QuestionRow>()).results;
  const missing = questions.filter((q) => !responses[q.id]?.trim());
  if (missing.length) throw badRequest('Responde todas las preguntas antes de enviar.', { missing: missing.map((q) => q.id) });
  const concepts = new Map((await listConcepts(env, course.id)).map((c) => [c.id, c.name]));

  const graded = await Promise.all(
    questions.map((q) =>
      gradeResponse(
        ctx,
        course,
        {
          kind: q.kind,
          prompt: q.prompt,
          context: q.context,
          options: parseJson<string[]>(q.options_json, []),
          key: parseJson<AnswerKey>(q.answer_json, { reference: '' }),
          rubric: q.rubric,
          explanation: q.explanation,
          conceptName: q.concept_id ? concepts.get(q.concept_id) ?? '' : '',
        },
        responses[q.id],
      ),
    ),
  );
  const at = nowIso();
  const results: QuizResult['results'] = [];
  const stmts: D1PreparedStatement[] = [];
  questions.forEach((q, i) => {
    const g = graded[i];
    const r: AnswerResult = {
      verdict: g.verdict,
      score: g.score,
      feedback: g.feedback,
      correct_answer: g.correct_answer,
      misconception: g.misconception,
      next_turn: null,
      mastery: null,
    };
    results.push({ question_id: q.id, ...r });
    stmts.push(
      env.DB.prepare(
        `INSERT INTO answers (id, user_id, course_id, question_id, concept_id, response, score, verdict, feedback_json, graded_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(newId('an_'), userId, course.id, q.id, q.concept_id, responses[q.id].slice(0, 8000), g.score, g.verdict, JSON.stringify(r), g.by, at),
    );
  });
  await env.DB.batch(stmts);
  for (const [i, q] of questions.entries()) {
    if (!q.concept_id) continue;
    const m = await updateMastery(env, userId, course.id, q.concept_id, graded[i].score, graded[i].verdict === 'correct' ? null : graded[i].misconception);
    results[i].mastery = { concept_id: q.concept_id, state: m.state, score: m.score };
  }
  const score = results.reduce((s, r) => s + r.score, 0) / results.length;
  await touchCourse(env, course.id);
  await logActivity(env, userId, 'quiz_submitted', `${quiz.title}: ${Math.round(score * 100)}%`, course.id);
  return { score: Math.round(score * 1000) / 1000, passed: score >= quiz.pass_score, results };
}

// ───────────── Final project ─────────────

interface ProjectRow {
  id: string;
  course_id: string;
  title: string;
  brief: string;
  deliverables_json: string;
  criteria_json: string;
}

async function planOf(env: Env, courseId: string): Promise<PlanOut | null> {
  const row = await latestPlan(env, courseId);
  return row ? (JSON.parse(row.plan_json) as PlanOut) : null;
}

export async function projectState(ctx: AIContext, course: CourseRow): Promise<'none' | 'pending' | 'passed'> {
  const plan = await planOf(ctx.env, course.id);
  if (!plan?.final_project) return 'none';
  const passed = await ctx.env.DB.prepare(
    `SELECT 1 FROM project_submissions s JOIN projects p ON p.id = s.project_id WHERE p.course_id = ? AND s.user_id = ? AND s.passed = 1`,
  )
    .bind(course.id, ctx.userId)
    .first();
  return passed ? 'passed' : 'pending';
}

export async function projectDTO(env: Env, userId: string, courseId: string): Promise<ProjectDTO | null> {
  const p = await env.DB.prepare('SELECT * FROM projects WHERE course_id = ?').bind(courseId).first<ProjectRow>();
  if (!p) return null;
  const sub = await env.DB.prepare('SELECT * FROM project_submissions WHERE project_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1')
    .bind(p.id, userId)
    .first<{ content: string; score: number; passed: number; evaluation_json: string; created_at: string }>();
  return {
    id: p.id,
    title: p.title,
    brief: p.brief,
    deliverables: parseJson<string[]>(p.deliverables_json, []),
    criteria: parseJson<string[]>(p.criteria_json, []),
    last_submission: sub
      ? {
          content: sub.content,
          score: sub.score,
          passed: Boolean(sub.passed),
          evaluation: parseJson<ProjectEvaluation>(sub.evaluation_json, { summary: '', criteria: [], strengths: [], improvements: [] }),
          created_at: sub.created_at,
        }
      : null,
  };
}

export async function getOrCreateProject(ctx: AIContext, courseId: string): Promise<ProjectDTO> {
  const { env, userId } = ctx;
  const course = await requireCourse(env, userId, courseId);
  const existing = await projectDTO(env, userId, courseId);
  if (existing) return existing;
  const plan = await planOf(env, courseId);
  if (!plan?.final_project) throw notFound('Proyecto final');
  const modules = await listModules(env, courseId);
  if (modules.some((m) => m.status !== 'completed')) throw conflict('Completa todas las etapas para desbloquear el proyecto final.');
  const concepts = await listConcepts(env, courseId);
  const out = await makeProject(ctx, {
    course: await courseCtx(env, course, userId),
    plan_project: plan.final_project,
    concepts: conceptCtx(concepts, await masteryMap(env, userId, courseId)),
  });
  await env.DB.prepare('INSERT OR IGNORE INTO projects (id, course_id, title, brief, deliverables_json, criteria_json) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(
      `${courseId}_project`,
      courseId,
      out.title.slice(0, 200),
      out.brief.slice(0, 4000),
      JSON.stringify(out.deliverables.slice(0, 6)),
      JSON.stringify(out.criteria.slice(0, 6)),
    )
    .run();
  return (await projectDTO(env, userId, courseId))!;
}

export async function submitProject(ctx: AIContext, courseId: string, content: string): Promise<ProjectDTO> {
  const { env, userId } = ctx;
  const course = await requireCourse(env, userId, courseId);
  const project = await projectDTO(env, userId, courseId);
  if (!project) throw notFound('Proyecto final');
  const evaluation = await evaluateProject(ctx, {
    course: await courseCtx(env, course, userId),
    project: { title: project.title, brief: project.brief, deliverables: project.deliverables, criteria: project.criteria } as ProjectOut,
    submission: content,
  });
  const score = Math.min(1, Math.max(0, evaluation.overall_score));
  const passed = score >= 0.7;
  const stored: ProjectEvaluation = {
    summary: evaluation.summary,
    criteria: evaluation.criteria.map((c) => ({ ...c, score: Math.min(1, Math.max(0, c.score)) })),
    strengths: evaluation.strengths,
    improvements: evaluation.improvements,
  };
  await env.DB.prepare(
    'INSERT INTO project_submissions (id, project_id, user_id, content, evaluation_json, score, passed) VALUES (?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(newId('ps_'), project.id, userId, content, JSON.stringify(stored), score, passed ? 1 : 0)
    .run();
  await touchCourse(env, courseId);
  await logActivity(env, userId, 'project_submitted', `${Math.round(score * 100)}%`, courseId);
  if (passed) await grantAchievement(env, userId, courseId, 'project_passed', `Proyecto final aprobado: ${course.title}`);
  return (await projectDTO(env, userId, courseId))!;
}

// ───────────── Certificate ─────────────

export const CERTIFICATE_DISCLAIMER =
  'Certificado de finalización emitido por la plataforma CursoAI. Acredita que la persona completó el curso y sus evaluaciones dentro de la plataforma. No es un título, diploma ni acreditación oficial.';

export async function issueCertificate(ctx: AIContext, courseId: string, recipientName: string): Promise<CertificateDTO> {
  const { env, userId } = ctx;
  const course = await requireCourse(env, userId, courseId);
  const existing = await env.DB.prepare('SELECT code FROM certificates WHERE user_id = ? AND course_id = ?').bind(userId, courseId).first<{ code: string }>();
  if (existing) return getCertificate(env, existing.code);
  const modules = await listModules(env, courseId);
  if (modules.length === 0 || modules.some((m) => m.status !== 'completed')) {
    throw conflict('Completa todas las etapas del curso para obtener el certificado.');
  }
  if ((await projectState(ctx, course)) === 'pending') throw conflict('Aprueba el proyecto final para obtener el certificado.');

  const quizScores = (
    await env.DB.prepare(`SELECT id FROM quizzes WHERE course_id = ? AND kind = 'stage'`).bind(courseId).all<{ id: string }>()
  ).results;
  const scores: number[] = [];
  for (const q of quizScores) {
    const r = await lastQuizResult(env, userId, q.id);
    if (r) scores.push(r.score);
  }
  const project = await projectDTO(env, userId, courseId);
  if (project?.last_submission) scores.push(project.last_submission.score);
  const score = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 1;
  const concepts = await listConcepts(env, courseId);
  const mastery = await masteryMap(env, userId, courseId);
  const mastered = concepts.filter((c) => mastery.get(c.id)?.state === 'mastered').length;
  const hours = Math.round((modules.reduce((s, m) => s + m.estimated_minutes, 0) / 60) * 10) / 10;
  const code = humanCode(10);
  const name = recipientName.trim().slice(0, 120);
  if (!name) throw badRequest('Indica el nombre que aparecerá en el certificado.');

  await env.DB.prepare(
    `INSERT INTO certificates (id, user_id, course_id, code, recipient_name, course_title, goal_outcome, result_summary, score, hours)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      newId('ce_'),
      userId,
      courseId,
      code,
      name,
      course.title,
      course.goal_outcome,
      `${modules.length} etapas completadas · ${mastered} de ${concepts.length} conceptos dominados${project?.last_submission ? ' · proyecto final aprobado' : ''}`,
      Math.round(score * 1000) / 1000,
      hours,
    )
    .run();
  await logActivity(env, userId, 'certificate_issued', course.title, courseId);
  return getCertificate(env, code);
}

/** Public: anyone with the code can verify a certificate. Exposes only certificate fields. */
export async function getCertificate(env: Env, code: string): Promise<CertificateDTO> {
  const row = await env.DB.prepare(
    'SELECT code, recipient_name, course_title, goal_outcome, result_summary, score, hours, issued_at FROM certificates WHERE code = ?',
  )
    .bind(code.toUpperCase())
    .first<Omit<CertificateDTO, 'disclaimer'>>();
  if (!row) throw notFound('Certificado');
  return { ...row, disclaimer: CERTIFICATE_DISCLAIMER };
}
