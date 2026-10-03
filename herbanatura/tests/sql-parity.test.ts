/**
 * Parity between the in-memory SeedRepository and the PostgreSQL `api_*` functions.
 * Runs only when HN_TEST_DB points to a database prepared by `npm run db:test`.
 */
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { SEED } from '@/data/seed';
import { seedUuid } from '@/lib/data/seed-ids';
import { SeedRepository } from '@/lib/data/seed-repository';

const DB = process.env.HN_TEST_DB;
const repo = new SeedRepository(SEED);

function sql(query: string): unknown {
  const out = execFileSync('psql', ['-X', '-At', '-d', DB!, '-c', query], { encoding: 'utf8' });
  return JSON.parse(out);
}

const ID_KEYS = new Set(['id', 'subjectId', 'conditionId', 'objectId', 'agentId', 'medicationId', 'entityId']);

/** Map dataset ids to database UUIDs, drop null/empty-optional keys, sort arrays. */
function canonical(v: unknown, fromSeed: boolean, key = '', parent?: Record<string, unknown>): unknown {
  if (Array.isArray(v)) {
    const items = v.map((x) => canonical(x, fromSeed, key, parent));
    return items.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  }
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const isSource = 'publisher' in o;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(o).sort()) {
      if (o[k] === null || o[k] === undefined) continue;
      let val = o[k];
      if (fromSeed && typeof val === 'string' && (ID_KEYS.has(k) || k === 'sourceId')) {
        val = isSource || k === 'sourceId' ? seedUuid(`source:${val}`) : seedUuid(val);
      }
      out[k] = canonical(val, fromSeed, k, o);
    }
    return out;
  }
  return v;
}

describe.skipIf(!DB)('SQL ↔ seed parity', () => {
  for (const slug of ['curcuma', 'curcumina', 'warfarina', 'brocoli', 'cancer-colorrectal', 'hiperico', 'amanita-phalloides', 'cannabis']) {
    it(`api_entity_detail('${slug}') matches SeedRepository`, async () => {
      const fromSql = sql(`select public.api_entity_detail('${slug}')`);
      const fromSeed = JSON.parse(JSON.stringify(await repo.getEntityDetail(slug)));
      expect(canonical(fromSql, false)).toEqual(canonical(fromSeed, true));
    });
  }

  it('api_list_claims(cancer_only) matches', async () => {
    const fromSql = sql(`select public.api_list_claims(p_cancer_only => true)`);
    const fromSeed = JSON.parse(JSON.stringify(await repo.listClaims({ cancerOnly: true })));
    expect(canonical(fromSql, false)).toEqual(canonical(fromSeed, true));
  });
});
