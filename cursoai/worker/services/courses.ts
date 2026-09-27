import type { Env } from '../env';
import { conflict, HttpError, notFound } from '../http';
import { assertCanCreateCourse } from '../guard';
import {
  grantAchievement,
  latestPlan,
  listConcepts,
  listModules,
  logActivity,
  masteryMap,
  preferences,
  requireCourse,
  type CourseRow,
  type PlanRow,
} from '../db';
import { humanCode, newId, parseJson } from '../util';
import type { AIContext } from '../ai/runner';
import { addStageToPlan, generatePlan, interpretRequest, revisePlan } from '../ai/tasks';
import { disclaimerFor, isBlockedRequest } from '../ai/safety';
import type { IntakeOut, PlanOut, StageOut } from '../ai/schemas';
import { aggregateState, averageScore, courseProgress } from './mastery';
import type {
  CompetencyDTO,
  ConceptDTO,
  CourseDetail,
  CoursePlan,
  CourseSummary,
  DashboardDTO,
  Intake,
  LessonSummary,
  ModuleDTO,
  UserDTO,
} from '../../shared/types';
import { ensureStageOutline } from './learning';
import { projectDTO } from './outcomes';

// ───────────── Creation & diagnosis ─────────────

interface StoredIntake {
  intake: IntakeOut;
  answers: Record<string, string>;
}

export async function createCourse(ctx: AIContext, request: string) {
  const { env, userId } = ctx;
  if (isBlockedRequest(request)) {
    throw new HttpError(422, 'topic_not_allowed', 'No podemos crear un curso sobre ese tema. Prueba con otro objetivo de aprendizaje.');
  }
  await assertCanCreateCourse(env, userId, ctx.plan);
  const profile = await env.DB.prepare('SELECT background FROM user_profiles WHERE user_id = ?').bind(userId).first<{ background: string }>();
  const intake = await interpretRequest(ctx, { request, background: profile?.background ?? '' });
  if (!intake.allowed) {
    throw new HttpError(422, 'topic_not_allowed', intake.refusal_reason || 'No podemos crear un curso sobre ese tema.');
  }
  // Never ask about what the learner already told us, and never more than 3 questions.
  const questions = intake.questions
    .filter((q) => !(q.id === 'level' && intake.level_explicit))
    .filter((q) => !(q.id === 'goal' && intake.goal_explicit))
    .filter((q) => !(q.id === 'time' && intake.daily_minutes))
    .slice(0, 3)
    .map((q) => ({ ...q, options: q.options.slice(0, 4) }));
  const clean: IntakeOut = { ...intake, questions };

  const id = newId('c_');
  const stored: StoredIntake = { intake: clean, answers: {} };
  await env.DB.prepare(
    `INSERT INTO courses (id, user_id, title, topic, goal, goal_type, level, domain, sensitivity, volatility, status, original_request, intake_json, daily_minutes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'diagnosing', ?, ?, ?)`,
  )
    .bind(
      id,
      userId,
      clean.topic.slice(0, 120),
      clean.topic.slice(0, 120),
      clean.goal.slice(0, 300),
      clean.goal_type,
      clean.level ?? 'beginner',
      clean.domain,
      clean.sensitivity,
      clean.volatility,
      request,
      JSON.stringify(stored),
      clean.daily_minutes,
    )
    .run();
  await logActivity(env, userId, 'course_created', clean.topic, id);
  return { course_id: id, intake: toIntakeDTO(clean) };
}

function toIntakeDTO(i: IntakeOut): Intake {
  return {
    topic: i.topic,
    goal: i.goal,
    goal_type: i.goal_type,
    level: i.level,
    daily_minutes: i.daily_minutes,
    prior_knowledge: i.prior_knowledge,
    domain: i.domain,
    sensitivity: i.sensitivity,
    volatility: i.volatility,
    questions: i.questions,
  };
}

// ───────────── Plan ─────────────

