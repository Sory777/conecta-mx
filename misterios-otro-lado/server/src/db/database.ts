import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

type Param = SQLInputValue | boolean | undefined;

const here = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_VERSION = 2;

function norm(params: Param[]): SQLInputValue[] {
  return params.map((p) => (p === undefined ? null : typeof p === 'boolean' ? (p ? 1 : 0) : p));
}

/**
 * Envoltorio fino sobre node:sqlite (síncrono).
 * - Todas las operaciones económicas se ejecutan dentro de `tx()` (BEGIN IMMEDIATE / SAVEPOINT).
 * - El servidor de juego es un único proceso: la serialización de SQLite garantiza atomicidad.
 *   Para escalar horizontalmente se migra a PostgreSQL (ver ARCHITECTURE.md).
 */
export class Db {
  readonly raw: DatabaseSync;
  private depth = 0;
  private commitQueue: (() => void)[] = [];
  private stmtCache = new Map<string, ReturnType<DatabaseSync['prepare']>>();

  constructor(file: string) {
    if (file !== ':memory:') mkdirSync(path.dirname(file), { recursive: true });
    this.raw = new DatabaseSync(file);
    this.raw.exec('PRAGMA journal_mode = WAL;');
    this.raw.exec('PRAGMA synchronous = NORMAL;');
    this.raw.exec('PRAGMA foreign_keys = ON;');
    this.raw.exec('PRAGMA busy_timeout = 5000;');
  }

  private stmt(sql: string) {
    let s = this.stmtCache.get(sql);
    if (!s) {
      s = this.raw.prepare(sql);
      this.stmtCache.set(sql, s);
    }
    return s;
  }

  get<T = Record<string, unknown>>(sql: string, ...params: Param[]): T | undefined {
    return this.stmt(sql).get(...norm(params)) as T | undefined;
  }

  all<T = Record<string, unknown>>(sql: string, ...params: Param[]): T[] {
    return this.stmt(sql).all(...norm(params)) as T[];
  }

  run(sql: string, ...params: Param[]): { changes: number } {
    const r = this.stmt(sql).run(...norm(params));
    return { changes: Number(r.changes) };
  }

  exec(sql: string) {
    this.raw.exec(sql);
  }

  /** Transacción anidable. Si `fn` lanza, se revierte todo. */
  tx<T>(fn: () => T): T {
    const outer = this.depth === 0;
    const sp = `sp_${this.depth}`;
    this.raw.exec(outer ? 'BEGIN IMMEDIATE' : `SAVEPOINT ${sp}`);
    this.depth++;
    try {
      const out = fn();
      this.depth--;
      this.raw.exec(outer ? 'COMMIT' : `RELEASE ${sp}`);
      if (outer) this.flushCommitQueue();
      return out;
    } catch (e) {
      this.depth--;
      this.raw.exec(outer ? 'ROLLBACK' : `ROLLBACK TO ${sp}; RELEASE ${sp}`);
      if (outer) this.commitQueue = [];
      throw e;
    }
  }

  /** Ejecuta `fn` cuando la transacción más externa se confirma (o de inmediato si no hay transacción). */
  onCommit(fn: () => void) {
    if (this.depth === 0) fn();
    else this.commitQueue.push(fn);
  }

  private flushCommitQueue() {
    const q = this.commitQueue;
    this.commitQueue = [];
    for (const fn of q) {
      try {
        fn();
      } catch (e) {
        console.error('[db] onCommit handler failed', e);
      }
    }
  }

  migrate() {
    const schema = readFileSync(path.join(here, 'schema.sql'), 'utf8');
    this.raw.exec(schema);
    // v2 — monetización y Telegram: columnas añadidas a tablas existentes (idempotente).
    this.addColumn('users', 'vip_until', 'INTEGER');
    this.addColumn('ad_views', 'network_id', 'TEXT');
    this.addColumn('ad_views', 'format', 'TEXT');
    this.addColumn('ad_views', 'env', 'TEXT');
    this.addColumn('ad_views', 'verified', 'INTEGER NOT NULL DEFAULT 0');
    this.addColumn('ad_views', 'result', 'TEXT');
    this.addColumn('sponsor_campaigns', 'link_url', 'TEXT');
    this.addColumn('sponsor_campaigns', 'contract_value_cents', 'INTEGER NOT NULL DEFAULT 0');
    this.addColumn('sponsor_campaigns', 'clicks', 'INTEGER NOT NULL DEFAULT 0');
    this.addColumn('purchases', 'amount_stars', 'INTEGER NOT NULL DEFAULT 0');
    this.raw.exec('CREATE INDEX IF NOT EXISTS idx_ad_views_network ON ad_views(network_id, format, started_at)');
    const row = this.get<{ v: number | null }>('SELECT MAX(version) AS v FROM schema_migrations');
    if (!row?.v || row.v < SCHEMA_VERSION) {
      this.run('INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (?, ?)', SCHEMA_VERSION, Date.now());
    }
  }

  private addColumn(table: string, column: string, def: string) {
    const cols = this.all<{ name: string }>(`PRAGMA table_info(${table})`);
    if (!cols.some((c) => c.name === column)) this.raw.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
  }

  close() {
    this.raw.close();
  }
}

export const json = {
  parse<T>(s: unknown, fallback: T): T {
    if (typeof s !== 'string') return fallback;
    try {
      return JSON.parse(s) as T;
    } catch {
      return fallback;
    }
  },
  str(v: unknown): string {
    return JSON.stringify(v ?? null);
  },
};
