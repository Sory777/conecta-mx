import type { FastifyReply, FastifyRequest } from 'fastify';
import type { z } from 'zod';
import { AppError, badRequest, forbidden, unauthorized } from '../lib/errors';
import type { AuthUser, Role } from '../modules/auth/service';

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthUser | null;
  }
}

export function parse<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data);
  if (!r.success) {
    throw badRequest(
      'validation',
      'Datos inválidos: ' + r.error.issues.map((i) => `${i.path.join('.') || 'body'} ${i.message}`).join('; '),
    );
  }
  return r.data;
}

export function requireUser(req: FastifyRequest): AuthUser {
  if (!req.user) throw unauthorized();
  return req.user;
}

const RANK: Record<Role, number> = { player: 0, moderator: 1, admin: 2 };

export function requireRole(req: FastifyRequest, role: Role): AuthUser {
  const u = requireUser(req);
  if (RANK[u.role] < RANK[role]) throw forbidden('Permisos insuficientes.');
  return u;
}

export function sendError(reply: FastifyReply, err: unknown) {
  if (err instanceof AppError) {
    return reply.status(err.status).send({ error: { code: err.code, message: err.message, details: err.details } });
  }
  const e = err as { statusCode?: number; code?: string; message?: string };
  if (e?.statusCode && e.statusCode < 500) {
    return reply.status(e.statusCode).send({ error: { code: e.code ?? 'bad_request', message: e.message ?? 'Solicitud inválida' } });
  }
  return reply.status(500).send({ error: { code: 'internal', message: 'Error interno del servidor.' } });
}
