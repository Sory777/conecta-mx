import { z } from 'zod';
import { searchTrials } from '@/lib/research/clinicaltrials';
import { rateLimit } from '@/lib/security/rate-limit';
import { parse, upstreamError } from '@/lib/security/http';

const text = z.string().trim().max(200).optional();
const Q = z.object({
  condition: text,
  intervention: text,
  term: text,
  country: text,
  status: z.enum(['RECRUITING', 'NOT_YET_RECRUITING', 'ACTIVE_NOT_RECRUITING', 'COMPLETED', 'TERMINATED', 'WITHDRAWN']).optional(),
});

export async function GET(req: Request) {
  const limited = await rateLimit(req, 'research');
  if (limited) return limited;
  const p = parse(Q, Object.fromEntries(new URL(req.url).searchParams));
  if (!p.ok) return p.res;
  if (!p.data.condition && !p.data.intervention && !p.data.term) return Response.json({ error: 'bad_request', message: 'Indica condición, intervención o término.' }, { status: 400 });
  try {
    return Response.json({ ...(await searchTrials(p.data)), source: 'ClinicalTrials.gov', reviewed: false });
  } catch (e) {
    return upstreamError('trials', e);
  }
}
