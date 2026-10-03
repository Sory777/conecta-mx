import type { Entity, EntityRelation, EvidenceClaim, Interaction, Region, Source, Study, TraditionalUse } from '@/lib/domain/types';
import { CLAIMS } from './claims';
import { INTERACTIONS } from './interactions';
import { COMPOUNDS, CONDITIONS, FOODS, MEDICATIONS, MUSHROOMS } from './others';
import { PLANTS } from './plants';
import { REGIONS } from './regions';
import { RELATIONS } from './relations';
import { SOURCES } from './sources';
import { TRADITIONAL_USES } from './traditional';

export interface Dataset {
  entities: Entity[];
  relations: EntityRelation[];
  claims: EvidenceClaim[];
  interactions: Interaction[];
  traditionalUses: TraditionalUse[];
  /** Intentionally empty: studies are imported from PubMed/ClinicalTrials.gov, never hand-written. */
  studies: Study[];
  sources: Source[];
  regions: Region[];
}

export const SEED: Dataset = {
  entities: [...PLANTS, ...MUSHROOMS, ...FOODS, ...COMPOUNDS, ...CONDITIONS, ...MEDICATIONS],
  relations: RELATIONS,
  claims: CLAIMS,
  interactions: INTERACTIONS,
  traditionalUses: TRADITIONAL_USES,
  studies: [],
  sources: SOURCES,
  regions: REGIONS,
};