function sanitizePlan(plan: PlanOut): PlanOut {
  const stages = plan.stages.slice(0, 8).map((s) => ({
    ...s,
    title: s.title.slice(0, 120),
    estimated_minutes: Math.min(600, Math.max(10, Math.round(s.estimated_minutes))),
    concepts: s.concepts.slice(0, 6),
    activity_types: s.activity_types.length ? s.activity_types.slice(0, 7) : (['lesson', 'practice'] as StageOut['activity_types']),
  }));
  if (stages.length === 0) throw new HttpError(502, 'ai_unavailable', 'La IA devolvió un plan vacío. Inténtalo de nuevo.');
  return {
    ...plan,
    stages,
    competencies: plan.competencies.slice(0, 8),
    daily_minutes: Math.min(240, Math.max(5, Math.round(plan.daily_minutes))),
    estimated_hours: Math.max(0.5, Math.round(plan.estimated_hours * 10) / 10),
  };
}

export async function createPlan(ctx: AIContext, courseId: string, answers: Record<string, string>) {
  const { env, userId } = ctx;
  const course = await requireCourse(env, userId, courseId);
  if (course.status !== 'diagnosing' && course.status !== 'planning') throw conflict('El plan de este curso ya fue aceptado.');
  const stored = parseJson<StoredIntake | null>(course.intake_json, null);
  if (!stored) throw new HttpError(500, 'internal', 'Curso sin diagnóstico.');
  const questionText = new Map(stored.intake.questions.map((q) => [q.id, q.question]));
  const cleanAnswers: Record<string, string> = {};
  for (const [k, v] of Object.entries(answers)) {
    if (questionText.has(k as never) && v.trim()) cleanAnswers[k] = v.trim().slice(0, 300);
  }
  const prefs = await preferences(env, userId);
  const plan = sanitizePlan(
    await generatePlan(ctx, {
      intake: {
        topic: stored.intake.topic,
        goal: stored.intake.goal,
        goal_type: stored.intake.goal_type,
        level: stored.intake.level,
        daily_minutes: stored.intake.daily_minutes,
        prior_knowledge: stored.intake.prior_knowledge,
        domain: stored.intake.domain,
        sensitivity: stored.intake.sensitivity,
      },
      answers: Object.entries(cleanAnswers).map(([id, answer]) => ({ question: questionText.get(id as never) ?? id, answer })),
      preferences: { daily_minutes: prefs.daily_minutes, explanation_style: prefs.explanation_style, practice_first: Boolean(prefs.practice_first) },
      request: course.original_request,
    }),
  );
  const prev = await latestPlan(env, courseId);
  const version = (prev?.version ?? 0) + 1;
  await env.DB.batch([
    env.DB.prepare(`UPDATE course_plans SET status = 'superseded' WHERE course_id = ? AND status = 'draft'`).bind(courseId),
    env.DB.prepare('INSERT INTO course_plans (id, course_id, version, plan_json, status) VALUES (?, ?, ?, ?, ?)').bind(
      newId('p_'),
      courseId,
      version,
      JSON.stringify(plan),
      'draft',
    ),
    env.DB.prepare(
      `UPDATE courses SET status = 'planning', title = ?, goal_outcome = ?, level = ?, daily_minutes = ?, intake_json = ?,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`,
    ).bind(plan.title.slice(0, 120), plan.goal_outcome, plan.level, plan.daily_minutes, JSON.stringify({ ...stored, answers: cleanAnswers }), courseId),
  ]);
  return courseDetail(env, userId, courseId);
}

