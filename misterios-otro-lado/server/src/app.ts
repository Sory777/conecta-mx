import { existsSync } from 'node:fs';
import path from 'node:path';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import type { AppConfig } from './config/env';
import { tooMany } from './lib/errors';
import { RateLimiter } from './lib/rateLimit';
import { registerAdminRoutes } from './http/adminRoutes';
import { sendError } from './http/helpers';
import { registerPlayerRoutes } from './http/playerRoutes';
import { Gateway } from './modules/multiplayer/gateway';
import { createServices, type Services } from './services';

export interface GameServer {
  app: FastifyInstance;
  services: Services;
  gateway: Gateway;
  start(): Promise<string>;
  stop(): Promise<void>;
}

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "connect-src 'self' ws: wss:",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join('; ');

export async function buildServer(config: AppConfig): Promise<GameServer> {
  const services = createServices(config);
  const app = Fastify({
    logger: false,
    trustProxy: config.TRUST_PROXY,
    bodyLimit: 64 * 1024,
  });

  let gateway: Gateway | null = null;

  // ---------------- limitación de tasa (por IP y más estricta en autenticación)
  const globalLimiter = new RateLimiter(120, 25);
  const authLimiter = new RateLimiter(config.AUTH_RATE_PER_10MIN, config.AUTH_RATE_PER_10MIN / 600);
  const economyLimiter = new RateLimiter(20, 2);
  app.addHook('onRequest', async (req) => {
    if (!req.url.startsWith('/api/')) return;
    if (!globalLimiter.take(req.ip)) throw tooMany();
    const cfg = req.routeOptions.config as { authRate?: boolean } | undefined;
    if (cfg?.authRate && !authLimiter.take(req.ip)) throw tooMany('Demasiados intentos. Espera unos minutos.');
    const auth = req.headers.authorization;
    req.user = auth?.startsWith('Bearer ') ? services.auth.authenticate(auth.slice(7)) : null;
    if (req.method !== 'GET' && req.user && /^\/api\/(store|ads|rewards|season|marketplace)\//.test(req.url)) {
      // Endpoints económicos: límite por cuenta además del de IP
      if (!economyLimiter.take(req.user.id)) throw tooMany();
    }
  });

  // ---------------- cabeceras de seguridad
  app.addHook('onSend', async (req, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    reply.header('Cross-Origin-Opener-Policy', 'same-origin');
    if (req.url.startsWith('/api/')) reply.header('Cache-Control', 'no-store');
    else reply.header('Content-Security-Policy', CSP);
    return payload;
  });

  app.setErrorHandler((err, req, reply) => {
    const status = (err as { status?: number; statusCode?: number }).status ?? (err as { statusCode?: number }).statusCode ?? 500;
    if (status >= 500) services.log.error('request failed', { url: req.url, err: String(err), stack: (err as Error).stack });
    return sendError(reply, err);
  });

  registerPlayerRoutes(app, services, () => gateway);
  registerAdminRoutes(app, services, () => gateway);

  // ---------------- cliente compilado (producción)
  if (existsSync(path.join(config.CLIENT_DIST, 'index.html'))) {
    await app.register(fastifyStatic, { root: config.CLIENT_DIST, index: ['index.html'], maxAge: '1h' });
    app.get('/admin', (_req, reply) => reply.sendFile('admin.html'));
  }
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/')) return reply.status(404).send({ error: { code: 'not_found', message: 'Ruta no encontrada' } });
    if (existsSync(path.join(config.CLIENT_DIST, 'index.html'))) return reply.sendFile('index.html');
    return reply.status(404).send('Cliente no compilado. Ejecuta `npm run build` o usa `npm run dev`.');
  });

  await app.ready();
  gateway = new Gateway({
    db: services.db,
    bus: services.bus,
    log: services.log,
    auth: services.auth,
    accounts: services.accounts,
    missions: services.missions,
    social: services.social,
    economy: services.economy,
    antifraud: services.antifraud,
    analytics: services.analytics,
    referrals: services.referrals,
    seasons: services.seasons,
  });
  gateway.attach(app.server);
  const gw = gateway;

  return {
    app,
    services,
    gateway: gw,
    async start() {
      const addr = await app.listen({ host: config.HOST, port: config.PORT });
      return addr;
    },
    async stop() {
      gw.stop();
      await app.close();
      services.db.close();
    },
  };
}
