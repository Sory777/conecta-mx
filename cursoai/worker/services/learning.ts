// The adaptive learning loop: stage outlines and activity content on demand,
// grading, mastery updates, reinforcement and the "what next" policy.

import type { Env } from '../env';
import { badRequest, conflict, HttpError, notFound } from '../http';
import {
  grantAchievement,
  latestPlan,
  listConcepts,
  listModules,
  logActivity,
  masteryMap,
  preferences,
  requireCourse,
  requireExercise,
  requireLesson,
  touchCourse,
  type ConceptRow,
  type CourseRow,
  type ExerciseRow,
  type LessonRow,
  type MasteryRow,
  type ModuleRow,
} from '../db';
import { newId, nowIso, parseJson } from '../util';
import type { AIContext } from '../ai/runner';
import {
  activityContent,
  evaluateAnswer,
  outlineStage,
  reinforcementContent,
  researchTopic,
  type ConceptCtx,
  type CourseCtx,
} from '../ai/tasks';
import { disclaimerFor, VOLATILE_DOMAINS } from '../ai/safety';
import type { ActivityContentOut, PlanOut } from '../ai/schemas';
import { applyResult, EMPTY_MASTERY, stageReady, type MasteryRecord } from './mastery';
import { AUTO_GRADED, gradeAuto, normalizeExercise, verdictFor, type AnswerKey } from './grading';
import { ensureStageQuiz, lastQuizResult, projectState } from './outcomes';
import type {
  AnswerResult,
  ContentBlock,
  ExerciseDTO,
  LessonDTO,
  NextStep,
  RegenAction,
  SourceDTO,
} from '../../shared/types';

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

export async function courseCtx(env: Env, course: CourseRow, userId: string): Promise<CourseCtx> {
  const prefs = await preferences(env, userId);
  return {
    title: course.title,
    topic: course.topic,
    goal: course.goal,
    goal_outcome: course.goal_outcome,
    level: course.level,
    domain: course.domain,
    sensitivity: course.sensitivity,
    daily_minutes: course.daily_minutes,
    explanation_style: prefs.explanation_style,
  };
}

export function conceptCtx(concepts: ConceptRow[], mastery: Map<string, MasteryRow>): ConceptCtx[] {
  return concepts.map((c) => ({
    name: c.name,
    description: c.description,
    state: mastery.get(c.id)?.state ?? 'not_started',
    last_error: mastery.get(c.id)?.last_error ?? null,
  }));
}

function matchConcept(name: string, concepts: ConceptRow[]): ConceptRow | undefined {
  const n = norm(name);
  return concepts.find((c) => norm(c.name) === n) ?? concepts.find((c) => n.includes(norm(c.name)) || norm(c.name).includes(n));
}

// ───────────── Stage outline ─────────────

