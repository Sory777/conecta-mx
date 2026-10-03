import { z } from 'zod';
import { getRepository } from '@/lib/data';
import { ENTITY_TYPES } from '@/lib/domain/types';
import { search } from '@/lib/search/engine';
import { rateLimit } from '@/lib/security/rate-limit';
import { parse, serverError } from '@/lib/security/http';

const Q = z.object({ q: z.string().trim().min(1).max(500), types: z.string().optional() });

export async function GET(req: Request) {
  const limited = await rateLimit(req, 'search');
  if (limited) return limited;
  const p = parse(Q, Object.fromEntries(new URL(req.url).searchParams));
  if (!p.ok) return p.res;
  try {
    const repo = getRepository();
    const r = await search(repo, p.data.q);
    const types = p.data.types?.split(',').filter((t) => (ENTITY_TYPES as readonly string[]).includes(t));
    if (types?.length) r.results = r.results.filter((x) => types.includes(x.type));
    return Response.json(r, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' } });
  } catch (e) {
    return serverError('search', e);
  }
}
