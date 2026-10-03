import { z } from 'zod';
import { getRepository } from '@/lib/data';
import { rateLimit } from '@/lib/security/rate-limit';
import { parse, serverError } from '@/lib/security/http';

const Q = z.object({ entity: z.string().regex(/^[a-z0-9][a-z0-9-]{0,119}$/) });

/** Knowledge-graph neighbourhood of one entity as nodes + typed edges. */
export async function GET(req: Request) {
  const limited = await rateLimit(req, 'search');
  if (limited) return limited;
  const p = parse(Q, Object.fromEntries(new URL(req.url).searchParams));
  if (!p.ok) return p.res;
  try {
    const d = await getRepository().getEntityDetail(p.data.entity);
    if (!d) return Response.json({ error: 'not_found' }, { status: 404 });
    const nodes = new Map<string, { id: string; type: string; slug: string; name: unknown }>();
    const add = (r: { id: string; type: string; slug: string; name: unknown }) => nodes.set(r.id, { id: r.id, type: r.type, slug: r.slug, name: r.name });
    add(d.entity);
    const edges = [
      ...d.relations.map((r) => (add(r.subject), add(r.object), { from: r.subjectId, to: r.objectId, kind: r.predicate, reviewStatus: r.reviewStatus })),
      ...d.claims.filter((c) => c.condition).map((c) => (add(c.subject), add(c.condition!), { from: c.subjectId, to: c.conditionId!, kind: `evidence:${c.context}`, level: c.level, sources: c.sources.map((s) => s.url), reviewStatus: c.reviewStatus })),
      ...d.interactions.map((i) => (add(i.agent), add(i.medication), { from: i.agentId, to: i.medicationId, kind: `interaction:${i.kind}`, level: i.level, sources: i.sources.map((s) => s.url), reviewStatus: i.reviewStatus })),
    ];
    return Response.json({ nodes: [...nodes.values()], edges });
  } catch (e) {
    return serverError('graph', e);
  }
}
