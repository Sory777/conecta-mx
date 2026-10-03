import type {
  Alias,
  Citation,
  CompoundDetails,
  ConditionDetails,
  Entity,
  FoodDetails,
  LocalizedText,
  MedicationDetails,
  MushroomDetails,
  PlantDetails,
  SafetyNote,
  SafetyStatus,
  SafetyTopic,
} from '@/lib/domain/types';
import { L, SEED_DATE } from './helpers';

type Common = {
  slug: string;
  name: LocalizedText;
  aliases?: (string | Alias)[];
  summary?: LocalizedText;
  simpleSummary?: LocalizedText;
  tags?: string[];
  citations?: Citation[];
  safety?: SafetyNote[];
  regions?: string[];
};

const alias = (a: string | Alias): Alias => (typeof a === 'string' ? { name: a, lang: 'es', kind: 'common' } : a);

export const en = (name: string): Alias => ({ name, lang: 'en', kind: 'common' });
export const syn = (name: string): Alias => ({ name, lang: 'la', kind: 'scientific_synonym' });
export const regional = (name: string, region: string): Alias => ({ name, lang: 'es', kind: 'regional', region });
export const abbr = (name: string): Alias => ({ name, lang: 'en', kind: 'abbreviation' });

export const safety = (
  topic: SafetyTopic,
  status: SafetyStatus,
  text: LocalizedText,
  citations: Citation[] = [],
): SafetyNote => ({ topic, status, text, citations, reviewStatus: 'pending_review' });

const base = (type: Entity['type'], c: Common) => ({
  id: `${type}:${c.slug}`,
  type,
  slug: c.slug,
  name: c.name,
  aliases: (c.aliases ?? []).map(alias),
  summary: c.summary ?? null,
  simpleSummary: c.simpleSummary ?? null,
  tags: c.tags ?? [],
  citations: c.citations ?? [],
  safety: c.safety ?? [],
  images: [],
  regions: c.regions ?? [],
  reviewStatus: 'pending_review' as const,
  reviewedAt: null,
  reviewedBy: null,
  updatedAt: SEED_DATE,
});

export const plant = (c: Common & Partial<PlantDetails> & Pick<PlantDetails, 'scientificName' | 'family'>): Entity => ({
  ...base('plant', c),
  type: 'plant',
  plant: {
    scientificName: c.scientificName,
    family: c.family,
    synonyms: c.synonyms ?? [],
    botanicalDescription: c.botanicalDescription ?? null,
    distribution: c.distribution ?? null,
    partsUsed: c.partsUsed ?? [],
    preparations: c.preparations ?? [],
    legalNotes: c.legalNotes ?? null,
    nameAmbiguity: c.nameAmbiguity ?? null,
  },
});

export const mushroom = (
  c: Common & Partial<MushroomDetails> & Pick<MushroomDetails, 'scientificName' | 'family' | 'edibility'>,
): Entity => ({
  ...base('mushroom', c),
  type: 'mushroom',
  mushroom: {
    scientificName: c.scientificName,
    family: c.family,
    synonyms: c.synonyms ?? [],
    edibility: c.edibility,
    description: c.description ?? null,
    distribution: c.distribution ?? null,
  },
});

export const food = (c: Common & Partial<FoodDetails> & Pick<FoodDetails, 'foodGroup'>): Entity => ({
  ...base('food', c),
  type: 'food',
  food: {
    scientificName: c.scientificName ?? null,
    family: c.family ?? null,
    foodGroup: c.foodGroup,
    nutrients: c.nutrients ?? [],
  },
});

export const compound = (c: Common & Partial<CompoundDetails> & Pick<CompoundDetails, 'compoundClass'>): Entity => ({
  ...base('compound', c),
  type: 'compound',
  compound: {
    formula: c.formula ?? null,
    compoundClass: c.compoundClass,
    pubchemQuery: c.pubchemQuery ?? (c.name.en ?? c.name.es),
    bioavailability: c.bioavailability ?? null,
    mechanismsInvestigated: c.mechanismsInvestigated ?? [],
  },
});

export const condition = (c: Common & Partial<ConditionDetails> & Pick<ConditionDetails, 'kind'>): Entity => ({
  ...base('condition', c),
  type: 'condition',
  condition: {
    kind: c.kind,
    isCancer: c.isCancer ?? c.kind === 'cancer',
    icd10: c.icd10 ?? null,
    parentSlug: c.parentSlug ?? null,
  },
});

export const medication = (c: Common & MedicationDetails): Entity => ({
  ...base('medication', c),
  type: 'medication',
  medication: { drugClass: c.drugClass, atcCode: c.atcCode ?? null, categories: c.categories },
});

export { L };
