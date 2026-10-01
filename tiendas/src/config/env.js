import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Carga .env sin dependencias (KEY=valor por línea).
const envFile = path.resolve(import.meta.dirname, '../../.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const e = process.env;

export const env = {
  port: Number(e.PORT || 3000),
  baseUrl: (e.BASE_URL || `http://localhost:${e.PORT || 3000}`).replace(/\/$/, ''),
  dbPath: e.DB_PATH || path.resolve(import.meta.dirname, '../../data/tiendas.db'),
  adminPassword: e.ADMIN_PASSWORD || '',
  sessionSecret: e.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),

  // Proveedor: 'mock' (catálogo de demostración) o 'cj' (CJ Dropshipping).
  supplier: e.SUPPLIER || 'mock',
  cjApiKey: e.CJ_API_KEY || '',
  cjLogistic: e.CJ_LOGISTIC || 'CJPacket Ordinary',
  // Productos por búsqueda de nicho (cada tienda tiene 9 búsquedas: 3 por categoría).
  cjPerSearch: Number(e.CJ_PER_SEARCH || 8),
  // Pausa entre llamadas para respetar el límite de peticiones de CJ.
  cjDelayMs: Number(e.CJ_DELAY_MS ?? 1100),
  usdToMxn: Number(e.USD_TO_MXN || 18.5),

  // Pagos: 'mock' (demo, aprueba al instante) o 'stripe'.
  payments: e.PAYMENTS || 'mock',
  stripeSecretKey: e.STRIPE_SECRET_KEY || '',
  paymentFeePct: Number(e.PAYMENT_FEE_PCT || 3.6),
  paymentFeeFixed: Number(e.PAYMENT_FEE_FIXED_MXN || 3),

  // Sincronización automática del catálogo y del rastreo (minutos; 0 = desactivado).
  syncEveryMinutes: Number(e.SYNC_EVERY_MINUTES ?? 360),
  trackingEveryMinutes: Number(e.TRACKING_EVERY_MINUTES ?? 60),
};
