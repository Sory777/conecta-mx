import type { LocalizedText, TraditionalUse } from '@/lib/domain/types';
import { cite, L, PENDING, SEED_DATE } from './helpers';

const tu = (
  id: string,
  entity: string,
  regionSlug: string,
  use: LocalizedText,
  sources: string[],
  documentation: TraditionalUse['documentation'],
  extra: Partial<Pick<TraditionalUse, 'culture' | 'preparation' | 'partUsed'>> = {},
): TraditionalUse => ({
  id: `tu:${id}`,
  entityId: entity,
  regionSlug,
  culture: extra.culture ?? null,
  use,
  preparation: extra.preparation ?? null,
  partUsed: extra.partUsed ?? null,
  documentation,
  citations: sources.map((s) => cite(s)),
  reviewStatus: 'pending_review',
  reviewedAt: null,
  reviewedBy: null,
  updatedAt: SEED_DATE,
});

/**
 * “Documented” here means the cited institutional source states the
 * traditional use. It never implies efficacy. Mexican records point to the
 * UNAM digital library and remain `pending_verification` until a reviewer
 * links the specific monograph.
 */
export const TRADITIONAL_USES: TraditionalUse[] = [
  tu('curcuma-ayurveda', 'plant:curcuma', 'ayurveda', L('Usada en la medicina ayurvédica y otros sistemas tradicionales de Asia.', 'Used in Ayurvedic medicine and other traditional systems in Asia.'), ['nccih-turmeric'], 'documented', { culture: 'Ayurveda', partUsed: 'rizoma' }),
  tu('ginseng-mtc', 'plant:ginseng', 'medicina-tradicional-china', L('Usado en la medicina tradicional china y coreana.', 'Used in traditional Chinese and Korean medicine.'), ['nccih-asian-ginseng'], 'documented', { culture: 'Medicina tradicional china', partUsed: 'raíz' }),
  tu('reishi-mtc', 'mushroom:reishi', 'medicina-tradicional-china', L('Usado en la medicina tradicional china.', 'Used in traditional Chinese medicine.'), ['nci-mushrooms-pdq'], 'documented', { culture: 'Medicina tradicional china' }),
  tu('valeriana-grecorromana', 'plant:valeriana', 'grecorromana', L('Usada desde la antigua Grecia y Roma, incluido para problemas de sueño.', 'Used since ancient Greece and Rome, including for sleep problems.'), ['nccih-valerian'], 'documented', { partUsed: 'raíz' }),
  tu('equinacea-pueblos', 'plant:equinacea', 'pueblos-indigenas', L('Usada tradicionalmente por pueblos originarios de Norteamérica.', 'Traditionally used by Native peoples of North America.'), ['nccih-echinacea'], 'documented', { culture: 'Pueblos originarios de las Grandes Llanuras' }),
  tu('manzanilla-europa', 'plant:manzanilla', 'europa', L('Usada durante siglos como planta medicinal, sobre todo para molestias digestivas.', 'Used for centuries as a medicinal plant, mostly for digestive complaints.'), ['nccih-chamomile'], 'documented', { preparation: L('Infusión de las flores.', 'Flower tea.'), partUsed: 'cabezuelas florales' }),
  tu('jengibre-asia', 'plant:jengibre', 'asia', L('Usado en tradiciones medicinales de Asia.', 'Used in Asian medical traditions.'), ['nccih-ginger'], 'documented', { partUsed: 'rizoma' }),
  // México — pendientes de verificación con la monografía de la BDMTM (UNAM)
  ...[
    'arnica-mexicana',
    'estafiate',
    'epazote',
    'cuachalalate',
    'muicle',
    'damiana',
    'gordolobo',
    'toronjil-morado',
    'gobernadora',
    'ruda',
    'tepezcohuite',
    'zapote-blanco',
  ].map((slug) => tu(`${slug}-mexico`, `plant:${slug}`, 'mexico', PENDING, ['bdmtm-unam'], 'pending_verification')),
];

