import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Entity, EntityDetail, EntityRef, EntityType, Region, ResolvedClaim, ResolvedInteraction, ResolvedRelation, Source, Study } from '@/lib/domain/types';
import { anonClient } from '@/lib/supabase/clients';
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

/**
 * PostgreSQL-backed repository. Every read goes through an `api_*` SQL function
 * that returns the domain JSON shape, so this class is a thin, typed adapter.
 */
export class SupabaseRepository implements KnowledgeRepository {
  readonly mode = 'supabase' as const;

  constructor(private client: SupabaseClient = anonClient()) {}

  private async rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
    const { data, error } = await this.client.rpc(fn, args);
    if (error) throw new Error(`${fn}: ${error.message}`);
    return data as T;
  }

  async getLexicon(): Promise<LexiconEntry[]> {
    const rows: LexiconEntry[] = [];
    const page = 1000;
    for (let from = 0; ; from += page) {
      const { data, error } = await this.client.rpc('api_lexicon').range(from, from + page - 1);
      if (error) throw new Error(`api_lexicon: ${error.message}`);
      for (const r of data as { entity_id: string; type: EntityType; slug: string; name: Entity['name']; term: string; kind: LexiconEntry['kind'] }[])
        rows.push({ entityId: r.entity_id, type: r.type, slug: r.slug, name: r.name, term: r.term, kind: r.kind });
      if (!data || data.length < page) break;
    }
    return rows;
  }

  getEntityRefs(ids: string[]) {
    return this.rpc<EntityRef[]>('api_entity_refs', { p_ids: ids });
  }

  getEntity(slug: string) {
    return this.rpc<Entity | null>('api_entity', { p_slug: slug });
  }

  getEntityDetail(slug: string) {
    return this.rpc<EntityDetail | null>('api_entity_detail', { p_slug: slug });
  }

  listEntities(f: EntityListFilter) {
    return this.rpc<{ items: EntitySummary[]; total: number }>('api_list_entities', {
      p_type: f.type ?? null,
      p_tag: f.tag ?? null,
      p_region: f.region ?? null,
      p_limit: f.limit ?? 200,
      p_offset: f.offset ?? 0,
    });
  }

  fullTextSearch(q: string, opts: { types?: EntityType[]; limit?: number } = {}) {
    return this.rpc<EntitySummary[]>('api_full_text_search', { p_q: q, p_types: opts.types ?? null, p_limit: opts.limit ?? 20 });
  }

  listClaims(f: ClaimFilter) {
    return this.rpc<ResolvedClaim[]>('api_list_claims', {
      p_subject_ids: f.subjectIds ?? null,
      p_condition_ids: f.conditionIds ?? null,
      p_contexts: f.contexts ?? null,
      p_cancer_only: f.cancerOnly ?? false,
      p_subject_types: f.subjectTypes ?? null,
    });
  }

  listInteractions(f: InteractionFilter) {
    return this.rpc<ResolvedInteraction[]>('api_list_interactions', { p_medication_id: f.medicationId ?? null, p_agent_ids: f.agentIds ?? null });
  }

  listRelations(ids: string[]) {
    return this.rpc<ResolvedRelation[]>('api_list_relations', { p_ids: ids });
  }

  listTraditionalUses(f: { regionSlugs?: string[]; entityId?: string }) {
    return this.rpc<TraditionalUseResolved[]>('api_traditional_uses', { p_region_slugs: f.regionSlugs ?? null, p_entity_id: f.entityId ?? null });
  }

  listStudies(f: StudyFilter) {
    return this.rpc<Study[]>('api_list_studies', {
      p_entity_ids: f.entityIds ?? null,
      p_condition_ids: f.conditionIds ?? null,
      p_types: f.types ?? null,
      p_year_from: f.yearFrom ?? null,
      p_year_to: f.yearTo ?? null,
      p_country: f.country ?? null,
      p_q: f.q ?? null,
      p_limit: f.limit ?? 100,
    });
  }

  listRegions(f: { parentSlug?: string; level?: Region['level'] } = {}) {
    return this.rpc<Region[]>('api_regions', { p_parent_slug: f.parentSlug ?? null, p_level: f.level ?? null });
  }

  async getRegion(slug: string) {
    const all = await this.rpc<Region[]>('api_regions', {});
    return all.find((r) => r.slug === slug) ?? null;
  }

  listSources() {
    return this.rpc<Source[]>('api_sources');
  }

  reviewQueue() {
    return this.rpc<ReviewItem[]>('api_review_queue');
  }

  stats() {
    return this.rpc<KnowledgeStats>('api_stats');
  }
}
