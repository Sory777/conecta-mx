// Personal tutor: answers with full course context and a bounded memory
// (last messages verbatim + a rolling summary of older ones).

import type { Env } from '../env';
import { conflict } from '../http';
import { listConcepts, logActivity, masteryMap, requireCourse, touchCourse } from '../db';
import { newId, parseJson } from '../util';
import type { AIContext } from '../ai/runner';
import { summarizeConversation, tutorReply } from '../ai/tasks';
import { courseCtx } from './learning';
import type { TutorMessage } from '../../shared/types';

const WINDOW = 10;

/** Messages before this index are already folded into the conversation summary. */
export const summarizedUpTo = (count: number) => (count >= 2 * WINDOW ? Math.floor(count / WINDOW) * WINDOW - WINDOW : 0);

async function conversationFor(env: Env, userId: string, courseId: string) {
  let conv = await env.DB.prepare('SELECT id, summary FROM ai_conversations WHERE user_id = ? AND course_id = ?')
    .bind(userId, courseId)
    .first<{ id: string; summary: string }>();
  if (!conv) {
    const id = newId('cv_');
    await env.DB.prepare('INSERT OR IGNORE INTO ai_conversations (id, user_id, course_id) VALUES (?, ?, ?)').bind(id, userId, courseId).run();
    conv = (await env.DB.prepare('SELECT id, summary FROM ai_conversations WHERE user_id = ? AND course_id = ?')
      .bind(userId, courseId)
      .first<{ id: string; summary: string }>())!;
  }
  return conv;
}

export async function tutorHistory(env: Env, userId: string, courseId: string): Promise<TutorMessage[]> {
  await requireCourse(env, userId, courseId);
  const conv = await conversationFor(env, userId, courseId);
  return (
    await env.DB.prepare('SELECT id, role, content, created_at FROM ai_messages WHERE conversation_id = ? ORDER BY created_at, rowid')
      .bind(conv.id)
      .all<TutorMessage>()
  ).results;
}

async function situation(env: Env, userId: string, courseId: string, lessonId: string | null): Promise<string> {
  const lines: string[] = [];
  if (lessonId) {
    const lesson = await env.DB.prepare('SELECT title, type, content_json, active_variant, variants_json FROM lessons WHERE id = ? AND course_id = ?')
      .bind(lessonId, courseId)
      .first<{ title: string; type: string; content_json: string | null; active_variant: string | null; variants_json: string }>();
    if (lesson) {
      lines.push(`Actividad actual: «${lesson.title}» (${lesson.type}).`);
      const variants = parseJson<Record<string, { blocks: { title: string; body: string }[] }>>(lesson.variants_json, {});
      const content = lesson.active_variant && variants[lesson.active_variant]
        ? variants[lesson.active_variant]
        : parseJson<{ blocks: { title: string; body: string }[] }>(lesson.content_json, { blocks: [] });
      const text = content.blocks.map((b) => `${b.title}: ${b.body}`).join('\n').slice(0, 2500);
      if (text) lines.push(`Contenido que está viendo:\n${text}`);
    }
  }
  const concepts = await listConcepts(env, courseId);
  const mastery = await masteryMap(env, userId, courseId);
  const by = (s: string) => concepts.filter((c) => mastery.get(c.id)?.state === s).map((c) => c.name);
  const mastered = by('mastered');
  const weak = by('needs_reinforcement');
  const learning = by('learning');
  if (mastered.length) lines.push(`Conceptos dominados: ${mastered.join(', ')}.`);
  if (learning.length) lines.push(`En aprendizaje: ${learning.join(', ')}.`);
  if (weak.length) lines.push(`Necesitan refuerzo: ${weak.join(', ')}.`);
  const errors = (
    await env.DB.prepare(
      `SELECT a.response, a.feedback_json, COALESCE(e.prompt, q.prompt) AS prompt FROM answers a
       LEFT JOIN exercises e ON e.id = a.exercise_id LEFT JOIN questions q ON q.id = a.question_id
       WHERE a.user_id = ? AND a.course_id = ? AND a.verdict != 'correct' ORDER BY a.created_at DESC LIMIT 3`,
    )
      .bind(userId, courseId)
      .all<{ response: string; feedback_json: string; prompt: string | null }>()
  ).results;
  if (errors.length) {
    lines.push('Últimos errores del alumno (el más reciente primero):');
    for (const e of errors) {
      const fb = parseJson<{ feedback?: string; misconception?: string | null }>(e.feedback_json, {});
      lines.push(`- Pregunta: ${(e.prompt ?? '').slice(0, 200)} | Respondió: ${e.response.slice(0, 200)} | Problema: ${fb.misconception ?? fb.feedback ?? ''}`);
    }
  }
  return lines.join('\n') || 'Acaba de empezar el curso.';
}

export async function askTutor(ctx: AIContext, courseId: string, message: string, lessonId: string | null): Promise<TutorMessage[]> {
  const { env, userId } = ctx;
  const course = await requireCourse(env, userId, courseId);
  if (course.status === 'diagnosing') throw conflict('Primero genera el plan del curso.');
  const conv = await conversationFor(env, userId, courseId);
  const all = (
    await env.DB.prepare('SELECT role, content FROM ai_messages WHERE conversation_id = ? ORDER BY created_at, rowid')
      .bind(conv.id)
      .all<{ role: 'user' | 'assistant'; content: string }>()
  ).results;

  const reply = await tutorReply(ctx, {
    course: await courseCtx(env, course, userId),
    situation: await situation(env, userId, courseId, lessonId),
    memory: conv.summary,
    history: all.slice(summarizedUpTo(all.length)),
    message,
  });

  const now = Date.now();
  const insert = 'INSERT INTO ai_messages (id, conversation_id, role, content, lesson_id, created_at) VALUES (?, ?, ?, ?, ?, ?)';
  await env.DB.batch([
    env.DB.prepare(insert).bind(newId('mg_'), conv.id, 'user', message, lessonId, new Date(now).toISOString()),
    env.DB.prepare(insert).bind(newId('mg_'), conv.id, 'assistant', reply, lessonId, new Date(now + 1).toISOString()),
  ]);

  // Recent messages are sent verbatim (between WINDOW and 2*WINDOW of them); each time
  // WINDOW more accumulate, the oldest unsummarized WINDOW are folded into the summary.
  const combined = [...all, { role: 'user' as const, content: message }, { role: 'assistant' as const, content: reply }];
  const total = combined.length;
  if (total >= 2 * WINDOW && total % WINDOW === 0) {
    const leaving = combined.slice(total - 2 * WINDOW, total - WINDOW);
    const summary = await summarizeConversation(ctx, { previous: conv.summary, messages: leaving });
    await env.DB.prepare('UPDATE ai_conversations SET summary = ? WHERE id = ?').bind(summary.slice(0, 2000), conv.id).run();
  }
  await touchCourse(env, courseId);
  await logActivity(env, userId, 'tutor', message.slice(0, 120), courseId, lessonId);
  return tutorHistory(env, userId, courseId);
}
