export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (code: string, msg: string, details?: unknown) => new AppError(400, code, msg, details);
export const unauthorized = (msg = 'No autenticado') => new AppError(401, 'unauthorized', msg);
export const forbidden = (msg = 'No autorizado') => new AppError(403, 'forbidden', msg);
export const notFound = (msg = 'No encontrado') => new AppError(404, 'not_found', msg);
export const conflict = (code: string, msg: string) => new AppError(409, code, msg);
export const tooMany = (msg = 'Demasiadas solicitudes, espera un momento.') => new AppError(429, 'rate_limited', msg);
