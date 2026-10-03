import type { EntityRelation, RelationPredicate } from '@/lib/domain/types';
import { cite, L } from './helpers';

/** Graph edges. Entity ids follow `${type}:${slug}`. */
const r = (
  subject: string,
  predicate: RelationPredicate,
  object: string,
  sources: string[] = [],
  note?: EntityRelation['note'],
): EntityRelation => ({
  id: `rel:${subject}>${predicate}>${object}`,
  subjectId: subject,
  predicate,
  objectId: object,
  note: note ?? null,
  citations: sources.map((s) => cite(s)),
  reviewStatus: 'pending_review',
});

export const RELATIONS: EntityRelation[] = [
  // plant → compound
  r('plant:curcuma', 'contains', 'compound:curcumina', ['nccih-turmeric']),
  r('plant:te-verde', 'contains', 'compound:egcg', ['nccih-green-tea']),
  r('plant:te-verde', 'contains', 'compound:cafeina', ['nccih-green-tea']),
  r('plant:jengibre', 'contains', 'compound:gingerol'),
  r('plant:ajo', 'contains', 'compound:alicina'),
  r('plant:menta', 'contains', 'compound:mentol'),
  r('plant:romero', 'contains', 'compound:acido-carnosico'),
  r('plant:romero', 'contains', 'compound:acido-rosmarinico'),
  r('plant:ginseng', 'contains', 'compound:ginsenosidos', ['nccih-asian-ginseng']),
  r('plant:cannabis', 'contains', 'compound:thc', ['nci-cannabis-pdq']),
  r('plant:cannabis', 'contains', 'compound:cbd', ['nccih-cannabis']),
  r('plant:hiperico', 'contains', 'compound:hiperforina'),
  r('plant:boswellia', 'contains', 'compound:acidos-boswelicos'),
  r('plant:hidrastis', 'contains', 'compound:berberina', ['nccih-goldenseal']),
  r('plant:manzanilla', 'contains', 'compound:apigenina'),
  // food → compound
  r('food:brocoli', 'contains', 'compound:glucorafanina', ['nci-cruciferous']),
  r('compound:glucorafanina', 'source_of', 'compound:sulforafano', ['nci-cruciferous'], L('La enzima mirosinasa convierte la glucorafanina en sulforafano.', 'The enzyme myrosinase converts glucoraphanin into sulforaphane.')),
  r('food:brocoli', 'contains', 'compound:sulforafano', ['nci-cruciferous'], L('Formado a partir de la glucorafanina al cortar o masticar.', 'Formed from glucoraphanin when cut or chewed.')),
  r('food:tomate', 'contains', 'compound:licopeno'),
  r('food:uva', 'contains', 'compound:resveratrol'),
  r('food:soya', 'contains', 'compound:genisteina'),
  r('food:cebolla', 'contains', 'compound:quercetina'),
  r('food:chile', 'contains', 'compound:capsaicina'),
  r('food:perejil', 'contains', 'compound:apigenina'),
  // mushroom → compound
  r('mushroom:cola-de-pavo', 'contains', 'compound:psk', ['nci-mushrooms-pdq']),
  r('mushroom:shiitake', 'contains', 'compound:lentinano', ['nci-mushrooms-pdq']),
  // other
  r('compound:thc', 'related_to', 'compound:cbd'),
];
