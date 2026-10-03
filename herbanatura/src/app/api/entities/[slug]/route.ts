import { getRepository } from '@/lib/data';
import { rateLimit } from '@/lib/security/rate-limit';
import { badRequest, serverError } from '@/lib/security/http';

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const limited = await rateLimit(req, 'search');
  if (limited) return limited;
  const { slug } = await params;
  if (!/^[a-z0-9][a-z0-9-]{0,119}$/.test(slug)) return badRequest('slug no válido');
  try {
    const d = await getRepository().getEntityDetail(slug);
    if (!d) return Response.json({ error: 'not_found' }, { status: 404 });
    return Response.json(d, { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } });
  } catch (e) {
    return serverError('entity', e);
  }
}
