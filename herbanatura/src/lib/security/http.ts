import 'server-only';
import type { ZodType } from 'zod';
import { log } from '@/lib/logger';

export function badRequest(message: string, details?: unknown) {
  return Response.json({ error: 'bad_request', message, details }, { status: 400 });
}

/** Parse URLSearchParams or a JSON body with a zod schema. */
export function parse<T>(schema: ZodType<T>, input: unknown): { ok: true; data: T } | { ok: false; res: Response } {
  const r = schema.safeParse(input);
  if (r.success) return { ok: true, data: r.data };
  return { ok: false, res: badRequest('Entrada no válida', r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))) };
}

export function serverError(route: string, err: unknown) {
  log.error('route_error', { route, error: err instanceof Error ? err.message : String(err) });
  return Response.json({ error: 'server_error', message: 'Error interno. Intenta de nuevo más tarde.' }, { status: 500 });
}

/** External source (PubMed, ClinicalTrials.gov…) failed: not our error, report 502. */
export function upstreamError(route: string, err: unknown) {
  log.warn('upstream_error', { route, error: err instanceof Error ? err.message : String(err) });
  return Response.json({ error: 'upstream_unavailable', message: 'La fuente externa no está disponible en este momento.' }, { status: 502 });
}
