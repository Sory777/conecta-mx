import { describe, expect, it } from 'vitest';
import { SEED } from '@/data/seed';
import { SeedRepository } from '@/lib/data/seed-repository';
import { search } from '@/lib/search/engine';

const repo = new SeedRepository(SEED);

describe('universal search', () => {
  it('builds the curcumin → turmeric → colorectal cancer chain', async () => {
    const r = await search(repo, 'curcumina cáncer colon');
    expect(r.recognized.map((x) => x.entity.slug)).toEqual(['curcumina', 'cancer-colorrectal']);
    const chain = r.chains[0];
    expect(chain.agent.slug).toBe('curcumina');
    expect(chain.via.map((v) => v.slug)).toContain('curcuma');
    expect(chain.condition?.slug).toBe('cancer-colorrectal');
    expect(chain.claims.map((c) => c.context).sort()).toEqual(['cancer_treatment', 'research']);
  });

  it('tolerates typos', async () => {
    const r = await search(repo, 'curcumna');
    expect(r.recognized.map((x) => x.entity.slug)).toContain('curcumina');
    expect(r.recognized.every((x) => x.fuzzy)).toBe(true);
  });

  it('lists plants that interact with warfarin', async () => {
    const r = await search(repo, '¿Qué plantas pueden interactuar con warfarina?');
    const agents = r.interactions.map((i) => i.agent.slug);
    expect(agents).toEqual(expect.arrayContaining(['hiperico', 'ajo', 'manzanilla', 'ginkgo', 'curcuma']));
    expect(r.interactions.find((i) => i.agent.slug === 'curcuma')?.kind).toBe('insufficient');
  });

  it('reports a missing interaction record instead of inventing one', async () => {
    const r = await search(repo, 'romero warfarina');
    expect(r.interactions).toHaveLength(0);
    expect(r.missingInteractions.map((m) => m.agent.slug)).toEqual(['romero']);
  });

  it('filters prevention claims for foods', async () => {
    const r = await search(repo, 'alimentos relacionados con prevención del cáncer');
    expect(r.requestedTypes).toEqual(['food']);
    expect(r.conditionClaims.length).toBeGreaterThan(0);
    for (const c of r.conditionClaims) {
      expect(c.subject.type).toBe('food');
      expect(['prevention', 'safety']).toContain(c.context);
    }
  });

  it('finds mushrooms studied in oncology', async () => {
    const r = await search(repo, 'hongos estudiados en oncología');
    const subjects = r.conditionClaims.map((c) => c.subject.slug);
    expect(subjects).toContain('reishi');
  });

  it('includes compound claims for mushrooms through their compounds only when typed as compound', async () => {
    const r = await search(repo, 'cola de pavo cáncer');
    expect(r.chains[0].claims.map((c) => c.subject.slug)).toContain('psk');
  });

  it('withholds remedies on emergencies', async () => {
    const r = await search(repo, 'tengo dolor intenso de pecho, ¿qué té tomo?');
    expect(r.triage.emergency).toContain('chest_pain');
    expect(r.results).toHaveLength(0);
  });

  it('detects intent to treat cancer with plants', async () => {
    const r = await search(repo, 'Quiero tratar mi cáncer con plantas');
    expect(r.triage.cancerTreatmentIntent).toBe(true);
    const contexts = new Set(r.conditionClaims.map((c) => c.context));
    expect(contexts.has('cancer_treatment')).toBe(true);
    expect(contexts.has('research')).toBe(true);
  });
});
