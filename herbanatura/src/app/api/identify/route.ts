import { getRepository } from '@/lib/data';
import { LOCALES, type Locale } from '@/lib/domain/types';
import { hasFeature } from '@/lib/auth/session';
import { identify, MAX_IMAGE_BYTES, sniffImage } from '@/lib/identify';
import { rateLimit } from '@/lib/security/rate-limit';
import { badRequest, serverError } from '@/lib/security/http';

/** Preliminary identification. Images are processed in memory and never stored. */
export async function POST(req: Request) {
  const limited = await rateLimit(req, 'identify');
  if (limited) return limited;
  if (!(await hasFeature('image_identification'))) return Response.json({ error: 'premium_required' }, { status: 402 });
  const len = Number(req.headers.get('content-length') ?? 0);
  if (len > MAX_IMAGE_BYTES + 64 * 1024) return badRequest('La imagen supera 5 MB.');
  try {
    const form = await req.formData();
    const file = form.get('image');
    const loc = String(form.get('locale') ?? 'es');
    const locale: Locale = (LOCALES as readonly string[]).includes(loc) ? (loc as Locale) : 'es';
    if (!(file instanceof File)) return badRequest('Falta la imagen.');
    if (file.size > MAX_IMAGE_BYTES) return badRequest('La imagen supera 5 MB.');
    const bytes = Buffer.from(await file.arrayBuffer());
    const type = sniffImage(bytes);
    if (!type) return badRequest('Formato no permitido (JPEG, PNG o WebP).');
    const result = await identify(getRepository(), bytes, type, locale);
    if (!result) return Response.json({ error: 'unavailable', message: 'La identificación por imagen no está configurada o no pudo completarse.' }, { status: 503 });
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return serverError('identify', e);
  }
}
