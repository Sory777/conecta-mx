import type { Dataset } from '@/data/seed';
import type {
  Citation,
  Entity,
  EntityDetail,
  EntityRef,
  EntityType,
  EvidenceClaim,
  Interaction,
  Region,
  ResolvedClaim,
  ResolvedInteraction,
  ResolvedRelation,
  ReviewStatus,
  Source,
} from '@/lib/domain/types';
import { ENTITY_TYPES, REVIEW_STATUSES } from '@/lib/domain/types';
import { normalize } from '@/lib/search/normalize';
import { scientificName, toRef, toSummary } from '@/lib/domain/entity';
import type {
  ClaimFilter,
  EntityListFilter,
  EntitySummary,
  InteractionFilter,
  KnowledgeRepository,
  KnowledgeStats,
  LexiconEntry,
  ReviewItem,
  StudyFilter,
  TraditionalUseResolved,
} from './repository';

/** Public visibility rule, identical to the RLS policies: rejected content is never shown. */
const visible = (s: { reviewStatus: ReviewStatus }) => s.reviewStatus !== 'rejected';

export class SeedRepository implements KnowledgeRepository {
  readonly mode = 'seed' as const;
  private bySlug = new Map<string, Entity>();
  private byId = new Map<string, Entity>();
  private sources = new Map<string, Source>();
  private regions = new Map<string, Region>();

  constructor(private data: Dataset) {
    for (const e of data.entities) {
      this.bySlug.set(e.slug, e);
      this.byId.set(e.id, e);
    }
    for (const s of data.sources) this.sources.set(s.id, s);
    for (const r of data.regions) this.regions.set(r.slug, r);
  }

  private ref = (id: string): EntityRef | null => {
    const e = this.byId.get(id);
    return e && visible(e) ? toRef(e) : null;
  };

  private resolveSources(citations: Citation[]): Source[] {
    const out: Source[] = [];
    for (const c of citations) {
      const s = this.sources.get(c.sourceId);
      if (s && !out.includes(s)) out.push(s);
    }
    return out;
  }

  private cancerConditionIds(): Set<string> {
    return new Set(this.data.entities.filter((e) => e.type === 'condition' && e.condition.isCancer).map((e) => e.id));
  }

  private resolveClaim = (c: EvidenceClaim): ResolvedClaim | null => {
    const subject = this.ref(c.subjectId);
    if (!subject) return null;
    const condition = c.conditionId ? this.ref(c.conditionId) : null;
    return { ...c, subject, condition, sources: this.resolveSources(c.citations) };
  };

  private resolveInteraction = (i: Interaction): ResolvedInteraction | null => {
    const agent = this.ref(i.agentId);
    const medication = this.ref(i.medicationId);
    if (!agent || !medication) return null;
    return { ...i, agent, medication, sources: this.resolveSources(i.citations) };
  };

  async getLexicon(): Promise<LexiconEntry[]> {
    const out: LexiconEntry[] = [];
    for (const e of this.data.entities) {
      if (!visible(e)) continue;
      const base = { entityId: e.id, type: e.type, slug: e.slug, name: e.name };
      for (const n of Object.values(e.name)) if (n) out.push({ ...base, term: n, kind: 'name' });
      const sci = scientificName(e);
      if (sci) {
        out.push({ ...base, term: sci, kind: 'scientific' });
        // Genus + epithet without authority, e.g. "Curcuma longa"
        const binomial = sci.split(' ').slice(0, 2).join(' ');
        if (binomial !== sci) out.push({ ...base, term: binomial, kind: 'scientific' });
      }
      for (const a of e.aliases) out.push({ ...base, term: a.name, kind: a.kind === 'scientific_synonym' ? 'scientific' : 'alias' });
      if (e.type === 'plant') for (const s of e.plant.synonyms) out.push({ ...base, term: s.split(' ').slice(0, 2).join(' '), kind: 'scientific' });
    }
    return out;
  }

  async getEntityRefs(ids: string[]): Promise<EntityRef[]> {
    return ids.map(this.ref).filter((x): x is EntityRef => !!x);
  }

  async getEntity(slug: string): Promise<Entity | null> {
    const e = this.bySlug.get(slug);
    return e && visible(e) ? e : null;
  }

