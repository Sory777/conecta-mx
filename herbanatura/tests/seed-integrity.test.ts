import { describe, expect, it } from 'vitest';
import { SEED } from '@/data/seed';

const entityIds = new Set(SEED.entities.map((e) => e.id));
const sourceIds = new Set(SEED.sources.map((s) => s.id));
const regionSlugs = new Set(SEED.regions.map((r) => r.slug));
const allCitations = [
  ...SEED.entities.flatMap((e) => [...e.citations, ...e.safety.flatMap((s) => s.citations)]),
  ...SEED.claims.flatMap((c) => c.citations),
  ...SEED.interactions.flatMap((i) => i.citations),
  ...SEED.traditionalUses.flatMap((t) => t.citations),
  ...SEED.relations.flatMap((r) => r.citations),
];

describe('demo dataset integrity', () => {
  it('has unique slugs and ids', () => {
    expect(new Set(SEED.entities.map((e) => e.slug)).size).toBe(SEED.entities.length);
    expect(new Set(SEED.regions.map((r) => r.slug)).size).toBe(SEED.regions.length);
  });

  it('every citation points to a known source', () => {
    for (const c of allCitations) expect(sourceIds.has(c.sourceId), c.sourceId).toBe(true);
  });

  it('every reference resolves', () => {
    for (const c of SEED.claims) {
      expect(entityIds.has(c.subjectId), c.id).toBe(true);
      if (c.conditionId) expect(entityIds.has(c.conditionId), c.id).toBe(true);
    }
    for (const i of SEED.interactions) {
      expect(entityIds.has(i.agentId), i.id).toBe(true);
      expect(entityIds.has(i.medicationId), i.id).toBe(true);
    }
    for (const r of SEED.relations) {
      expect(entityIds.has(r.subjectId), r.id).toBe(true);
      expect(entityIds.has(r.objectId), r.id).toBe(true);
    }
    for (const t of SEED.traditionalUses) {
      expect(entityIds.has(t.entityId), t.id).toBe(true);
      expect(regionSlugs.has(t.regionSlug), t.id).toBe(true);
    }
    for (const e of SEED.entities) for (const r of e.regions) expect(regionSlugs.has(r), `${e.slug} → ${r}`).toBe(true);
  });

  it('every medical claim and interaction cites at least one source', () => {
    for (const c of SEED.claims) expect(c.citations.length, c.id).toBeGreaterThan(0);
    for (const i of SEED.interactions) expect(i.citations.length, i.id).toBeGreaterThan(0);
  });

  it('nothing in the demo set is presented as human-reviewed', () => {
    for (const x of [...SEED.entities, ...SEED.claims, ...SEED.interactions, ...SEED.traditionalUses]) expect(x.reviewStatus).toBe('pending_review');
    for (const s of SEED.sources) expect(s.reviewedAt ?? null).toBeNull();
  });

  it('contains no hand-written studies, DOIs or PMIDs', () => {
    expect(SEED.studies).toHaveLength(0);
    const text = JSON.stringify(SEED);
    expect(text).not.toMatch(/\b10\.\d{4,9}\/[^\s"]+/);
    expect(text).not.toMatch(/PMID/i);
    expect(text).not.toMatch(/NCT\d{8}/);
  });

  it('cancer-treatment claims never assert human efficacy below level A/B', () => {
    for (const c of SEED.claims.filter((c) => c.context === 'cancer_treatment')) {
      expect(['A', 'B']).not.toContain(c.level);
      expect(c.humanEvidence).toBe(false);
    }
  });

  it('preclinical claims are never marked as human evidence', () => {
    for (const c of SEED.claims.filter((c) => ['preclinical', 'in_vitro', 'animal'].includes(c.category)))
      expect(c.humanEvidence, c.id).toBe(false);
  });

  it('includes the 32 Mexican states and the 46 municipalities of Guanajuato', () => {
    expect(SEED.regions.filter((r) => r.level === 'state' && r.parentSlug === 'mexico')).toHaveLength(32);
    expect(SEED.regions.filter((r) => r.level === 'municipality' && r.parentSlug === 'guanajuato')).toHaveLength(46);
  });
});
