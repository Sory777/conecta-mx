import { z } from 'zod';
import { buildQuery, pubmedCount } from '@/lib/research/pubmed';
import { rateLimit } from '@/lib/security/rate-limit';
import { parse, upstreamError } from '@/lib/security/http';

const Q = z.object({ term: z.string().trim().min(2).max(200) });

function buckets(now = new Date().getFullYear()): [number, number][] {
  return [[1950, 1999], [2000, 2009], [2010, 2014], [2015, 2019], [2020, 2022], [2023, now]];
}

const memo = new Map<string, { at: number; data: unknown }>();

/** Publication counts per period (research activity, not evidence quality). */
export async function GET(req: Request) {
  const limited = await rateLimit(req, 'research');
  if (limited) return limited;
  const p = parse(Q, Object.fromEntries(new URL(req.url).searchParams));
  if (!p.ok) return p.res;
  const key = p.data.term.toLowerCase();
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < 1000 * 60 * 60 * 24) return Response.json(hit.data);
  try {
    const base = `"${p.data.term.replace(/"/g, '')}"[tiab]`;
    const trials = buildQuery(base, { types: ['clinical_trial'] });
    const reviews = buildQuery(base, { types: ['systematic_review', 'meta_analysis'] });
    const out = { buckets: [] as object[], trials: [] as object[], reviews: [] as object[], source: 'PubMed (NLM)' };
    for (const [from, to] of buckets()) {
      out.buckets.push({ from, to, count: await pubmedCount(base, from, to) });
      out.trials.push({ from, to, count: await pubmedCount(trials, from, to) });
      out.reviews.push({ from, to, count: await pubmedCount(reviews, from, to) });
    }
    memo.set(key, { at: Date.now(), data: out });
    return Response.json(out, { headers: { 'Cache-Control': 'public, s-maxage=86400' } });
  } catch (e) {
    return upstreamError('timeline', e);
  }
}
