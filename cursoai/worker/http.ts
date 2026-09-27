import { z } from 'zod';

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (msg: string, details?: unknown) => new HttpError(400, 'bad_request', msg, details);
export const unauthorized = () => new HttpError(401, 'unauthorized', 'Inicia sesión para continuar.');
export const notFound = (what = 'Recurso') => new HttpError(404, 'not_found', `${what} no encontrado.`);
export const conflict = (msg: string) => new HttpError(409, 'conflict', msg);

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Cache-Control': 'no-store',
};

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers.set(k, v);
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function errorResponse(err: unknown): Response {
  if (err instanceof HttpError) {
    return json({ error: { code: err.code, message: err.message, details: err.details } }, { status: err.status });
  }
  console.error('Unhandled error', err);
  return json(
    { error: { code: 'internal', message: 'Ocurrió un error inesperado. Inténtalo de nuevo.' } },
    { status: 500 },
  );
}

const MAX_BODY_BYTES = 64 * 1024;

export async function readJson<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S>> {
  const len = Number(req.headers.get('Content-Length') ?? '0');
  if (len > MAX_BODY_BYTES) throw new HttpError(413, 'too_large', 'La solicitud es demasiado grande.');
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) throw new HttpError(413, 'too_large', 'La solicitud es demasiado grande.');
  let raw: unknown;
  try {
    raw = text ? JSON.parse(text) : {};
  } catch {
    throw badRequest('JSON inválido.');
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw badRequest('Datos inválidos.', parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
  }
  return parsed.data;
}

/**
 * CSRF defence for cookie-authenticated mutations: require a JSON body type
 * (forces a CORS preflight for cross-site requests) and a same-origin Origin.
 */
export function assertSameOrigin(req: Request): void {
  if (req.method === 'GET' || req.method === 'HEAD') return;
  const url = new URL(req.url);
  const origin = req.headers.get('Origin');
  if (origin && origin !== url.origin) throw new HttpError(403, 'forbidden', 'Origen no permitido.');
  const ct = req.headers.get('Content-Type') ?? '';
  if (req.method !== 'DELETE' && !ct.includes('application/json')) {
    throw new HttpError(415, 'unsupported_media_type', 'Se requiere Content-Type: application/json.');
  }
}

type Handler<C> = (ctx: C, params: Record<string, string>) => Promise<Response>;

export class Router<C> {
  private routes: { method: string; pattern: RegExp; keys: string[]; handler: Handler<C> }[] = [];

  on(method: string, path: string, handler: Handler<C>): this {
    const keys: string[] = [];
    const pattern = new RegExp(
      '^' +
        path.replace(/\/:([a-zA-Z_]+)/g, (_, key: string) => {
          keys.push(key);
          return '/([^/]+)';
        }) +
        '$',
    );
    this.routes.push({ method, pattern, keys, handler });
    return this;
  }

  match(method: string, pathname: string): { handler: Handler<C>; params: Record<string, string> } | 'method_not_allowed' | null {
    let pathMatched = false;
    for (const r of this.routes) {
      const m = r.pattern.exec(pathname);
      if (!m) continue;
      pathMatched = true;
      if (r.method !== method) continue;
      const params: Record<string, string> = {};
      r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
      return { handler: r.handler, params };
    }
    return pathMatched ? 'method_not_allowed' : null;
  }
}