  async getEntityDetail(slug: string): Promise<EntityDetail | null> {
    const entity = await this.getEntity(slug);
    if (!entity) return null;
    const relations = await this.listRelations([entity.id]);
    // Claims about the entity itself, about compounds it contains, or about it as a condition.
    const containedIds = relations.filter((r) => r.subjectId === entity.id && r.predicate === 'contains').map((r) => r.objectId);
    const claims =
      entity.type === 'condition'
        ? await this.listClaims({ conditionIds: [entity.id] })
        : await this.listClaims({ subjectIds: [entity.id, ...containedIds] });
    const interactions =
      entity.type === 'medication'
        ? await this.listInteractions({ medicationId: entity.id })
        : await this.listInteractions({ agentIds: [entity.id] });
    const traditionalUses = (await this.listTraditionalUses({ entityId: entity.id })).map(({ entity: _e, ...rest }) => rest);
    const studies = await this.listStudies({ entityIds: [entity.id] });

    const sources = new Map<string, Source>();
    const add = (list: Source[]) => list.forEach((s) => sources.set(s.id, s));
    add(this.resolveSources(entity.citations));
    entity.safety.forEach((s) => add(this.resolveSources(s.citations)));
    claims.forEach((c) => add(c.sources));
    interactions.forEach((i) => add(i.sources));
    traditionalUses.forEach((t) => add(t.sources));

    return { entity, relations, claims, interactions, traditionalUses, studies, sources: [...sources.values()] };
  }

  async listEntities(filter: EntityListFilter) {
    let items = this.data.entities.filter(visible);
    if (filter.type) items = items.filter((e) => e.type === filter.type);
    if (filter.tag) items = items.filter((e) => e.tags.includes(filter.tag!));
    if (filter.region) items = items.filter((e) => e.regions.includes(filter.region!));
    items.sort((a, b) => a.name.es.localeCompare(b.name.es, 'es'));
    const total = items.length;
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 200;
    return { items: items.slice(offset, offset + limit).map(toSummary), total };
  }

  async fullTextSearch(q: string, opts: { types?: EntityType[]; limit?: number } = {}) {
    const tokens = normalize(q).split(' ').filter((t) => t.length > 1);
    if (!tokens.length) return [];
    const scored: [number, Entity][] = [];
    for (const e of this.data.entities) {
      if (!visible(e) || (opts.types && !opts.types.includes(e.type))) continue;
      const names = normalize([...Object.values(e.name), scientificName(e) ?? '', ...e.aliases.map((a) => a.name)].join(' '));
      const body = normalize([e.summary?.es ?? '', e.summary?.en ?? '', ...e.tags].join(' '));
      let score = 0;
      for (const t of tokens) {
        if (names.split(' ').includes(t)) score += 3;
        else if (names.includes(t)) score += 2;
        else if (body.includes(t)) score += 1;
      }
      if (score > 0) scored.push([score, e]);
    }
    scored.sort((a, b) => b[0] - a[0] || a[1].name.es.localeCompare(b[1].name.es));
    return scored.slice(0, opts.limit ?? 20).map(([, e]) => toSummary(e));
  }

  async listClaims(filter: ClaimFilter): Promise<ResolvedClaim[]> {
    const cancer = filter.cancerOnly ? this.cancerConditionIds() : null;
    return this.data.claims
      .filter(visible)
      .filter((c) => !filter.subjectIds || filter.subjectIds.includes(c.subjectId))
      .filter((c) => !filter.conditionIds || (c.conditionId && filter.conditionIds.includes(c.conditionId)))
      .filter((c) => !filter.contexts || filter.contexts.includes(c.context))
      .filter((c) => !cancer || (c.conditionId && cancer.has(c.conditionId)))
      .filter((c) => !filter.subjectTypes || filter.subjectTypes.includes(this.byId.get(c.subjectId)?.type as EntityType))
      .map(this.resolveClaim)
      .filter((x): x is ResolvedClaim => !!x);
  }

  async listInteractions(filter: InteractionFilter): Promise<ResolvedInteraction[]> {
    return this.data.interactions
      .filter(visible)
      .filter((i) => !filter.medicationId || i.medicationId === filter.medicationId)
      .filter((i) => !filter.agentIds || filter.agentIds.includes(i.agentId))
      .map(this.resolveInteraction)
      .filter((x): x is ResolvedInteraction => !!x);
  }

