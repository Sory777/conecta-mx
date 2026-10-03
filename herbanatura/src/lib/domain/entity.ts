import type { EntitySummary } from '@/lib/data/repository';
import type { Entity, EntityRef } from './types';

export function scientificName(e: Entity): string | null {
  switch (e.type) {
    case 'plant':
      return e.plant.scientificName;
    case 'mushroom':
      return e.mushroom.scientificName;
    case 'food':
      return e.food.scientificName ?? null;
    default:
      return null;
  }
}

export function toRef(e: Entity): EntityRef {
  return { id: e.id, type: e.type, slug: e.slug, name: e.name, scientificName: scientificName(e), reviewStatus: e.reviewStatus };
}

export function toSummary(e: Entity): EntitySummary {
  let family: string | null = null;
  let hint: string | null = null;
  switch (e.type) {
    case 'plant':
      family = e.plant.family;
      break;
    case 'mushroom':
      family = e.mushroom.family;
      hint = e.mushroom.edibility;
      break;
    case 'food':
      family = e.food.family ?? null;
      hint = e.food.foodGroup;
      break;
    case 'compound':
      hint = e.compound.formula ?? e.compound.compoundClass.join(', ');
      break;
    case 'condition':
      hint = e.condition.kind;
      break;
    case 'medication':
      hint = e.medication.drugClass.es;
      break;
  }
  return {
    ...toRef(e),
    summary: e.summary ?? null,
    tags: e.tags,
    family,
    hint,
    regions: e.regions,
    parentSlug: e.type === 'condition' ? (e.condition.parentSlug ?? null) : null,
  };
}

