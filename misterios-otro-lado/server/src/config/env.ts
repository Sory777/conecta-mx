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
  // ---------------- Telegram
  /** Token del bot (BotFather). SECRETO: sólo en el servidor. */
  TELEGRAM_BOT_TOKEN: z.string().min(20).optional(),
  TELEGRAM_BOT_USERNAME: z.string().regex(/^[A-Za-z0-9_]{3,64}$/).optional(),
  /** Nombre corto de la Mini App creada con /newapp (para enlaces t.me/<bot>/<app>). */
  TELEGRAM_APP_SHORT_NAME: z.string().regex(/^[A-Za-z0-9_]{3,64}$/).optional(),
  /** URL HTTPS pública donde se sirve el juego (la que abre el botón del bot). */
  TELEGRAM_WEBAPP_URL: z.string().url().optional(),
  /** Cómo recibe el bot las actualizaciones: off | polling | webhook */
  TELEGRAM_UPDATES: z.enum(['off', 'polling', 'webhook']).default('off'),
  TELEGRAM_WEBHOOK_SECRET: z.string().regex(/^[A-Za-z0-9_-]{16,256}$/).optional(),
  /** Antigüedad máxima aceptada del initData de la Mini App. */
  TELEGRAM_INITDATA_MAX_AGE_SEC: z.coerce.number().int().min(60).max(7 * 86400).default(86400),
  /** Cobros reales con Telegram Stars. Desactivado por defecto: actívalo conscientemente. */
  TELEGRAM_STARS_ENABLED: bool.default(false),
  // ---------------- Anuncios
  /** Secreto para las URLs de recompensa/postback que llaman las redes de anuncios. */
  ADS_CALLBACK_SECRET: z.string().min(16).optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export type AppConfig = z.infer<typeof EnvSchema> & { serverSecret: string; projectRoot: string };

export function loadConfig(overrides: Record<string, string | undefined> = {}): AppConfig {
  // Carga opcional de `.env` en la raíz del proyecto (sin dependencias externas).
  const envFile = path.join(projectRoot, '.env');
  if (overrides.NODE_ENV !== 'test' && existsSync(envFile)) process.loadEnvFile(envFile);
  // Variables vacías (p. ej. `SERVER_SECRET=`) se tratan como no definidas.
  const merged = Object.fromEntries(Object.entries({ ...process.env, ...overrides }).filter(([, v]) => v !== undefined && v !== ''));
  const parsed = EnvSchema.safeParse(merged);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Configuración inválida:\n${msg}`);
  }
  const env = parsed.data;
  // Rutas relativas: relativas a la raíz del proyecto (no al directorio de trabajo).
  const abs = (p: string) => (p === ':memory:' || path.isAbsolute(p) ? p : path.resolve(projectRoot, p));
  env.DATABASE_PATH = abs(env.DATABASE_PATH);
  env.CONTENT_DIR = abs(env.CONTENT_DIR);
  env.CLIENT_DIST = abs(env.CLIENT_DIST);
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
