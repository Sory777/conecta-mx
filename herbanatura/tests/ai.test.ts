import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SEED } from '@/data/seed';
import { SeedRepository } from '@/lib/data/seed-repository';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { computeConfidence, retrieve } from '@/lib/ai/context';
import { guardAnswer } from '@/lib/ai/guard';

const mockCall = vi.fn();
vi.mock('@/lib/ai/anthropic', () => ({ structuredCall: (...a: unknown[]) => mockCall(...a) }));

const repo = new SeedRepository(SEED);
const dict = getDictionary('es');

describe('RAG retrieval', () => {
  it('retrieves claims, safety and interactions for a plant question', async () => {
    const { documents } = await retrieve(repo, '¿Qué se sabe sobre la cúrcuma?', 'es', dict);
    const kinds = new Set(documents.map((d) => d.kind));
    expect(kinds).toEqual(new Set(['claim', 'entity', 'safety', 'interaction', 'traditional']));
    expect(documents.every((d, i) => d.key === `D${i + 1}`)).toBe(true);
  });

  it('confidence is computed from evidence, capped while unreviewed', async () => {
    const { documents } = await retrieve(repo, 'jengibre náuseas del embarazo', 'es', dict);
    expect(computeConfidence(documents)).toBe('moderate'); // level B but pending review
    expect(computeConfidence([])).toBe('insufficient');
  });
});

describe('anti-fabrication guard', () => {
  const docs = [{ key: 'D1', kind: 'claim' as const, title: 't', text: 'x', reviewStatus: 'pending_review', sources: [SEED.sources[0]] }];
  it('removes unknown citation keys, DOIs, PMIDs, NCT ids and URLs', () => {
    const g = guardAnswer(`Cierto [D1]. Inventado [D9]. Ver doi:10.1234/fake.5 y PMID 123456, NCT01234567, https://evil.example/x y ${SEED.sources[0].url}`, docs);
    expect(g.text).not.toMatch(/D9|10\.1234|123456|NCT01234567|evil\.example/);
    expect(g.text).toContain(SEED.sources[0].url);
    expect(g.cited).toEqual(['D1']);
    expect(g.removed).toBe(5);
  });
});

describe('askHerba orchestration', () => {
  beforeEach(() => {
    mockCall.mockReset();
    process.env.ANTHROPIC_API_KEY = 'test';
  });

  it('never calls the model on emergencies', async () => {
    const { askHerba } = await import('@/lib/ai/herba');
    const a = await askHerba(repo, 'Mi hijo tiene convulsiones, ¿qué hierba le doy?', 'es', dict);
    expect(a.mode).toBe('emergency');
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('strips invented references from model output and keeps sources from retrieved docs only', async () => {
    mockCall.mockResolvedValue({
      model: 'm',
      data: { answer: 'La curcumina se estudió en laboratorio [D1]. Un ensayo (doi:10.9999/invented) lo curó [D42].', simple: 'Sólo en laboratorio [D1].', gaps: [] },
    });
    const { askHerba } = await import('@/lib/ai/herba');
    const a = await askHerba(repo, 'curcumina cáncer colon', 'es', dict);
    expect(a.mode).toBe('generative');
    expect(a.answer).not.toContain('10.9999');
    expect(a.answer).not.toContain('[D42]');
    expect(a.removedReferences).toBe(2);
    expect(a.sources.length).toBeGreaterThan(0);
  });

  it('falls back to extractive mode when the model cites nothing', async () => {
    mockCall.mockResolvedValue({ model: 'm', data: { answer: 'La cúrcuma cura todo.', simple: 'Cura todo.', gaps: [] } });
    const { askHerba } = await import('@/lib/ai/herba');
    const a = await askHerba(repo, '¿Qué se sabe sobre la cúrcuma?', 'es', dict);
    expect(a.mode).toBe('extractive');
    expect(a.answer).not.toContain('cura todo');
  });

  it('adds the cancer disclaimer on treatment intent', async () => {
    mockCall.mockResolvedValue(null);
    const { askHerba } = await import('@/lib/ai/herba');
    const a = await askHerba(repo, 'Quiero tratar mi cáncer con plantas', 'es', dict);
    expect(a.disclaimers[0]).toBe(dict.disclaimers.cancer);
  });
});
