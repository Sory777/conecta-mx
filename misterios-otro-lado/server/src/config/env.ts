import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '../../..');

const bool = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(0).max(65535).default(8787),
  DATABASE_PATH: z.string().default(path.join(projectRoot, 'data', 'misterios.db')),
  CONTENT_DIR: z.string().default(path.join(projectRoot, 'content')),
  CLIENT_DIST: z.string().default(path.join(projectRoot, 'client', 'dist')),
  PUBLIC_BASE_URL: z.string().default('http://localhost:5173'),
  /** Secreto del servidor para HMAC (hash de dispositivos, etc.). OBLIGATORIO en producción. */
  SERVER_SECRET: z.string().min(32).optional(),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(24 * 90).default(24 * 30),
  TRUST_PROXY: bool.default(false),
  /** Intentos de autenticación permitidos por IP cada 10 minutos. */
  AUTH_RATE_PER_10MIN: z.coerce.number().int().min(1).default(20),
  /** Modo sandbox: pagos, anuncios y canjes simulados y claramente marcados. */
  SANDBOX_MODE: bool.default(true),
  /** Candado duro: aunque el admin active los canjes reales, no se permiten si esto es false. */
  REAL_PAYOUTS_ALLOWED: bool.default(false),
  PAYMENT_PROVIDER: z.enum(['sandbox', 'none']).default('sandbox'),
  AD_PROVIDER: z.enum(['sandbox', 'none']).default('sandbox'),
  MAIL_PROVIDER: z.enum(['console', 'none']).default('console'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export type AppConfig = z.infer<typeof EnvSchema> & { serverSecret: string; projectRoot: string };

export function loadConfig(overrides: Record<string, string | undefined> = {}): AppConfig {
  const parsed = EnvSchema.safeParse({ ...process.env, ...overrides });
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Configuración inválida:\n${msg}`);
  }
  const env = parsed.data;
  if (env.NODE_ENV === 'production') {
    if (!env.SERVER_SECRET) throw new Error('SERVER_SECRET es obligatorio en producción (mín. 32 caracteres).');
    if (env.SANDBOX_MODE && env.PAYMENT_PROVIDER === 'sandbox') {
      console.warn('[config] ATENCIÓN: producción con proveedor de pagos SANDBOX. Ninguna compra es real.');
    }
  }
  let serverSecret = env.SERVER_SECRET;
  if (!serverSecret && env.NODE_ENV === 'development' && env.DATABASE_PATH !== ':memory:') {
    // Desarrollo: secreto generado y persistido junto a la BD (nunca en el repositorio).
    const file = path.join(path.dirname(env.DATABASE_PATH), '.dev-server-secret');
    if (existsSync(file)) serverSecret = readFileSync(file, 'utf8').trim();
    else {
      serverSecret = randomBytes(32).toString('hex');
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, serverSecret, { mode: 0o600 });
      console.warn(`[config] SERVER_SECRET no definido: se generó uno de desarrollo en ${file}`);
    }
  }
  serverSecret ??= randomBytes(32).toString('hex');
  return { ...env, serverSecret, projectRoot };
}
