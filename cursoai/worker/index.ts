import type { Env } from './env';
import { assertSameOrigin, errorResponse, json } from './http';
import { router } from './routes';

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

function withPageHeaders(res: Response): Response {
  const out = new Response(res.body, res);
  out.headers.set('Content-Security-Policy', CSP);
  out.headers.set('X-Frame-Options', 'DENY');
  out.headers.set('X-Content-Type-Options', 'nosniff');
  out.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  return out;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) {
      return withPageHeaders(await env.ASSETS.fetch(req));
    }
    try {
      assertSameOrigin(req);
      const match = router.match(req.method, url.pathname);
      if (match === null) return json({ error: { code: 'not_found', message: 'Ruta no encontrada.' } }, { status: 404 });
      if (match === 'method_not_allowed') return json({ error: { code: 'method_not_allowed', message: 'Método no permitido.' } }, { status: 405 });
      return await match.handler({ env, req }, match.params);
    } catch (err) {
      return errorResponse(err);
    }
  },
} satisfies ExportedHandler<Env>;
