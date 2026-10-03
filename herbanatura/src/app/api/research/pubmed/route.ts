import { z } from 'zod';
import { buildQuery, PUBMED_TYPES, pubmedSearch, type PubmedType } from '@/lib/research/pubmed';
import { rateLimit } from '@/lib/security/rate-limit';
import { parse, upstreamError } from '@/lib/security/http';

const year = z.coerce.number().int().min(1800).max(2100).optional();
const Q = z.object({
  q: z.string().trim().min(2).max(300),
  types: z.string().optional(),
  from: year,
  to: year,
  sort: z.enum(['relevance', 'pub_date']).optional(),
});

/** External, unreviewed records: the UI labels them as such. */
export async function GET(req: Request) {
  const limited = await rateLimit(req, 'research');
  if (limited) return limited;
  const p = parse(Q, Object.fromEntries(new URL(req.url).searchParams));
  if (!p.ok) return p.res;
  const types = (p.data.types?.split(',') ?? []).filter((t): t is PubmedType => t in PUBMED_TYPES);
  try {
    const query = buildQuery(p.data.q, { types });
    const r = await pubmedSearch(query, { from: p.data.from, to: p.data.to, sort: p.data.sort });
    return Response.json({ query, ...r, source: 'PubMed (NLM)', reviewed: false });
  } catch (e) {
    return upstreamError('pubmed', e);
  }
}
