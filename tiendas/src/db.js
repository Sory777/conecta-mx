// Base de datos Postgres. En producción (Vercel) se conecta a Supabase con DATABASE_URL;
// en tu computadora y en las pruebas usa PGlite (Postgres en memoria o en una carpeta local).
// Todas las tablas viven en el esquema "tiendas" para no mezclarse con otros proyectos.
import { env } from './config/env.js';

const INT8 = 20, NUMERIC = 1700, TIMESTAMPTZ = 1184;
// Fechas como texto en hora de la Ciudad de México: "2026-10-03 14:05:09".
const mxTime = (v) => new Date(v).toLocaleString('sv-SE', { timeZone: 'America/Mexico_City' });
const parsers = { [INT8]: Number, [NUMERIC]: Number, [TIMESTAMPTZ]: mxTime };

let driver;

async function connect() {
  if (env.databaseUrl) {
    const { default: pg } = await import('pg');
    for (const [oid, fn] of Object.entries(parsers)) pg.types.setTypeParser(Number(oid), fn);
    const pool = new pg.Pool({
      connectionString: env.databaseUrl,
      // Supabase exige SSL; su certificado de pooler no está en la cadena por defecto de Node.
      ssl: { rejectUnauthorized: false },
      max: Number(process.env.DB_POOL_MAX || 3),
      idleTimeoutMillis: 10_000,
    });
    return {
      query: async (sql, params) => (await pool.query(sql, params)).rows,
      tx: async (fn) => {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const r = await fn(async (sql, params) => (await client.query(sql, params)).rows);
          await client.query('COMMIT');
          return r;
        } catch (err) {
          await client.query('ROLLBACK').catch(() => {});
          throw err;
        } finally {
          client.release();
        }
      },
    };
  }
  const { PGlite } = await import('@electric-sql/pglite');
  const lite = new PGlite(env.pgliteDir || undefined, { parsers });
  return {
    query: async (sql, params) => (await lite.query(sql, params)).rows,
    tx: (fn) => lite.transaction((t) => fn(async (sql, params) => (await t.query(sql, params)).rows)),
  };
}

// Todos los importes se guardan en centavos de MXN (enteros).
const SCHEMA = `
CREATE SCHEMA IF NOT EXISTS tiendas;

CREATE TABLE IF NOT EXISTS tiendas.products (
  id SERIAL PRIMARY KEY,
  supplier TEXT NOT NULL,
  supplier_product_id TEXT NOT NULL,
  supplier_variant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  image_url TEXT,
  icon TEXT,
  cost_cents INTEGER NOT NULL,
  shipping_cents INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  store_slug TEXT,                            -- tienda dueña del producto (cada producto vive en una sola tienda)
  popularity INTEGER NOT NULL DEFAULT 0,      -- tiendas que lo venden en el proveedor (indicador de ventas)
  search_term TEXT,                           -- búsqueda del nicho con la que se encontró
  title_custom TEXT,                          -- nombre en español editado desde el panel (la sincronización no lo pisa)
  audience TEXT,                              -- público (dama/caballero) en tiendas que lo usan
  hidden INTEGER NOT NULL DEFAULT 0,          -- ocultado a mano desde el panel (la sincronización lo respeta)
  sync_run TEXT,                              -- última sincronización que lo vio
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (supplier, supplier_variant_id)
);
CREATE INDEX IF NOT EXISTS products_store ON tiendas.products(store_slug, active);

CREATE TABLE IF NOT EXISTS tiendas.store_settings (
  store_slug TEXT PRIMARY KEY,
  markup DOUBLE PRECISION,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS tiendas.store_products (
  store_slug TEXT NOT NULL,
  product_id INTEGER NOT NULL REFERENCES tiendas.products(id) ON DELETE CASCADE,
  price_cents INTEGER NOT NULL,
  featured INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (store_slug, product_id)
);

CREATE TABLE IF NOT EXISTS tiendas.orders (
  id SERIAL PRIMARY KEY,
  number TEXT NOT NULL UNIQUE,
  store_slug TEXT NOT NULL,
  status TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  street TEXT NOT NULL,
  colonia TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip TEXT NOT NULL,
  total_cents INTEGER NOT NULL,
  supplier_cost_cents INTEGER NOT NULL,
  payment_fee_cents INTEGER NOT NULL DEFAULT 0,
  profit_cents INTEGER NOT NULL DEFAULT 0,
  payment_provider TEXT,
  payment_ref TEXT,
  supplier TEXT,
  supplier_order_id TEXT,
  tracking_number TEXT,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_store ON tiendas.orders(store_slug, created_at);
CREATE INDEX IF NOT EXISTS orders_status ON tiendas.orders(status);

CREATE TABLE IF NOT EXISTS tiendas.order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES tiendas.orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL,
  supplier_variant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  qty INTEGER NOT NULL,
  unit_price_cents INTEGER NOT NULL,
  unit_cost_cents INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tiendas.order_events (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES tiendas.orders(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Estado de la sincronización por partes (en servidores sin proceso permanente).
CREATE TABLE IF NOT EXISTS tiendas.sync_state (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  run TEXT,
  supplier TEXT,
  cursor INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  imported INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  last_error TEXT
);
`;

let ready;
// Conecta una sola vez por proceso y crea las tablas si faltan.
export function init() {
  ready ??= (async () => {
    driver = await connect();
    if (process.env.DB_SKIP_MIGRATIONS !== '1') {
      // En Supabase el esquema ya existe y pertenece al usuario de la app, que no puede crear esquemas nuevos.
      const exists = (await driver.query("SELECT 1 FROM pg_namespace WHERE nspname = 'tiendas'")).length > 0;
      for (const stmt of SCHEMA.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean)) {
        if (exists && stmt.startsWith('CREATE SCHEMA')) continue;
        await driver.query(stmt.replace(/--.*$/gm, ''));
      }
    }
    return driver;
  })().catch((err) => { ready = null; throw err; });
  return ready;
}

export async function q(sql, params = []) {
  return (await init()).query(sql, params);
}
export async function one(sql, params = []) {
  return (await q(sql, params))[0] ?? null;
}
// fn recibe una función query ligada a la transacción.
export async function tx(fn) {
  return (await init()).tx(fn);
}
