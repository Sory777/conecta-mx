import { z } from 'zod';
import { getRepository } from '@/lib/data';
import { rateLimit } from '@/lib/security/rate-limit';
import { parse, serverError } from '@/lib/security/http';

const slug = z.string().regex(/^[a-z0-9][a-z0-9-]{0,119}$/);
const Q = z.object({ medication: slug.optional(), agent: slug.optional() });

/** Medication → agents, or agent → medications. Missing records are reported, never invented. */
export async function GET(req: Request) {
  const limited = await rateLimit(req, 'search');
  if (limited) return limited;
  const p = parse(Q, Object.fromEntries(new URL(req.url).searchParams));
  if (!p.ok) return p.res;
  try {
    const repo = getRepository();
    const [med, agent] = await Promise.all([p.data.medication ? repo.getEntity(p.data.medication) : null, p.data.agent ? repo.getEntity(p.data.agent) : null]);
    const items = await repo.listInteractions({ medicationId: med?.id, agentIds: agent ? [agent.id] : undefined });
    return Response.json({
      items,
      note: items.length ? null : 'Información insuficiente: no hay interacción registrada. Esto no garantiza que la combinación sea segura.',
    });
  } catch (e) {
    return serverError('interactions', e);
  }
}