export async function revisePlanFor(ctx: AIContext, courseId: string, feedback: string) {
  const { env, userId } = ctx;
  const course = await requireCourse(env, userId, courseId);
  if (course.status !== 'planning') throw conflict('Solo puedes modificar el plan antes de aceptarlo. Usa "Agregar contenido" en cursos activos.');
  const current = await latestPlan(env, courseId);
  if (!current) throw notFound('Plan');
  const plan = sanitizePlan(
    await revisePlan(ctx, { plan: JSON.parse(current.plan_json) as PlanOut, feedback, sensitivity: course.sensitivity }),
  );
  await env.DB.batch([
    env.DB.prepare(`UPDATE course_plans SET status = 'superseded' WHERE id = ?`).bind(current.id),
    env.DB.prepare('INSERT INTO course_plans (id, course_id, version, plan_json, status, feedback) VALUES (?, ?, ?, ?, ?, ?)').bind(
      newId('p_'),
      courseId,
      current.version + 1,
      JSON.stringify(plan),
      'draft',
      feedback,
    ),
    env.DB.prepare(
      `UPDATE courses SET title = ?, goal_outcome = ?, level = ?, daily_minutes = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`,
    ).bind(plan.title.slice(0, 120), plan.goal_outcome, plan.level, plan.daily_minutes, courseId),
  ]);
  await logActivity(env, userId, 'plan_revised', feedback, courseId);
  return courseDetail(env, userId, courseId);
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/** Turn an accepted plan into stages, competencies and concepts (no AI). */
function materializeStatements(env: Env, courseId: string, startPosition: number, stages: StageOut[], competencyIds: Map<string, string>) {
  const stmts: D1PreparedStatement[] = [];
  const moduleIds: string[] = [];
  let conceptPos = startPosition * 10;
  stages.forEach((stage, i) => {
    const moduleId = newId('m_');
    moduleIds.push(moduleId);
    stmts.push(
      env.DB.prepare(
        'INSERT INTO modules (id, course_id, position, title, kind_label, objective, estimated_minutes, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ).bind(moduleId, courseId, startPosition + i, stage.title, stage.kind_label.slice(0, 40) || 'Etapa', stage.objective, stage.estimated_minutes, 'locked'),
    );
    const stageComps = stage.competencies.map((c) => competencyIds.get(norm(c))).filter(Boolean) as string[];
    const fallbackComp = competencyIds.values().next().value ?? null;
    stage.concepts.forEach((concept, j) => {
      stmts.push(
        env.DB.prepare(
          'INSERT INTO concepts (id, course_id, module_id, competency_id, position, name, description) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ).bind(
          newId('k_'),
          courseId,
          moduleId,
          stageComps.length ? stageComps[j % stageComps.length] : fallbackComp,
          conceptPos++,
          concept.name.slice(0, 120),
          concept.description.slice(0, 400),
        ),
      );
    });
  });
  return { stmts, moduleIds };
}

export async function acceptPlan(ctx: AIContext, courseId: string) {
  const { env, userId } = ctx;
  const course = await requireCourse(env, userId, courseId);
  if (course.status !== 'planning') throw conflict('Este curso no tiene un plan pendiente de aceptar.');
  const current = await latestPlan(env, courseId);
  if (!current || current.status !== 'draft') throw notFound('Plan');
  const plan = JSON.parse(current.plan_json) as PlanOut;

  const competencyIds = new Map<string, string>();
  const stmts: D1PreparedStatement[] = [];
  plan.competencies.forEach((c, i) => {
    const id = newId('cp_');
    competencyIds.set(norm(c.name), id);
    stmts.push(
      env.DB.prepare('INSERT INTO competencies (id, course_id, position, name, description) VALUES (?, ?, ?, ?, ?)').bind(
        id,
        courseId,
        i,
        c.name.slice(0, 120),
        c.description.slice(0, 400),
      ),
    );
  });
  // Stage competencies the model named but did not list globally still get a row.
  for (const stage of plan.stages) {
    for (const name of stage.competencies) {
      if (!competencyIds.has(norm(name))) {
        const id = newId('cp_');
        competencyIds.set(norm(name), id);
        stmts.push(
          env.DB.prepare('INSERT INTO competencies (id, course_id, position, name, description) VALUES (?, ?, ?, ?, ?)').bind(
            id,
            courseId,
            competencyIds.size,
            name.slice(0, 120),
            '',
          ),
        );
      }
    }
  }
  const mat = materializeStatements(env, courseId, 0, plan.stages, competencyIds);
  stmts.push(...mat.stmts);
  stmts.push(env.DB.prepare(`UPDATE modules SET status = 'available' WHERE id = ?`).bind(mat.moduleIds[0]));
  stmts.push(env.DB.prepare(`UPDATE course_plans SET status = 'accepted' WHERE id = ?`).bind(current.id));
  stmts.push(
    env.DB.prepare(
      `UPDATE courses SET status = 'active', current_module_id = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
       last_activity_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`,
    ).bind(mat.moduleIds[0], courseId),
  );
  await env.DB.batch(stmts);
  await logActivity(env, userId, 'plan_accepted', plan.title, courseId);
  await grantAchievement(env, userId, courseId, 'plan_accepted', 'Primer paso: plan aceptado');
  // Generate only the first stage now; later stages are generated when reached.
  await ensureStageOutline(ctx, course.id, mat.moduleIds[0]);
  return courseDetail(env, userId, courseId);
}

// ───────────── Read models ─────────────

async function lessonCounts(env: Env, userId: string, courseIds: string[]) {
  if (courseIds.length === 0) return new Map<string, { total: number; done: number }>();
  const placeholders = courseIds.map(() => '?').join(',');
  const rows = (
    await env.DB.prepare(
      `SELECT l.course_id AS course_id, COUNT(*) AS total,
         SUM(CASE WHEN lp.status = 'completed' THEN 1 ELSE 0 END) AS done
       FROM lessons l LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = ?
       WHERE l.course_id IN (${placeholders}) GROUP BY l.course_id`,
    )
      .bind(userId, ...courseIds)
      .all<{ course_id: string; total: number; done: number | null }>()
  ).results;
  return new Map(rows.map((r) => [r.course_id, { total: r.total, done: r.done ?? 0 }]));
}

export async function courseSummaries(env: Env, userId: string, courses: CourseRow[]): Promise<CourseSummary[]> {
  const ids = courses.map((c) => c.id);
  const counts = await lessonCounts(env, userId, ids);
  const placeholders = ids.map(() => '?').join(',');
  const conceptStats = ids.length
    ? new Map(
        (
          await env.DB.prepare(
            `SELECT k.course_id AS course_id, COUNT(*) AS total,
               SUM(CASE WHEN m.state = 'mastered' THEN 1 ELSE 0 END) AS mastered,
               SUM(CASE WHEN m.state = 'needs_reinforcement' THEN 1 ELSE 0 END) AS weak
             FROM concepts k LEFT JOIN concept_mastery m ON m.concept_id = k.id AND m.user_id = ?
             WHERE k.course_id IN (${placeholders}) GROUP BY k.course_id`,
          )
            .bind(userId, ...ids)
            .all<{ course_id: string; total: number; mastered: number | null; weak: number | null }>()
        ).results.map((r) => [r.course_id, r]),
      )
    : new Map();
  const stageCounts = ids.length
    ? new Map(
        (
          await env.DB.prepare(`SELECT course_id, COUNT(*) AS n FROM modules WHERE course_id IN (${placeholders}) GROUP BY course_id`)
            .bind(...ids)
            .all<{ course_id: string; n: number }>()
        ).results.map((r) => [r.course_id, r.n]),
      )
    : new Map();
  const lessonTitles = new Map<string, string>();
  const currentIds = courses.map((c) => c.current_lesson_id).filter(Boolean) as string[];
  if (currentIds.length) {
    const rows = (
      await env.DB.prepare(`SELECT id, title FROM lessons WHERE id IN (${currentIds.map(() => '?').join(',')})`)
        .bind(...currentIds)
        .all<{ id: string; title: string }>()
    ).results;
    for (const r of rows) lessonTitles.set(r.id, r.title);
  }

  return courses.map((c) => {
    const lc = counts.get(c.id) ?? { total: 0, done: 0 };
    const cs = conceptStats.get(c.id) ?? { total: 0, mastered: 0, weak: 0 };
    // Stages not yet outlined still count: assume ~4 activities per stage.
    const stages = stageCounts.get(c.id) ?? 0;
    const planned = Math.max(lc.total, stages * 4);
    return {
      id: c.id,
      title: c.title,
      topic: c.topic,
      goal: c.goal,
      goal_outcome: c.goal_outcome,
      level: c.level,
      status: c.status,
      sensitivity: c.sensitivity,
      progress: courseProgress({
        completedLessons: lc.done,
        plannedLessons: planned,
        masteredConcepts: cs.mastered ?? 0,
        totalConcepts: cs.total,
        completed: c.status === 'completed',
      }),
      shared: Boolean(c.share_code),
      source_course_id: c.source_course_id,
      last_activity_at: c.last_activity_at,
      created_at: c.created_at,
      current_lesson: c.current_lesson_id && lessonTitles.has(c.current_lesson_id)
        ? { id: c.current_lesson_id, title: lessonTitles.get(c.current_lesson_id)! }
        : null,
      weak_concepts: cs.weak ?? 0,
      mastered_concepts: cs.mastered ?? 0,
      total_concepts: cs.total,
    };
  });
}

export async function listCourses(env: Env, userId: string): Promise<CourseSummary[]> {
  const rows = (
    await env.DB.prepare('SELECT * FROM courses WHERE user_id = ? ORDER BY last_activity_at DESC').bind(userId).all<CourseRow>()
  ).results;
  return courseSummaries(env, userId, rows);
}

export async function courseDetail(env: Env, userId: string, courseId: string): Promise<CourseDetail> {
  const course = await requireCourse(env, userId, courseId);
  const [summary] = await courseSummaries(env, userId, [course]);
  const planRow = await latestPlan(env, courseId);
  const modules = await listModules(env, courseId);
  const concepts = await listConcepts(env, courseId);
  const mastery = await masteryMap(env, userId, courseId);
  const competencies = (
    await env.DB.prepare('SELECT * FROM competencies WHERE course_id = ? ORDER BY position').bind(courseId).all<{
      id: string;
      name: string;
      description: string;
    }>()
  ).results;
  const lessons = (
    await env.DB.prepare(
      `SELECT l.id, l.module_id, l.position, l.type, l.title, l.goal, l.status AS gen_status, COALESCE(lp.status, 'not_started') AS status
       FROM lessons l LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = ?
       WHERE l.course_id = ? ORDER BY l.position`,
    )
      .bind(userId, courseId)
      .all<LessonSummary & { gen_status: string }>()
  ).results;
  const stored = parseJson<StoredIntake | null>(course.intake_json, null);
  const certificate = await env.DB.prepare('SELECT code FROM certificates WHERE user_id = ? AND course_id = ?')
    .bind(userId, courseId)
    .first<{ code: string }>();

  const conceptDTOs: ConceptDTO[] = concepts.map((k) => {
    const m = mastery.get(k.id);
    return {
      id: k.id,
      name: k.name,
      description: k.description,
      module_id: k.module_id,
      competency_id: k.competency_id,
      state: m?.state ?? 'not_started',
      score: m?.score ?? 0,
    };
  });
  const competencyDTOs: CompetencyDTO[] = competencies.map((c) => {
    const cs = conceptDTOs.filter((k) => k.competency_id === c.id);
    return {
      id: c.id,
      name: c.name,
      description: c.description,
      state: aggregateState(cs.map((k) => k.state)),
      score: averageScore(cs.map((k) => k.score)),
      concepts: cs.length,
    };
  });
  const moduleDTOs: ModuleDTO[] = modules.map((m) => ({
    id: m.id,
    position: m.position,
    title: m.title,
    kind_label: m.kind_label,
    objective: m.objective,
    estimated_minutes: m.estimated_minutes,
    status: m.status,
    lessons: lessons
      .filter((l) => l.module_id === m.id)
      .map(({ gen_status, ...l }) => ({ ...l, ready: gen_status === 'ready' })),
  }));

  return {
    course: {
      ...summary,
      domain: course.domain,
      volatility: course.volatility,
      daily_minutes: course.daily_minutes,
      intake: stored ? toIntakeDTO(stored.intake) : null,
      diagnostic_answers: stored?.answers ?? {},
    },
    plan: planRow
      ? { id: planRow.id, version: planRow.version, status: planRow.status, plan: JSON.parse(planRow.plan_json) as CoursePlan, feedback: planRow.feedback }
      : null,
    modules: moduleDTOs,
    competencies: competencyDTOs,
    concepts: conceptDTOs,
    project: await projectDTO(env, userId, courseId),
    certificate: certificate ?? null,
    disclaimer: disclaimerFor(course.sensitivity),
  };
}

// ───────────── Dashboard & memory ─────────────

function relativeDays(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000);
  if (days <= 0) return 'hoy';
  if (days === 1) return 'ayer';
  return `hace ${days} días`;
}

export async function dashboard(env: Env, user: UserDTO): Promise<DashboardDTO> {
  const courses = await listCourses(env, user.id);
  const active = courses.filter((c) => c.status === 'active');
  const last = active[0] ?? null;
  let resume: DashboardDTO['resume'] = null;
  if (last) {
    const lesson = last.current_lesson;
    resume = {
      course_id: last.id,
      course_title: last.title,
      lesson_id: lesson?.id ?? null,
      lesson_title: lesson?.title ?? null,
      last_activity_at: last.last_activity_at,
      message: lesson
        ? `La última vez (${relativeDays(last.last_activity_at)}) estabas trabajando en «${lesson.title}» de «${last.title}».`
        : `Tu curso «${last.title}» te espera. Empieza por la primera actividad.`,
    };
  }
  const recommendations: DashboardDTO['recommendations'] = [];
  for (const c of courses) {
    if (c.status === 'active' && c.weak_concepts > 0) {
      const weak = await env.DB.prepare(
        `SELECT k.name FROM concept_mastery m JOIN concepts k ON k.id = m.concept_id
         WHERE m.user_id = ? AND m.course_id = ? AND m.state = 'needs_reinforcement' LIMIT 1`,
      )
        .bind(user.id, c.id)
        .first<{ name: string }>();
      if (weak) recommendations.push({ course_id: c.id, text: `Refuerza «${weak.name}» en ${c.title}: tienes una actividad de refuerzo lista.` });
    } else if (c.status === 'active' && Date.now() - new Date(c.last_activity_at).getTime() > 3 * 86400_000) {
      recommendations.push({ course_id: c.id, text: `Llevas ${relativeDays(c.last_activity_at).replace('hace ', '')} sin practicar ${c.title}. 15 minutos hoy bastan para no perder el ritmo.` });
    } else if (c.status === 'paused') {
      recommendations.push({ course_id: c.id, text: `¿Retomamos «${c.title}»? Vas en ${c.progress}%.` });
    } else if (c.status === 'planning') {
      recommendations.push({ course_id: c.id, text: `Tu plan para «${c.title}» está listo para revisar y aceptar.` });
    }
  }
  return { user, resume, courses, recommendations: recommendations.slice(0, 4) };
}

// ───────────── Library operations ─────────────

export async function setStatus(env: Env, userId: string, courseId: string, status: 'active' | 'paused') {
  const course = await requireCourse(env, userId, courseId);
  if (course.status !== 'active' && course.status !== 'paused') throw conflict('Solo puedes pausar o reanudar cursos en marcha.');
  await env.DB.prepare(`UPDATE courses SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`).bind(status, courseId).run();
  await logActivity(env, userId, status === 'paused' ? 'course_paused' : 'course_resumed', course.title, courseId);
}

export async function renameCourse(env: Env, userId: string, courseId: string, title: string) {
  await requireCourse(env, userId, courseId);
  await env.DB.prepare(`UPDATE courses SET title = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`).bind(title, courseId).run();
}

export async function deleteCourse(env: Env, userId: string, courseId: string) {
  await requireCourse(env, userId, courseId);
  await env.DB.prepare('DELETE FROM courses WHERE id = ? AND user_id = ?').bind(courseId, userId).run();
}

/** Copy a course's plan into a new course the user reviews and accepts. Progress is not copied. */
async function cloneFromPlan(env: Env, userId: string, source: CourseRow, planRow: PlanRow, title: string): Promise<string> {
  const id = newId('c_');
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO courses (id, user_id, title, topic, goal, goal_type, goal_outcome, level, domain, sensitivity, volatility, status,
         original_request, intake_json, daily_minutes, source_course_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'planning', ?, ?, ?, ?)`,
    ).bind(
      id,
      userId,
      title.slice(0, 120),
      source.topic,
      source.goal,
      source.goal_type,
      source.goal_outcome,
      source.level,
      source.domain,
      source.sensitivity,
      source.volatility,
      source.original_request,
      source.intake_json,
      source.daily_minutes,
      source.id,
    ),
    env.DB.prepare('INSERT INTO course_plans (id, course_id, version, plan_json, status) VALUES (?, ?, 1, ?, ?)').bind(
      newId('p_'),
      id,
      planRow.plan_json,
      'draft',
    ),
  ]);
  return id;
}

export async function duplicateCourse(ctx: AIContext, courseId: string) {
  const { env, userId } = ctx;
  const course = await requireCourse(env, userId, courseId);
  const planRow = await latestPlan(env, courseId);
  if (!planRow) throw conflict('Este curso aún no tiene plan que duplicar.');
  await assertCanCreateCourse(env, userId, ctx.plan);
  const id = await cloneFromPlan(env, userId, course, planRow, `${course.title} (copia)`);
  await logActivity(env, userId, 'course_duplicated', course.title, id);
  return { course_id: id };
}

export async function resetProgress(env: Env, userId: string, courseId: string) {
  const course = await requireCourse(env, userId, courseId);
  if (course.status === 'diagnosing' || course.status === 'planning') throw conflict('Este curso aún no tiene progreso.');
  const modules = await listModules(env, courseId);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM lesson_progress WHERE user_id = ? AND course_id = ?').bind(userId, courseId),
    env.DB.prepare('DELETE FROM concept_mastery WHERE user_id = ? AND course_id = ?').bind(userId, courseId),
    env.DB.prepare('DELETE FROM answers WHERE user_id = ? AND course_id = ?').bind(userId, courseId),
    env.DB.prepare('DELETE FROM quizzes WHERE course_id = ?').bind(courseId),
    env.DB.prepare(`DELETE FROM lessons WHERE course_id = ? AND type = 'reinforcement'`).bind(courseId),
    env.DB.prepare('DELETE FROM project_submissions WHERE user_id = ? AND project_id IN (SELECT id FROM projects WHERE course_id = ?)').bind(userId, courseId),
    env.DB.prepare('DELETE FROM certificates WHERE user_id = ? AND course_id = ?').bind(userId, courseId),
    env.DB.prepare(`UPDATE modules SET status = CASE WHEN position = ? THEN 'available' ELSE 'locked' END WHERE course_id = ?`).bind(
      modules[0]?.position ?? 0,
      courseId,
    ),
    env.DB.prepare(
      `UPDATE courses SET status = 'active', completed_at = NULL, current_lesson_id = NULL, current_module_id = ?,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`,
    ).bind(modules[0]?.id ?? null, courseId),
  ]);
  await logActivity(env, userId, 'progress_reset', course.title, courseId);
}

export async function setSharing(env: Env, userId: string, courseId: string, enabled: boolean) {
  const course = await requireCourse(env, userId, courseId);
  if (enabled && !(await latestPlan(env, courseId))) throw conflict('Genera el plan antes de compartir el curso.');
  const code = enabled ? course.share_code ?? humanCode(10) : null;
  await env.DB.prepare('UPDATE courses SET share_code = ? WHERE id = ?').bind(code, courseId).run();
  return { share_code: code };
}

export async function sharedPreview(env: Env, code: string) {
  const course = await env.DB.prepare('SELECT * FROM courses WHERE share_code = ?').bind(code).first<CourseRow>();
  if (!course) throw notFound('Curso compartido');
  const planRow = await latestPlan(env, course.id);
  if (!planRow) throw notFound('Curso compartido');
  const plan = JSON.parse(planRow.plan_json) as CoursePlan;
  // Only the plan is shared: no progress, answers or personal data.
  return { code, title: course.title, topic: course.topic, level: course.level, plan, disclaimer: disclaimerFor(course.sensitivity) };
}

export async function importShared(ctx: AIContext, code: string) {
  const { env, userId } = ctx;
  const course = await env.DB.prepare('SELECT * FROM courses WHERE share_code = ?').bind(code).first<CourseRow>();
  if (!course) throw notFound('Curso compartido');
  const planRow = await latestPlan(env, course.id);
  if (!planRow) throw notFound('Curso compartido');
  await assertCanCreateCourse(env, userId, ctx.plan);
  const id = await cloneFromPlan(env, userId, course, planRow, course.title);
  await logActivity(env, userId, 'course_imported', course.title, id);
  return { course_id: id };
}

export async function addContent(ctx: AIContext, courseId: string, request: string) {
  const { env, userId } = ctx;
  const course = await requireCourse(env, userId, courseId);
  if (!['active', 'paused', 'completed'].includes(course.status)) throw conflict('Acepta el plan antes de agregar contenido.');
  const planRow = await env.DB.prepare(`SELECT * FROM course_plans WHERE course_id = ? AND status = 'accepted' ORDER BY version DESC LIMIT 1`)
    .bind(courseId)
    .first<PlanRow>();
  if (!planRow) throw notFound('Plan');
  const plan = JSON.parse(planRow.plan_json) as PlanOut;
  const { stage, insert_after } = await addStageToPlan(ctx, { plan, request, sensitivity: course.sensitivity });
  const [cleanStage] = sanitizePlan({ ...plan, stages: [stage] }).stages;

  const modules = await listModules(env, courseId);
  const after = Math.min(Math.max(insert_after, -1), modules.length - 1);
  const insertPos = after + 1;
  const competencyRows = (
    await env.DB.prepare('SELECT id, name FROM competencies WHERE course_id = ?').bind(courseId).all<{ id: string; name: string }>()
  ).results;
  const competencyIds = new Map(competencyRows.map((c) => [norm(c.name), c.id]));
  const newPlan: PlanOut = { ...plan, stages: [...plan.stages.slice(0, insertPos), cleanStage, ...plan.stages.slice(insertPos)] };
  const stmts: D1PreparedStatement[] = [
    env.DB.prepare('UPDATE modules SET position = position + 1 WHERE course_id = ? AND position >= ?').bind(courseId, insertPos),
  ];
  for (const name of cleanStage.competencies) {
    if (!competencyIds.has(norm(name))) {
      const id = newId('cp_');
      competencyIds.set(norm(name), id);
      stmts.push(env.DB.prepare('INSERT INTO competencies (id, course_id, position, name) VALUES (?, ?, ?, ?)').bind(id, courseId, competencyIds.size, name));
    }
  }
  const mat = materializeStatements(env, courseId, insertPos, [cleanStage], competencyIds);
  stmts.push(...mat.stmts);
  // A new stage before the learner's current point, or after a finished course, becomes the next thing to do.
  const firstOpen = modules.find((m) => m.status !== 'completed');
  if (!firstOpen || firstOpen.position >= insertPos) {
    stmts.push(env.DB.prepare(`UPDATE modules SET status = 'locked' WHERE course_id = ? AND status = 'available'`).bind(courseId));
    stmts.push(env.DB.prepare(`UPDATE modules SET status = 'available' WHERE id = ?`).bind(mat.moduleIds[0]));
  }
  stmts.push(env.DB.prepare(`UPDATE course_plans SET status = 'superseded' WHERE id = ?`).bind(planRow.id));
  stmts.push(
    env.DB.prepare('INSERT INTO course_plans (id, course_id, version, plan_json, status, feedback) VALUES (?, ?, ?, ?, ?, ?)').bind(
      newId('p_'),
      courseId,
      (await latestPlan(env, courseId))!.version + 1,
      JSON.stringify(newPlan),
      'accepted',
      `Agregar: ${request}`,
    ),
  );
  if (course.status === 'completed') {
    stmts.push(env.DB.prepare(`UPDATE courses SET status = 'active', completed_at = NULL WHERE id = ?`).bind(courseId));
  }
  await env.DB.batch(stmts);
  await logActivity(env, userId, 'content_added', request, courseId);
  return courseDetail(env, userId, courseId);
}

