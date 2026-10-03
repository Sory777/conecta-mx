import type {
  ClaimContext,
  Entity,
  EntityDetail,
  EntityRef,
  EntityType,
  LocalizedText,
  Region,
  RegionLevel,
  ResolvedClaim,
  ResolvedInteraction,
  ResolvedRelation,
  ReviewStatus,
  Source,
  Study,
  StudyType,
  TraditionalUse,
} from '@/lib/domain/types';

export interface EntitySummary extends EntityRef {
  summary?: LocalizedText | null;
  tags: string[];
  family?: string | null;
  /** Type-specific hint: formula, edibility, drug class, condition kind… */
  hint?: string | null;
  regions: string[];
  /** Conditions only: parent condition slug (hierarchy). */
  parentSlug?: string | null;
}

export interface LexiconEntry {
  entityId: string;
  type: EntityType;
  slug: string;
  name: LocalizedText;
  /** Original form of the matched term (name, alias or scientific name). */
  term: string;
  kind: 'name' | 'alias' | 'scientific';
}

export interface EntityListFilter {
  type?: EntityType;
  tag?: string;
  region?: string;
  limit?: number;
  offset?: number;
}

export interface ClaimFilter {
  subjectIds?: string[];
  conditionIds?: string[];
  contexts?: ClaimContext[];
  /** Only claims whose condition is a cancer (or a child of “cancer”). */
  cancerOnly?: boolean;
  subjectTypes?: EntityType[];
}

export interface InteractionFilter {
  medicationId?: string;
  agentIds?: string[];
}

export interface StudyFilter {
  entityIds?: string[];
  conditionIds?: string[];
  types?: StudyType[];
  yearFrom?: number;
  yearTo?: number;
  country?: string;
  q?: string;
  limit?: number;
}

export interface ReviewItem {
  table: 'evidence_claims' | 'interactions' | 'traditional_knowledge' | 'entity_relations' | 'safety_warnings' | 'entities' | 'study_candidates' | 'ai_drafts';
  id: string;
  title: string;
  subtitle?: string;
  status: ReviewStatus;
  updatedAt: string;
  sourceCount: number;
  href?: string;
}

export interface KnowledgeStats {
  entities: Record<EntityType, number>;
  claims: number;
  interactions: number;
  traditionalUses: number;
  studies: number;
  sources: number;
  byStatus: Record<ReviewStatus, number>;
}

export type TraditionalUseResolved = TraditionalUse & { entity: EntityRef; region: Region | null; sources: Source[] };

/**
 * Single read interface for the whole app. Two implementations:
 *  - SeedRepository: in-memory demo dataset (no database needed)
 *  - SupabaseRepository: PostgreSQL via `api_*` SQL functions (RLS applies)
 */
export interface KnowledgeRepository {
  readonly mode: 'seed' | 'supabase';
  getLexicon(): Promise<LexiconEntry[]>;
  getEntityRefs(ids: string[]): Promise<EntityRef[]>;
  getEntity(slug: string): Promise<Entity | null>;
  getEntityDetail(slug: string): Promise<EntityDetail | null>;
  listEntities(filter: EntityListFilter): Promise<{ items: EntitySummary[]; total: number }>;
  fullTextSearch(q: string, opts?: { types?: EntityType[]; limit?: number }): Promise<EntitySummary[]>;
  listClaims(filter: ClaimFilter): Promise<ResolvedClaim[]>;
  listInteractions(filter: InteractionFilter): Promise<ResolvedInteraction[]>;
  listRelations(entityIds: string[]): Promise<ResolvedRelation[]>;
  listTraditionalUses(filter: { regionSlugs?: string[]; entityId?: string }): Promise<TraditionalUseResolved[]>;
  listStudies(filter: StudyFilter): Promise<Study[]>;
  listRegions(filter?: { parentSlug?: string; level?: RegionLevel }): Promise<Region[]>;
  getRegion(slug: string): Promise<Region | null>;
  listSources(): Promise<Source[]>;
  reviewQueue(): Promise<ReviewItem[]>;
  stats(): Promise<KnowledgeStats>;
}