  async listRelations(entityIds: string[]): Promise<ResolvedRelation[]> {
    const ids = new Set(entityIds);
    const out: ResolvedRelation[] = [];
    for (const r of this.data.relations) {
      if (!visible(r) || (!ids.has(r.subjectId) && !ids.has(r.objectId))) continue;
      const subject = this.ref(r.subjectId);
      const object = this.ref(r.objectId);
      if (subject && object) out.push({ ...r, subject, object });
    }
    return out;
  }

  async listTraditionalUses(filter: { regionSlugs?: string[]; entityId?: string }): Promise<TraditionalUseResolved[]> {
    const out: TraditionalUseResolved[] = [];
    for (const t of this.data.traditionalUses) {
      if (!visible(t)) continue;
      if (filter.entityId && t.entityId !== filter.entityId) continue;
      if (filter.regionSlugs && !filter.regionSlugs.includes(t.regionSlug)) continue;
      const entity = this.ref(t.entityId);
      if (!entity) continue;
      out.push({ ...t, entity, region: this.regions.get(t.regionSlug) ?? null, sources: this.resolveSources(t.citations) });
    }
    return out;
  }

  async listStudies(filter: StudyFilter) {
    const q = filter.q ? normalize(filter.q) : null;
    return this.data.studies
      .filter(visible)
      .filter((s) => !filter.entityIds || s.entityIds.some((id) => filter.entityIds!.includes(id)))
      .filter((s) => !filter.conditionIds || s.conditionIds.some((id) => filter.conditionIds!.includes(id)))
      .filter((s) => !filter.types || filter.types.includes(s.type))
      .filter((s) => !filter.yearFrom || s.year >= filter.yearFrom)
      .filter((s) => !filter.yearTo || s.year <= filter.yearTo)
      .filter((s) => !filter.country || s.country === filter.country)
      .filter((s) => !q || normalize(s.title).includes(q))
      .sort((a, b) => b.year - a.year)
      .slice(0, filter.limit ?? 100);
  }

  async listRegions(filter: { parentSlug?: string; level?: Region['level'] } = {}) {
    return this.data.regions.filter(
      (r) => (filter.parentSlug === undefined || r.parentSlug === filter.parentSlug) && (!filter.level || r.level === filter.level),
    );
  }

  async getRegion(slug: string) {
    return this.regions.get(slug) ?? null;
  }

  async listSources() {
    return this.data.sources;
  }

  async reviewQueue(): Promise<ReviewItem[]> {
    const name = (id: string) => this.byId.get(id)?.name.es ?? id;
    const items: ReviewItem[] = [];
    for (const c of this.data.claims)
      items.push({
        table: 'evidence_claims',
        id: c.id,
        title: `${name(c.subjectId)} → ${c.conditionId ? name(c.conditionId) : '—'} (${c.context}, nivel ${c.level})`,
        subtitle: c.statement.es,
        status: c.reviewStatus,
        updatedAt: c.updatedAt,
        sourceCount: c.citations.length,
      });
    for (const i of this.data.interactions)
      items.push({
        table: 'interactions',
        id: i.id,
        title: `${name(i.agentId)} × ${name(i.medicationId)} (${i.kind})`,
        subtitle: i.effect.es,
        status: i.reviewStatus,
        updatedAt: i.updatedAt,
        sourceCount: i.citations.length,
      });
    for (const t of this.data.traditionalUses)
      items.push({
        table: 'traditional_knowledge',
        id: t.id,
        title: `${name(t.entityId)} — uso tradicional (${t.regionSlug})`,
        subtitle: t.use.es,
        status: t.reviewStatus,
        updatedAt: t.updatedAt,
        sourceCount: t.citations.length,
      });
    return items.filter((i) => i.status === 'pending_review');
  }

  async stats(): Promise<KnowledgeStats> {
    const entities = Object.fromEntries(ENTITY_TYPES.map((t) => [t, 0])) as KnowledgeStats['entities'];
    const byStatus = Object.fromEntries(REVIEW_STATUSES.map((s) => [s, 0])) as KnowledgeStats['byStatus'];
    for (const e of this.data.entities) entities[e.type]++;
    for (const x of [...this.data.entities, ...this.data.claims, ...this.data.interactions, ...this.data.traditionalUses]) byStatus[x.reviewStatus]++;
    return {
      entities,
      claims: this.data.claims.length,
      interactions: this.data.interactions.length,
      traditionalUses: this.data.traditionalUses.length,
      studies: this.data.studies.length,
      sources: this.data.sources.length,
      byStatus,
    };
  }
}
