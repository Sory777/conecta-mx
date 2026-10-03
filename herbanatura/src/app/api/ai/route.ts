import { z } from 'zod';
import { askHerba } from '@/lib/ai/herba';
import { getRepository } from '@/lib/data';
import { LOCALES } from '@/lib/domain/types';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { log } from '@/lib/logger';
import { rateLimit } from '@/lib/security/rate-limit';
import { parse, serverError } from '@/lib/security/http';

const Body = z.object({ question: z.string().trim().min(2).max(1000), locale: z.enum(LOCALES).default('es') });

export async function POST(req: Request) {
  const limited = await rateLimit(req, 'ai');
  if (limited) return limited;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ error: 'bad_request' }, { status: 400 });
  }
  const p = parse(Body, json);
  if (!p.ok) return p.res;
  try {
    const answer = await askHerba(getRepository(), p.data.question, p.data.locale, getDictionary(p.data.locale));
    // Privacy: log only metadata, never the question text.
    log.info('herba_ai', { mode: answer.mode, confidence: answer.confidence, docs: answer.documents.length, emergency: answer.mode === 'emergency', removed: answer.removedReferences ?? 0 });
    return Response.json(answer, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return serverError('ai', e);
  }
}
