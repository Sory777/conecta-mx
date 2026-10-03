/**
 * Domain model shared by every layer (seed data, SQL API functions, UI, AI).
 * The SQL `api_*` functions return JSON in exactly these shapes (camelCase).
 */

export const LOCALES = ['es', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

/** Localized text. Spanish is mandatory; other languages are optional and fall back to Spanish. */
export type LocalizedText = { es: string } & Partial<Record<Exclude<Locale, 'es'>, string>>;

export const ENTITY_TYPES = ['plant', 'mushroom', 'food', 'compound', 'condition', 'medication'] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

/** Entity types that can act on the body (subject of claims and interactions). */
export const AGENT_TYPES = ['plant', 'mushroom', 'food', 'compound'] as const;
export type AgentType = (typeof AGENT_TYPES)[number];

export const REVIEW_STATUSES = ['pending_review', 'reviewed', 'rejected', 'insufficient_info'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const EVIDENCE_LEVELS = ['A', 'B', 'C', 'D', 'E', 'F', 'X'] as const;
export type EvidenceLevel = (typeof EVIDENCE_LEVELS)[number];

export const EVIDENCE_CATEGORIES = [
  'clinical_strong',
  'clinical_limited',
  'preliminary',
  'observational',
  'preclinical',
  'in_vitro',
  'animal',
  'insufficient',
  'negative',
] as const;
export type EvidenceCategory = (typeof EVIDENCE_CATEGORIES)[number];

export const CLAIM_CONTEXTS = ['general', 'prevention', 'research', 'complementary', 'cancer_treatment', 'safety'] as const;
export type ClaimContext = (typeof CLAIM_CONTEXTS)[number];

export const STUDY_TYPES = [
  'in_vitro',
  'animal',
  'case_report',
  'observational',
  'cohort',
  'case_control',
  'non_randomized_trial',
  'rct',
  'systematic_review',
  'meta_analysis',
  'narrative_review',
  'guideline',
  'regulatory_evaluation',
] as const;
export type StudyType = (typeof STUDY_TYPES)[number];

export const SOURCE_KINDS = ['government', 'journal', 'database', 'academic', 'ethnobotanical', 'book', 'other'] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

export const INTERACTION_KINDS = ['documented', 'possible', 'theoretical', 'insufficient'] as const;
export type InteractionKind = (typeof INTERACTION_KINDS)[number];

export const SEVERITIES = ['major', 'moderate', 'minor', 'not_graded'] as const;
export type Severity = (typeof SEVERITIES)[number];

export const SAFETY_TOPICS = [
  'toxicity',
  'overdose',
  'side_effects',
  'allergies',
  'contraindications',
  'pregnancy',
  'lactation',
  'children',
  'elderly',
  'liver',
  'kidney',
  'surgery',
] as const;
export type SafetyTopic = (typeof SAFETY_TOPICS)[number];

export const SAFETY_STATUSES = ['documented_risk', 'caution', 'no_known_risk', 'insufficient', 'pending'] as const;
export type SafetyStatus = (typeof SAFETY_STATUSES)[number];

export const MUSHROOM_EDIBILITY = ['medicinal', 'edible', 'toxic', 'deadly', 'unknown'] as const;
export type MushroomEdibility = (typeof MUSHROOM_EDIBILITY)[number];

export const CONDITION_KINDS = ['disease', 'symptom', 'cancer', 'risk_factor'] as const;
export type ConditionKind = (typeof CONDITION_KINDS)[number];

export const RELATION_PREDICATES = ['contains', 'source_of', 'derived_from', 'lookalike_of', 'related_to', 'part_of'] as const;
export type RelationPredicate = (typeof RELATION_PREDICATES)[number];

export const REGION_LEVELS = ['macro_region', 'country', 'state', 'municipality', 'cultural'] as const;
export type RegionLevel = (typeof REGION_LEVELS)[number];

/* ------------------------------------------------------------------ sources */

export interface Source {
  id: string;
  kind: SourceKind;
  title: string;
  publisher: string;
  url: string;
  doi?: string | null;
  pmid?: string | null;
  language: string;
  /** Date the source was added to the catalogue (ISO date). */
  addedAt: string;
  /** Date a human last verified the source content (null = pending). */
  reviewedAt?: string | null;
  notes?: LocalizedText | null;
}

export interface Citation {
  sourceId: string;
  /** Where in the source, e.g. "Sección: ¿Qué tan seguro es?" */
  locator?: string | null;
}

export interface ReviewMeta {
  reviewStatus: ReviewStatus;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  updatedAt: string;
}

/* ----------------------------------------------------------------- entities */

export interface Alias {
  name: string;
  /** BCP-47 language code or 'la' for scientific names. */
  lang: string;
  kind: 'common' | 'regional' | 'scientific_synonym' | 'brand' | 'abbreviation' | 'misspelling';
  /** Region slug when the name is regional. */
  region?: string | null;
}

export interface SafetyNote {
  topic: SafetyTopic;
  status: SafetyStatus;
  text: LocalizedText;
  citations: Citation[];
  reviewStatus: ReviewStatus;
}

export interface Preparation {
  name: LocalizedText;
  description: LocalizedText;
  /** 'traditional' preparations are descriptive only; never a dosage recommendation. */
  context: 'traditional' | 'studied_in_research' | 'commercial';
  citations: Citation[];
}

export interface ImageRef {
  url: string;
  thumbUrl?: string | null;
  author: string;
  license: string;
  sourceUrl: string;
  caption?: LocalizedText | null;
  /** Botanical identity of the photo verified by a person. */
  verified: boolean;
}

interface EntityCommon extends ReviewMeta {
  id: string;
  type: EntityType;
  slug: string;
  name: LocalizedText;
  aliases: Alias[];
  summary?: LocalizedText | null;
  /** “Explícamelo fácil” version of the summary. */
  simpleSummary?: LocalizedText | null;
  tags: string[];
  citations: Citation[];
  safety: SafetyNote[];
  images: ImageRef[];
  /** Region slugs where the entity is documented (distribution or traditional use). */
  regions: string[];
}

export interface PlantDetails {
  scientificName: string;
  family: string;
  synonyms: string[];
  botanicalDescription?: LocalizedText | null;
  distribution?: LocalizedText | null;
  partsUsed: string[];
  preparations: Preparation[];
  legalNotes?: LocalizedText | null;
  /** Taxonomic ambiguity warning, e.g. one common name used for several species. */
  nameAmbiguity?: LocalizedText | null;
}

export interface MushroomDetails {
  scientificName: string;
  family: string;
  synonyms: string[];
  edibility: MushroomEdibility;
  description?: LocalizedText | null;
  distribution?: LocalizedText | null;
}

export interface FoodDetails {
  scientificName?: string | null;
  family?: string | null;
  foodGroup: string;
  nutrients: { name: LocalizedText; note?: LocalizedText | null; citations: Citation[] }[];
}

export interface CompoundDetails {
  formula?: string | null;
  compoundClass: string[];
  pubchemQuery: string;
  bioavailability?: LocalizedText | null;
  mechanismsInvestigated: { text: LocalizedText; studyTypes: StudyType[]; citations: Citation[] }[];
}

export interface ConditionDetails {
  kind: ConditionKind;
  isCancer: boolean;
  icd10?: string | null;
  parentSlug?: string | null;
}

export interface MedicationDetails {
  drugClass: LocalizedText;
  atcCode?: string | null;
  categories: MedicationCategory[];
}

export const MEDICATION_CATEGORIES = [
  'anticoagulant',
  'antiplatelet',
  'oncology',
  'cardiovascular',
  'psychiatric',
  'immunosuppressant',
  'hormonal',
  'antiretroviral',
  'antidiabetic',
] as const;
export type MedicationCategory = (typeof MEDICATION_CATEGORIES)[number];

export type Entity =
  | (EntityCommon & { type: 'plant'; plant: PlantDetails })
  | (EntityCommon & { type: 'mushroom'; mushroom: MushroomDetails })
  | (EntityCommon & { type: 'food'; food: FoodDetails })
  | (EntityCommon & { type: 'compound'; compound: CompoundDetails })
  | (EntityCommon & { type: 'condition'; condition: ConditionDetails })
  | (EntityCommon & { type: 'medication'; medication: MedicationDetails });

/** Lightweight reference used in lists, relations and search. */
export interface EntityRef {
  id: string;
  type: EntityType;
  slug: string;
  name: LocalizedText;
  scientificName?: string | null;
  reviewStatus: ReviewStatus;
}

/* --------------------------------------------------------- graph & evidence */

export interface EntityRelation {
  id: string;
  subjectId: string;
  predicate: RelationPredicate;
  objectId: string;
  note?: LocalizedText | null;
  citations: Citation[];
  reviewStatus: ReviewStatus;
}

export interface EvidenceClaim extends ReviewMeta {
  id: string;
  subjectId: string;
  conditionId?: string | null;
  context: ClaimContext;
  level: EvidenceLevel;
  category: EvidenceCategory;
  studyTypes: StudyType[];
  /** True only when at least one human study supports the statement. */
  humanEvidence: boolean;
  statement: LocalizedText;
  simple: LocalizedText;
  whatWeKnow: LocalizedText[];
  whatWeDontKnow: LocalizedText[];
  underInvestigation: LocalizedText[];
  risks: LocalizedText[];
  limitations: LocalizedText[];
  /** Doses used in research (researcher mode only; never a recommendation). */
  researchDoses?: LocalizedText | null;
  studyIds: string[];
  citations: Citation[];
}

export interface Interaction extends ReviewMeta {
  id: string;
  agentId: string;
  medicationId: string;
  kind: InteractionKind;
  severity: Severity;
  effect: LocalizedText;
  mechanism?: LocalizedText | null;
  level: EvidenceLevel;
  citations: Citation[];
}

export interface TraditionalUse extends ReviewMeta {
  id: string;
  entityId: string;
  regionSlug: string;
  culture?: string | null;
  use: LocalizedText;
  preparation?: LocalizedText | null;
  partUsed?: string | null;
  documentation: 'documented' | 'pending_verification';
  citations: Citation[];
}

export interface Study extends ReviewMeta {
  id: string;
  title: string;
  authors: string[];
  year: number;
  journal?: string | null;
  type: StudyType;
  population?: string | null;
  sampleSize?: number | null;
  intervention?: string | null;
  comparator?: string | null;
  outcome?: LocalizedText | null;
  result: 'positive' | 'negative' | 'mixed' | 'null' | 'unclear';
  limitations?: LocalizedText | null;
  country?: string | null;
  doi?: string | null;
  pmid?: string | null;
  nctId?: string | null;
  url: string;
  entityIds: string[];
  conditionIds: string[];
}

export interface Region {
  slug: string;
  name: LocalizedText;
  level: RegionLevel;
  parentSlug?: string | null;
  code?: string | null;
}

/* ------------------------------------------------------------- aggregates */

export interface ResolvedClaim extends EvidenceClaim {
  subject: EntityRef;
  condition?: EntityRef | null;
  sources: Source[];
}

export interface ResolvedInteraction extends Interaction {
  agent: EntityRef;
  medication: EntityRef;
  sources: Source[];
}

export interface ResolvedRelation extends EntityRelation {
  subject: EntityRef;
  object: EntityRef;
}

export interface EntityDetail {
  entity: Entity;
  relations: ResolvedRelation[];
  claims: ResolvedClaim[];
  interactions: ResolvedInteraction[];
  traditionalUses: (TraditionalUse & { region: Region | null; sources: Source[] })[];
  studies: Study[];
  /** Every source cited anywhere in the detail, de-duplicated. */
  sources: Source[];
}