async function performanceSummary(env: Env, userId: string, courseId: string): Promise<string> {
  const rows = (
    await env.DB.prepare(
      `SELECT k.name, m.state, m.score FROM concept_mastery m JOIN concepts k ON k.id = m.concept_id
       WHERE m.user_id = ? AND m.course_id = ? AND m.attempts > 0`,
    )
      .bind(userId, courseId)
      .all<{ name: string; state: string; score: number }>()
  ).results;
  if (rows.length === 0) return '';
  const mastered = rows.filter((r) => r.state === 'mastered').map((r) => r.name);
  const weak = rows.filter((r) => r.state === 'needs_reinforcement').map((r) => r.name);
  const avg = rows.reduce((s, r) => s + r.score, 0) / rows.length;
  return [
    `Puntuación media: ${Math.round(avg * 100)}%.`,
    mastered.length ? `Domina: ${mastered.join(', ')}.` : '',
    weak.length ? `Le cuesta: ${weak.join(', ')}.` : '',
    avg >= 0.85 ? 'Aprende rápido: puede avanzar con menos explicación.' : avg < 0.5 ? 'Necesita más práctica guiada.' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export async function ensureStageOutline(ctx: AIContext, courseId: string, moduleId: string): Promise<void> {
  const { env, userId } = ctx;
  const course = await requireCourse(env, userId, courseId);
  const mod = await env.DB.prepare('SELECT * FROM modules WHERE id = ? AND course_id = ?').bind(moduleId, courseId).first<ModuleRow>();
  if (!mod) throw notFound('Etapa');
  if (mod.outline_ready) return;

  const concepts = (await listConcepts(env, courseId)).filter((c) => c.module_id === moduleId);
  const mastery = await masteryMap(env, userId, courseId);
  const planRow = await latestPlan(env, courseId);
  const plan = planRow ? (JSON.parse(planRow.plan_json) as PlanOut) : null;
  const planStage = plan?.stages.find((s) => norm(s.title) === norm(mod.title));

  const outline = await outlineStage(ctx, {
    course: await courseCtx(env, course, userId),
    stage: {
      title: mod.title,
      kind_label: mod.kind_label,
      objective: mod.objective,
      estimated_minutes: mod.estimated_minutes,
      activity_types: planStage?.activity_types ?? ['lesson', 'practice'],
    },
    concepts: conceptCtx(concepts, mastery),
    performance: await performanceSummary(env, userId, courseId),
  });

  const activities = outline.activities.slice(0, 7);
  if (activities.length === 0) throw new HttpError(502, 'ai_unavailable', 'La IA no generó actividades. Inténtalo de nuevo.');
  const stmts = activities.map((a, i) => {
    const ids = a.concepts.map((n) => matchConcept(n, concepts)?.id).filter(Boolean) as string[];
    // Deterministic ids make concurrent generation idempotent.
    return env.DB.prepare(
      `INSERT OR IGNORE INTO lessons (id, course_id, module_id, position, type, title, goal, concept_ids_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      `${moduleId}_a${i}`,
      courseId,
      moduleId,
      mod.position * 100 + i,
      a.type,
      a.title.slice(0, 160),
      a.goal.slice(0, 400),
      JSON.stringify(ids.length ? [...new Set(ids)] : concepts.slice(0, 2).map((c) => c.id)),
    );
  });
  stmts.push(env.DB.prepare(`UPDATE modules SET outline_ready = 1 WHERE id = ?`).bind(moduleId));
  await env.DB.batch(stmts);
}

// ───────────── Activity content ─────────────

async function lessonConcepts(env: Env, userId: string, lesson: LessonRow) {
  const ids = parseJson<string[]>(lesson.concept_ids_json, []);
  const all = await listConcepts(env, lesson.course_id);
  const concepts = all.filter((c) => ids.includes(c.id));
  const mastery = await masteryMap(env, userId, lesson.course_id);
  return { concepts: concepts.length ? concepts : all.filter((c) => c.module_id === lesson.module_id).slice(0, 2), mastery };
}

function exerciseStatements(env: Env, lesson: LessonRow, content: ActivityContentOut, concepts: ConceptRow[], variant: string) {
  const stmts: D1PreparedStatement[] = [];
  let pos = 0;
  for (const ex of content.exercises.slice(0, 6)) {
    const n = normalizeExercise(ex);
    if (!n) continue;
    const concept = matchConcept(ex.concept, concepts) ?? concepts[0];
    stmts.push(
      env.DB.prepare(
        `INSERT OR IGNORE INTO exercises (id, lesson_id, course_id, concept_id, position, variant, kind, prompt, context, options_json, answer_json, rubric, explanation)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        `${lesson.id}_${variant || 'o'}_e${pos}`,
        lesson.id,
        lesson.course_id,
        concept?.id ?? null,
        pos,
        variant,
        n.kind,
        ex.prompt.slice(0, 3000),
        ex.context.slice(0, 4000),
        JSON.stringify(n.options),
        JSON.stringify(n.key),
        ex.rubric.slice(0, 2000),
        ex.explanation.slice(0, 2000),
      ),
    );
    pos++;
  }
  return stmts;
}

function cleanContent(content: ActivityContentOut): ActivityContentOut {
  return {
    intro: content.intro.slice(0, 1000),
    blocks: content.blocks.slice(0, 10).map((b) => ({ ...b, title: b.title.slice(0, 160), body: b.body.slice(0, 6000) })),
    exercises: content.exercises,
  };
}

async function generateLessonContent(ctx: AIContext, lesson: LessonRow, course: CourseRow): Promise<void> {
  const { env, userId } = ctx;
  const { concepts, mastery } = await lessonConcepts(env, userId, lesson);
  const cctx = await courseCtx(env, course, userId);
  const mod = await env.DB.prepare('SELECT title FROM modules WHERE id = ?').bind(lesson.module_id).first<{ title: string }>();
  let content: ActivityContentOut;
  let infoKind: 'general' | 'current' = 'general';
  let verifiedAt: string | null = null;
  let sources: { url: string; title: string; page_age: string | null }[] = [];

  if (lesson.type === 'reinforcement') {
    const concept = concepts[0];
    const errors = (
      await env.DB.prepare(
        `SELECT feedback_json FROM answers WHERE user_id = ? AND concept_id = ? AND verdict != 'correct' ORDER BY created_at DESC LIMIT 5`,
      )
        .bind(userId, concept.id)
        .all<{ feedback_json: string }>()
    ).results
      .map((r) => parseJson<{ misconception?: string | null; feedback?: string }>(r.feedback_json, {}))
      .map((f) => f.misconception || f.feedback || '')
      .filter(Boolean);
    const previous = (
      await env.DB.prepare(
        `SELECT content_json FROM lessons WHERE course_id = ? AND id != ? AND content_json IS NOT NULL AND concept_ids_json LIKE ?`,
      )
        .bind(course.id, lesson.id, `%${concept.id}%`)
        .all<{ content_json: string }>()
    ).results
      .map((r) => parseJson<ActivityContentOut | null>(r.content_json, null))
      .flatMap((c) => c?.blocks.map((b) => b.body) ?? [])
      .join('\n');
    content = await reinforcementContent(ctx, {
      course: cctx,
      concept: conceptCtx([concept], mastery)[0],
      errors,
      previous_explanation: previous,
    });
  } else {
    let research: { brief: string; retrieved_at: string } | null = null;
    if (course.volatility === 'changing' || VOLATILE_DOMAINS.has(course.domain)) {
      infoKind = 'current';
      const r = await researchTopic(ctx, { topic: course.topic, activity: lesson.title, concepts: concepts.map((c) => c.name) });
      if (r) {
        verifiedAt = nowIso();
        research = { brief: r.brief, retrieved_at: verifiedAt.slice(0, 10) };
        sources = r.sources;
      }
    }
    content = await activityContent(ctx, {
      course: cctx,
      stage_title: mod?.title ?? '',
      activity: { type: lesson.type, title: lesson.title, goal: lesson.goal },
      concepts: conceptCtx(concepts, mastery),
      research,
      variant: null,
    });
  }
  content = cleanContent(content);

  const claim = await env.DB.prepare(
    `UPDATE lessons SET content_json = ?, status = 'ready', info_kind = ?, verified_at = ?, generated_at = ? WHERE id = ? AND status = 'pending'`,
  )
    .bind(JSON.stringify({ intro: content.intro, blocks: content.blocks }), infoKind, verifiedAt, nowIso(), lesson.id)
    .run();
  if (!claim.meta.changes) return; // another request generated it first
  const stmts = exerciseStatements(env, lesson, content, concepts, '');
  sources.forEach((s, i) =>
    stmts.push(
      env.DB.prepare('INSERT OR IGNORE INTO sources (id, course_id, lesson_id, url, title, page_age) VALUES (?, ?, ?, ?, ?, ?)').bind(
        `${lesson.id}_s${i}`,
        course.id,
        lesson.id,
        s.url.slice(0, 1000),
        s.title.slice(0, 300),
        s.page_age,
      ),
    ),
  );
  if (stmts.length) await env.DB.batch(stmts);
}

async function exerciseDTOs(env: Env, userId: string, lessonId: string, variant: string): Promise<ExerciseDTO[]> {
  const rows = (
    await env.DB.prepare('SELECT * FROM exercises WHERE lesson_id = ? AND variant = ? ORDER BY position').bind(lessonId, variant).all<ExerciseRow>()
  ).results;
  const answers = (
    await env.DB.prepare(
      `SELECT exercise_id, score, verdict, feedback_json FROM answers
       WHERE user_id = ? AND exercise_id IN (SELECT id FROM exercises WHERE lesson_id = ?) ORDER BY created_at DESC`,
    )
      .bind(userId, lessonId)
      .all<{ exercise_id: string; score: number; verdict: AnswerResult['verdict']; feedback_json: string }>()
  ).results;
  const last = new Map<string, (typeof answers)[number]>();
  for (const a of answers) if (!last.has(a.exercise_id)) last.set(a.exercise_id, a);
  return rows.map((r) => {
    const a = last.get(r.id);
    const fb = a ? parseJson<Partial<AnswerResult>>(a.feedback_json, {}) : null;
    return {
      id: r.id,
      kind: r.kind,
      prompt: r.prompt,
      context: r.context,
      options: parseJson<string[]>(r.options_json, []),
      concept_id: r.concept_id,
      last_answer: a
        ? {
            verdict: a.verdict,
            score: a.score,
            feedback: fb?.feedback ?? '',
            correct_answer: fb?.correct_answer ?? null,
            misconception: fb?.misconception ?? null,
            next_turn: fb?.next_turn ?? null,
            mastery: null,
          }
        : null,
    };
  });
}

export async function getLesson(ctx: AIContext, lessonId: string): Promise<LessonDTO> {
  const { env, userId } = ctx;
  let { lesson, course } = await requireLesson(env, userId, lessonId);
  if (course.status === 'diagnosing' || course.status === 'planning') throw conflict('Acepta el plan antes de empezar.');
  if (lesson.status === 'pending') {
    await generateLessonContent(ctx, lesson, course);
    ({ lesson, course } = await requireLesson(env, userId, lessonId));
  }
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO lesson_progress (user_id, lesson_id, course_id, status, started_at) VALUES (?, ?, ?, 'in_progress', ?)
       ON CONFLICT(user_id, lesson_id) DO NOTHING`,
    ).bind(userId, lesson.id, course.id, nowIso()),
    env.DB.prepare(`UPDATE modules SET status = 'in_progress' WHERE id = ? AND status = 'available'`).bind(lesson.module_id),
  ]);
  await touchCourse(env, course.id, lesson.id, lesson.module_id);
  return lessonDTO(env, userId, lesson, course);
}

async function lessonDTO(env: Env, userId: string, lesson: LessonRow, course: CourseRow): Promise<LessonDTO> {
  const variants = parseJson<Record<string, { intro: string; blocks: ContentBlock[] }>>(lesson.variants_json, {});
  const active = lesson.active_variant && variants[lesson.active_variant] ? lesson.active_variant : null;
  const content = active ? variants[active] : parseJson<{ intro: string; blocks: ContentBlock[] }>(lesson.content_json, { intro: '', blocks: [] });
  const progress = await env.DB.prepare('SELECT status FROM lesson_progress WHERE user_id = ? AND lesson_id = ?')
    .bind(userId, lesson.id)
    .first<{ status: LessonDTO['status'] }>();
  const { concepts, mastery } = await lessonConcepts(env, userId, lesson);
  const sources = (
    await env.DB.prepare('SELECT url, title, page_age, retrieved_at FROM sources WHERE lesson_id = ?').bind(lesson.id).all<SourceDTO>()
  ).results;
  return {
    id: lesson.id,
    course_id: course.id,
    module_id: lesson.module_id,
    type: lesson.type,
    title: lesson.title,
    goal: lesson.goal,
    status: progress?.status ?? 'not_started',
    intro: content.intro,
    blocks: content.blocks,
    exercises: await exerciseDTOs(env, userId, lesson.id, active ?? ''),
    active_variant: active as RegenAction | null,
    available_variants: Object.keys(variants) as RegenAction[],
    info_kind: lesson.info_kind,
    verified_at: lesson.verified_at,
    verification_note:
      lesson.info_kind === 'current' && !lesson.verified_at
        ? 'Este tema cambia con el tiempo y no fue posible verificarlo con fuentes externas en este momento. Confirma cifras, leyes o precios en fuentes oficiales actuales.'
        : null,
    sources,
    concepts: concepts.map((c) => ({ id: c.id, name: c.name, state: mastery.get(c.id)?.state ?? 'not_started' })),
    disclaimer: disclaimerFor(course.sensitivity),
  };
}

// ───────────── Smart regeneration ─────────────

export async function regenerateLesson(ctx: AIContext, lessonId: string, action: RegenAction): Promise<LessonDTO> {
  const { env, userId } = ctx;
  const { lesson, course } = await requireLesson(env, userId, lessonId);
  if (lesson.status !== 'ready') throw conflict('Abre la actividad antes de pedir cambios.');
  const variants = parseJson<Record<string, unknown>>(lesson.variants_json, {});
  if (!variants[action]) {
    const { concepts, mastery } = await lessonConcepts(env, userId, lesson);
    const mod = await env.DB.prepare('SELECT title FROM modules WHERE id = ?').bind(lesson.module_id).first<{ title: string }>();
    const original = parseJson<{ intro: string }>(lesson.content_json, { intro: '' });
    const content = cleanContent(
      await activityContent(ctx, {
        course: await courseCtx(env, course, userId),
        stage_title: mod?.title ?? '',
        activity: { type: lesson.type === 'reinforcement' ? 'lesson' : lesson.type, title: lesson.title, goal: lesson.goal },
        concepts: conceptCtx(concepts, mastery),
        research: null,
        variant: action,
        original_intro: original.intro,
      }),
    );
    // Only this lesson changes; the original stays available to switch back.
    const fresh = await env.DB.prepare('SELECT variants_json FROM lessons WHERE id = ?').bind(lesson.id).first<{ variants_json: string }>();
    const merged = { ...parseJson<Record<string, unknown>>(fresh?.variants_json, {}), [action]: { intro: content.intro, blocks: content.blocks } };
    await env.DB.batch([
      env.DB.prepare('UPDATE lessons SET variants_json = ?, active_variant = ? WHERE id = ?').bind(JSON.stringify(merged), action, lesson.id),
      ...exerciseStatements(env, lesson, content, concepts, action),
    ]);
  } else {
    await env.DB.prepare('UPDATE lessons SET active_variant = ? WHERE id = ?').bind(action, lesson.id).run();
  }
  await logActivity(env, userId, 'lesson_regenerated', `${lesson.title} → ${action}`, course.id, lesson.id);
  const updated = await requireLesson(env, userId, lessonId);
  return lessonDTO(env, userId, updated.lesson, updated.course);
}

export async function switchVariant(env: Env, userId: string, lessonId: string, action: RegenAction | null): Promise<LessonDTO> {
  const { lesson, course } = await requireLesson(env, userId, lessonId);
  const variants = parseJson<Record<string, unknown>>(lesson.variants_json, {});
  if (action && !variants[action]) throw badRequest('Esa versión no existe todavía.');
  await env.DB.prepare('UPDATE lessons SET active_variant = ? WHERE id = ?').bind(action, lesson.id).run();
  const updated = await requireLesson(env, userId, lessonId);
  return lessonDTO(env, userId, updated.lesson, course);
}

// ───────────── Answers & mastery ─────────────

export async function updateMastery(
  env: Env,
  userId: string,
  courseId: string,
  conceptId: string,
  score: number,
  error: string | null,
): Promise<MasteryRecord> {
  const prev = await env.DB.prepare('SELECT * FROM concept_mastery WHERE user_id = ? AND concept_id = ?').bind(userId, conceptId).first<MasteryRow>();
  const next = applyResult(prev ?? EMPTY_MASTERY, score);
  await env.DB.prepare(
    `INSERT INTO concept_mastery (user_id, concept_id, course_id, state, score, attempts, correct, wrong_streak, last_error, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, concept_id) DO UPDATE SET state = excluded.state, score = excluded.score, attempts = excluded.attempts,
       correct = excluded.correct, wrong_streak = excluded.wrong_streak,
       last_error = COALESCE(excluded.last_error, concept_mastery.last_error), updated_at = excluded.updated_at`,
  )
    .bind(userId, conceptId, courseId, next.state, next.score, next.attempts, next.correct, next.wrong_streak, error, nowIso())
    .run();
  if (next.state === 'mastered' && prev?.state !== 'mastered') {
    await grantAchievement(env, userId, courseId, 'first_mastery', 'Primer concepto dominado');
  }
  return next;
}

export interface GradeInput {
  kind: ExerciseRow['kind'];
  prompt: string;
  context: string;
  options: string[];
  key: AnswerKey;
  rubric: string;
  explanation: string;
  conceptName: string;
}

/** Grade one response: rules for closed questions, AI for open ones. */
export async function gradeResponse(
  ctx: AIContext,
  course: CourseRow,
  g: GradeInput,
  response: string,
  conversation?: { role: 'alumno' | 'interlocutor'; text: string }[],
): Promise<{ verdict: AnswerResult['verdict']; score: number; feedback: string; correct_answer: string | null; misconception: string | null; next_turn: string | null; by: 'rule' | 'ai' }> {
  if (AUTO_GRADED.has(g.kind)) {
    const r = gradeAuto(g.kind, g.key, g.options, response);
    if (!r) throw badRequest('Selecciona una de las opciones.');
    return {
      verdict: r.verdict,
      score: r.score,
      feedback: r.verdict === 'correct' ? `¡Correcto! ${g.explanation}` : `No es correcto. ${g.explanation}`,
      correct_answer: r.correct_answer,
      misconception: r.verdict === 'correct' ? null : `Respondió "${response}" en: ${g.prompt.slice(0, 120)}`,
      next_turn: null,
      by: 'rule',
    };
  }
  if (response.trim().length < 2) throw badRequest('Escribe tu respuesta.');
  const e = await evaluateAnswer(ctx, {
    course: await courseCtx(ctx.env, course, ctx.userId),
    exercise: {
      kind: g.kind,
      prompt: g.prompt,
      context: g.context,
      reference_answer: 'reference' in g.key ? g.key.reference : '',
      rubric: g.rubric,
      concept: g.conceptName,
    },
    response,
    conversation,
  });
  const score = Math.min(1, Math.max(0, e.score));
  return {
    verdict: verdictFor(score),
    score,
    feedback: e.feedback.slice(0, 2000),
    correct_answer: null,
    misconception: e.misconception?.slice(0, 400) ?? null,
    next_turn: g.kind === 'conversation' ? e.next_turn?.slice(0, 600) ?? null : null,
    by: 'ai',
  };
}

export async function answerExercise(
  ctx: AIContext,
  exerciseId: string,
  response: string,
  conversation?: { role: 'alumno' | 'interlocutor'; text: string }[],
): Promise<AnswerResult> {
  const { env, userId } = ctx;
  const { exercise, course } = await requireExercise(env, userId, exerciseId);
  if (course.status !== 'active') throw conflict(course.status === 'paused' ? 'El curso está pausado. Reanúdalo para continuar.' : 'El curso no está activo.');
  const concept = exercise.concept_id
    ? await env.DB.prepare('SELECT name FROM concepts WHERE id = ?').bind(exercise.concept_id).first<{ name: string }>()
    : null;
  const graded = await gradeResponse(
    ctx,
    course,
    {
      kind: exercise.kind,
      prompt: exercise.prompt,
      context: exercise.context,
      options: parseJson<string[]>(exercise.options_json, []),
      key: parseJson<AnswerKey>(exercise.answer_json, { reference: '' }),
      rubric: exercise.rubric,
      explanation: exercise.explanation,
      conceptName: concept?.name ?? '',
    },
    response,
    conversation,
  );

  // For closed questions only the first attempt counts: after feedback the answer is known.
  const prior = await env.DB.prepare('SELECT COUNT(*) AS n FROM answers WHERE user_id = ? AND exercise_id = ?')
    .bind(userId, exercise.id)
    .first<{ n: number }>();
  const countsForMastery = !(AUTO_GRADED.has(exercise.kind) && (prior?.n ?? 0) > 0);

  const result: AnswerResult = {
    verdict: graded.verdict,
    score: graded.score,
    feedback: graded.feedback,
    correct_answer: graded.correct_answer,
    misconception: graded.misconception,
    next_turn: graded.next_turn,
    mastery: null,
  };
  await env.DB.prepare(
    `INSERT INTO answers (id, user_id, course_id, exercise_id, concept_id, response, score, verdict, feedback_json, graded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(newId('an_'), userId, course.id, exercise.id, exercise.concept_id, response.slice(0, 8000), graded.score, graded.verdict, JSON.stringify(result), graded.by)
    .run();

  if (exercise.concept_id && countsForMastery) {
    const m = await updateMastery(env, userId, course.id, exercise.concept_id, graded.score, graded.verdict === 'correct' ? null : graded.misconception);
    result.mastery = { concept_id: exercise.concept_id, state: m.state, score: m.score };
  }
  await touchCourse(env, course.id, exercise.lesson_id);
  await logActivity(env, userId, 'answer', `${graded.verdict}: ${exercise.prompt.slice(0, 80)}`, course.id, exercise.lesson_id);
  return result;
}

export async function completeLesson(ctx: AIContext, lessonId: string): Promise<NextStep> {
  const { env, userId } = ctx;
  const { lesson, course } = await requireLesson(env, userId, lessonId);
  const variant = lesson.active_variant ?? '';
  const unanswered = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM exercises e WHERE e.lesson_id = ? AND e.variant = ?
       AND NOT EXISTS (SELECT 1 FROM answers a WHERE a.exercise_id = e.id AND a.user_id = ?)`,
  )
    .bind(lesson.id, variant, userId)
    .first<{ n: number }>();
  if ((unanswered?.n ?? 0) > 0) {
    throw new HttpError(409, 'exercises_pending', 'Responde todos los ejercicios antes de terminar la actividad.');
  }
  await env.DB.prepare(
    `INSERT INTO lesson_progress (user_id, lesson_id, course_id, status, started_at, completed_at) VALUES (?, ?, ?, 'completed', ?, ?)
     ON CONFLICT(user_id, lesson_id) DO UPDATE SET status = 'completed', completed_at = excluded.completed_at`,
  )
    .bind(userId, lesson.id, course.id, nowIso(), nowIso())
    .run();
  await logActivity(env, userId, 'lesson_completed', lesson.title, course.id, lesson.id);
  return nextStep(ctx, course.id);
}

// ───────────── Next-step policy ─────────────

async function ensureReinforcement(ctx: AIContext, course: CourseRow, mod: ModuleRow, concept: ConceptRow): Promise<string> {
  const { env } = ctx;
  const existing = await env.DB.prepare(
    `SELECT l.id FROM lessons l LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = ?
     WHERE l.course_id = ? AND l.type = 'reinforcement' AND l.concept_ids_json = ? AND COALESCE(lp.status, 'not_started') != 'completed'`,
  )
    .bind(ctx.userId, course.id, JSON.stringify([concept.id]))
    .first<{ id: string }>();
  if (existing) return existing.id;
  const count = await env.DB.prepare(`SELECT COUNT(*) AS n FROM lessons WHERE module_id = ? AND type = 'reinforcement'`).bind(mod.id).first<{ n: number }>();
  const id = newId('l_');
  // Content is generated when opened, using the learner's actual errors.
  await env.DB.prepare(
    `INSERT INTO lessons (id, course_id, module_id, position, type, title, goal, concept_ids_json)
     VALUES (?, ?, ?, ?, 'reinforcement', ?, ?, ?)`,
  )
    .bind(
      id,
      course.id,
      mod.id,
      mod.position * 100 + 50 + (count?.n ?? 0),
      `Refuerzo: ${concept.name}`,
      `Entender ${concept.name} desde otro ángulo y practicarlo.`,
      JSON.stringify([concept.id]),
    )
    .run();
  await logActivity(env, ctx.userId, 'reinforcement_created', concept.name, course.id, id);
  return id;
}

export async function nextStep(ctx: AIContext, courseId: string): Promise<NextStep> {
  const { env, userId } = ctx;
  const course = await requireCourse(env, userId, courseId);
  if (course.status === 'diagnosing' || course.status === 'planning') throw conflict('Acepta el plan para empezar.');
  if (course.status === 'paused') throw conflict('El curso está pausado. Reanúdalo para continuar.');

  for (let guard = 0; guard < 20; guard++) {
    const modules = await listModules(env, courseId);
    const mod = modules.find((m) => m.status !== 'completed');
    if (!mod) {
      const project = await projectState(ctx, course);
      if (project === 'pending') return { kind: 'project', reason: 'Completaste todas las etapas. Demuestra lo aprendido con el proyecto final.' };
      const cert = await env.DB.prepare('SELECT code FROM certificates WHERE user_id = ? AND course_id = ?').bind(userId, courseId).first();
      if (course.status !== 'completed') {
        await env.DB.prepare(`UPDATE courses SET status = 'completed', completed_at = ? WHERE id = ?`).bind(nowIso(), courseId).run();
        await grantAchievement(env, userId, courseId, 'course_completed', `Curso completado: ${course.title}`);
        await logActivity(env, userId, 'course_completed', course.title, courseId);
      }
      return cert
        ? { kind: 'done', reason: '¡Curso completado! Ya tienes tu certificado.' }
        : { kind: 'certificate', reason: '¡Curso completado! Genera tu certificado de finalización.' };
    }
    if (mod.status === 'locked') {
      await env.DB.prepare(`UPDATE modules SET status = 'available' WHERE id = ?`).bind(mod.id).run();
    }
    await ensureStageOutline(ctx, courseId, mod.id);
    await env.DB.prepare('UPDATE courses SET current_module_id = ? WHERE id = ?').bind(mod.id, courseId).run();

    const concepts = (await listConcepts(env, courseId)).filter((c) => c.module_id === mod.id);
    const mastery = await masteryMap(env, userId, courseId);

    // 1. Weakness detected → targeted reinforcement before anything else.
    const weak = concepts.find((c) => mastery.get(c.id)?.state === 'needs_reinforcement');
    if (weak) {
      const id = await ensureReinforcement(ctx, course, mod, weak);
      const lesson = await env.DB.prepare('SELECT title FROM lessons WHERE id = ?').bind(id).first<{ title: string }>();
      return { kind: 'lesson', lesson_id: id, title: lesson!.title, reason: `Detectamos dificultades con «${weak.name}». Preparamos un refuerzo con otro enfoque.` };
    }

    const records = concepts.map((c) => (mastery.get(c.id) as MasteryRecord | undefined) ?? EMPTY_MASTERY);
    const allMastered = records.length > 0 && records.every((r) => r.state === 'mastered');

    // 2. Next pending activity — unless everything is already mastered (fast learners skip ahead).
    if (!allMastered) {
      const pending = await env.DB.prepare(
        `SELECT l.id, l.title FROM lessons l LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = ?
         WHERE l.module_id = ? AND COALESCE(lp.status, 'not_started') != 'completed'
         ORDER BY CASE WHEN l.type = 'reinforcement' THEN 0 ELSE 1 END, l.position LIMIT 1`,
      )
        .bind(userId, mod.id)
        .first<{ id: string; title: string }>();
      if (pending) return { kind: 'lesson', lesson_id: pending.id, title: pending.title, reason: `Siguiente paso en «${mod.title}».` };
    }

    // 3. Stage checkpoint.
    const quiz = await ensureStageQuiz(ctx, course, mod, concepts);
    const result = await lastQuizResult(env, userId, quiz.id);
    if (!result) {
      return {
        kind: 'quiz',
        quiz_id: quiz.id,
        title: quiz.title,
        reason: allMastered ? `Dominas los conceptos de «${mod.title}». Compruébalo con la evaluación y avanza.` : `Terminaste «${mod.title}». Comprueba lo aprendido.`,
      };
    }
    const fresh = await masteryMap(env, userId, courseId);
    const ready = stageReady(concepts.map((c) => (fresh.get(c.id) as MasteryRecord | undefined) ?? EMPTY_MASTERY));
    if (!result.passed && !ready) {
      const stillWeak = concepts.find((c) => fresh.get(c.id)?.state === 'needs_reinforcement');
      if (stillWeak) continue; // loop back: step 1 will create reinforcement
      // Failed without a single clearly weak concept: reinforce the lowest-scoring one,
      // after which the stage evaluation is retaken with fresh questions.
      const lowest = [...concepts].sort((a, b) => (fresh.get(a.id)?.score ?? 0) - (fresh.get(b.id)?.score ?? 0))[0];
      const id = await ensureReinforcement(ctx, course, mod, lowest);
      const lesson = await env.DB.prepare('SELECT title FROM lessons WHERE id = ?').bind(id).first<{ title: string }>();
      return { kind: 'lesson', lesson_id: id, title: lesson!.title, reason: `La evaluación mostró que «${lowest.name}» necesita otra vuelta antes de reintentarla.` };
    }
    // 4. Stage complete → unlock the next one (generated adaptively when reached).
    await env.DB.prepare(`UPDATE modules SET status = 'completed' WHERE id = ?`).bind(mod.id).run();
    await grantAchievement(env, userId, courseId, `stage:${mod.id}`, `Etapa superada: ${mod.title}`);
    await logActivity(env, userId, 'stage_completed', mod.title, courseId);
  }
  throw new HttpError(500, 'internal', 'No se pudo determinar la siguiente actividad.');
}

export async function nextStepSafe(ctx: AIContext, courseId: string): Promise<NextStep | null> {
  try {
    return await nextStep(ctx, courseId);
  } catch (err) {
    if (err instanceof HttpError && err.status === 409) return null;
    throw err;
  }
}
