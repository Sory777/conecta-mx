import type { EntityDetail, Locale, ResolvedClaim, ResolvedInteraction, Source } from '@/lib/domain/types';
import type { KnowledgeRepository } from '@/lib/data/repository';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { tr } from '@/lib/i18n/text';
import { search, type SearchResponse } from '@/lib/search/engine';

/** A retrieved knowledge-base fragment. The model may cite ONLY these keys. */
export interface RagDocument {
  key: string; // D1, D2…
  kind: 'entity' | 'claim' | 'interaction' | 'safety' | 'traditional';
  title: string;
  text: string;
  level?: ResolvedClaim['level'];
  humanEvidence?: boolean;
  reviewStatus: string;
  sources: Source[];
  href?: string;
}

const MAX_DOCS = 30;
const MAX_ENTITIES = 4;

export interface Retrieval {
  search: SearchResponse;
  documents: RagDocument[];
}

export async function retrieve(repo: KnowledgeRepository, question: string, locale: Locale, dict: Dictionary): Promise<Retrieval> {
  const s = await search(repo, question);
  const docs: RagDocument[] = [];
  const seen = new Set<string>();
  const push = (d: Omit<RagDocument, 'key'>, id: string) => {
    if (seen.has(id) || docs.length >= MAX_DOCS) return;
    seen.add(id);
    docs.push({ ...d, key: `D${docs.length + 1}` });
  };

  const claimDoc = (c: ResolvedClaim) =>
    push(
      {
        kind: 'claim',
        title: `${tr(c.subject.name, locale)}${c.condition ? ` → ${tr(c.condition.name, locale)}` : ''} · ${dict.contexts[c.context]}`,
        text: [
          tr(c.statement, locale),
          `${dict.claim.level}: ${c.level} (${dict.levels[c.level]}). ${dict.claim.category}: ${dict.categories[c.category]}.`,
          `${dict.claim.studyTypes}: ${c.studyTypes.map((x) => dict.studyTypes[x]).join(', ') || '—'}. ${c.humanEvidence ? dict.claim.humanEvidence : dict.claim.noHumanEvidence}.`,
          c.whatWeDontKnow.length ? `${dict.claim.whatWeDontKnow} ${c.whatWeDontKnow.map((x) => tr(x, locale)).join(' ')}` : '',
          c.risks.length ? `${dict.claim.risks} ${c.risks.map((x) => tr(x, locale)).join(' ')}` : '',
          `${dict.claim.simple}: ${tr(c.simple, locale)}`,
        ].filter(Boolean).join('\n'),
        level: c.level,
        humanEvidence: c.humanEvidence,
        reviewStatus: c.reviewStatus,
        sources: c.sources,
      },
      c.id,
    );

  const interactionDoc = (i: ResolvedInteraction) =>
    push(
      {
        kind: 'interaction',
        title: `${tr(i.agent.name, locale)} × ${tr(i.medication.name, locale)}`,
        text: i.kind === 'insufficient' ? dict.interactionKinds.insufficient : `${dict.interactionKinds[i.kind]}. ${tr(i.effect, locale)} ${dict.severity[i.severity]}.${i.mechanism ? ' ' + tr(i.mechanism, locale) : ''}`,
        level: i.level,
        reviewStatus: i.reviewStatus,
        sources: i.sources,
      },
      i.id,
    );

  // Explicit chains and condition claims first: they answer the question most directly.
  s.chains.forEach((c) => c.claims.forEach(claimDoc));
  s.conditionClaims.forEach(claimDoc);
  s.interactions.forEach(interactionDoc);

  const details: EntityDetail[] = [];
  for (const r of s.recognized.slice(0, MAX_ENTITIES)) {
    const d = await repo.getEntityDetail(r.entity.slug);
    if (d) details.push(d);
  }
  for (const d of details) {
    const e = d.entity;
    const bySource = new Map(d.sources.map((x) => [x.id, x]));
    push(
      {
        kind: 'entity',
        title: tr(e.name, locale),
        text: [e.summary ? tr(e.summary, locale) : dict.entity.pending, e.type === 'plant' && e.plant.nameAmbiguity ? tr(e.plant.nameAmbiguity, locale) : ''].filter(Boolean).join('\n'),
        reviewStatus: e.reviewStatus,
        sources: e.citations.map((c) => bySource.get(c.sourceId)).filter((x): x is Source => !!x),
      },
      e.id,
    );
    d.claims.forEach(claimDoc);
    e.safety.forEach((sn, idx) =>
      push(
        {
          kind: 'safety',
          title: `${tr(e.name, locale)} · ${dict.safetyTopics[sn.topic]}`,
          text: `${dict.safetyStatus[sn.status]}: ${tr(sn.text, locale)}`,
          reviewStatus: sn.reviewStatus,
          sources: sn.citations.map((c) => bySource.get(c.sourceId)).filter((x): x is Source => !!x),
        },
        `${e.id}:safety:${idx}`,
      ),
    );
    d.interactions.forEach(interactionDoc);
    d.traditionalUses.forEach((t) =>
      push(
        {
          kind: 'traditional',
          title: `${tr(e.name, locale)} · ${dict.entity.traditionalUses}`,
          text: `${tr(t.use, locale)} (${dict.entity.traditionalNotice})`,
          level: 'F',
          reviewStatus: t.reviewStatus,
          sources: t.sources,
        },
        t.id,
      ),
    );
  }
  return { search: s, documents: docs };
}

export type Confidence = 'high' | 'moderate' | 'low' | 'insufficient';

/**
 * Confidence is computed from the retrieved evidence — never by the model —
 * so a fluent answer cannot look more certain than its sources.
 */
export function computeConfidence(docs: RagDocument[]): Confidence {
  const levels = docs.filter((d) => d.kind === 'claim' && d.level).map((d) => ({ level: d.level!, reviewed: d.reviewStatus === 'reviewed' }));
  if (!levels.length) return 'insufficient';
  if (levels.some((l) => (l.level === 'A' || l.level === 'B') && l.reviewed)) return 'high';
  if (levels.some((l) => ['A', 'B', 'C', 'D'].includes(l.level))) return 'moderate';
  return 'low';
}

export function renderDocuments(docs: RagDocument[]): string {
  return docs
    .map(
      (d) =>
        `<document key="${d.key}" kind="${d.kind}" review_status="${d.reviewStatus}"${d.level ? ` evidence_level="${d.level}"` : ''}>\n<title>${d.title}</title>\n<content>${d.text}</content>\n<sources>${d.sources.map((s) => `${s.title} — ${s.publisher}`).join('; ') || 'none'}</sources>\n</document>`,
    )
    .join('\n');
}
