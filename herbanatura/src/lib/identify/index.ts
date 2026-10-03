import 'server-only';
import { z } from 'zod/v4';
import type { EntityRef, Locale } from '@/lib/domain/types';
import type { KnowledgeRepository } from '@/lib/data/repository';
import { serverEnv } from '@/lib/env';
import { normalize } from '@/lib/search/normalize';
import { structuredCall } from '@/lib/ai/anthropic';

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Likelihood labels deliberately stop short of certainty. */
export type Likelihood = 'possible' | 'less_likely';

export interface IdentifyCandidate {
  scientificName: string;
  commonNames: string[];
  likelihood: Likelihood;
  supportingFeatures: string[];
  howToConfirm: string[];
  entity: EntityRef | null;
  toxicInDatabase: boolean;
}

export interface IdentifyResult {
  provider: 'anthropic' | 'plantnet';
  isPlantOrFungus: boolean;
  imageQuality: string;
  observedFeatures: string[];
  candidates: IdentifyCandidate[];
  toxicLookalikes: { scientificName: string; reason: string }[];
  mushroomInvolved: boolean;
}

const VisionSchema = z.object({
  is_plant_or_fungus: z.boolean(),
  image_quality: z.string().describe('Short note on lighting, focus and which organs are visible.'),
  observed_features: z.array(z.string()).describe('Leaf shape, margin, venation, flower, fruit, stem, habit… only what is visible.'),
  candidates: z
    .array(
      z.object({
        scientific_name: z.string(),
        common_names: z.array(z.string()),
        likelihood: z.enum(['possible', 'less_likely']),
        supporting_features: z.array(z.string()),
        how_to_confirm: z.array(z.string()).describe('Features or checks a person should verify in the field.'),
      }),
    )
    .max(5),
  toxic_lookalikes: z.array(z.object({ scientific_name: z.string(), reason: z.string() })).describe('Toxic species that could be confused with the candidates.'),
});

const VISION_PROMPT = `You assist with PRELIMINARY plant and fungus identification from a single photo for an educational encyclopedia.
Rules:
- Describe only features actually visible (leaf shape, margin, venation, arrangement, flower, fruit, stem, habit; for fungi: cap, gills/pores, stipe, ring, volva).
- Give up to 5 candidate species. Never express certainty: use "possible" or "less_likely" only.
- Always list toxic lookalikes when any plausible toxic species could be confused with the candidates. For any mushroom, always include deadly lookalikes that are plausible.
- If the image is not a plant or fungus, or is too poor to judge, say so and return no candidates.
- Never give medicinal, edibility or dosage advice.`;

async function viaAnthropic(bytes: Buffer, mediaType: (typeof IMAGE_TYPES)[number], locale: Locale) {
  const r = await structuredCall({
    system: VISION_PROMPT,
    schema: VisionSchema,
    maxTokens: 6000,
    content: [
      { type: 'image', source: { type: 'base64', media_type: mediaType, data: bytes.toString('base64') } },
      { type: 'text', text: `Language for free-text fields: ${locale === 'es' ? 'Spanish' : 'English'}. Analyze this photo.` },
    ],
  });
  if (!r) return null;
  return r.data;
}

async function viaPlantnet(bytes: Buffer, mediaType: string, locale: Locale): Promise<z.infer<typeof VisionSchema> | null> {
  const form = new FormData();
  form.append('images', new Blob([new Uint8Array(bytes)], { type: mediaType }), 'photo');
  form.append('organs', 'auto');
  const res = await fetch(`https://my-api.plantnet.org/v2/identify/all?api-key=${encodeURIComponent(serverEnv.plantnetApiKey)}&lang=${locale}&nb-results=5`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(20_000),
  });
  if (res.status === 404) return { is_plant_or_fungus: false, image_quality: '', observed_features: [], candidates: [], toxic_lookalikes: [] };
  if (!res.ok) throw new Error(`plantnet ${res.status}`);
  const data = (await res.json()) as { results?: { score: number; species: { scientificNameWithoutAuthor: string; commonNames?: string[] } }[] };
  return {
    is_plant_or_fungus: true,
    image_quality: '',
    observed_features: [],
    candidates: (data.results ?? []).slice(0, 5).map((r, i) => ({
      scientific_name: r.species.scientificNameWithoutAuthor,
      common_names: r.species.commonNames ?? [],
      likelihood: i === 0 && r.score >= 0.3 ? 'possible' : 'less_likely',
      supporting_features: [],
      how_to_confirm: [],
    })),
    toxic_lookalikes: [],
  };
}

export async function identify(repo: KnowledgeRepository, bytes: Buffer, mediaType: (typeof IMAGE_TYPES)[number], locale: Locale): Promise<IdentifyResult | null> {
  const provider = serverEnv.identifyProvider;
  if (provider === 'none') return null;
  const raw = provider === 'plantnet' ? await viaPlantnet(bytes, mediaType, locale) : await viaAnthropic(bytes, mediaType, locale);
  if (!raw) return null;

  // Link candidates to HerbaNatura entries by binomial.
  const lexicon = await repo.getLexicon();
  const byBinomial = new Map<string, string>();
  for (const l of lexicon) if (l.kind === 'scientific') byBinomial.set(normalize(l.term).split(' ').slice(0, 2).join(' '), l.slug);
  const candidates: IdentifyCandidate[] = [];
  for (const c of raw.candidates) {
    const slug = byBinomial.get(normalize(c.scientific_name).split(' ').slice(0, 2).join(' '));
    const entity = slug ? await repo.getEntity(slug) : null;
    const toxicInDatabase =
      !!entity &&
      ((entity.type === 'mushroom' && ['toxic', 'deadly'].includes(entity.mushroom.edibility)) || entity.safety.some((s) => s.topic === 'toxicity' && s.status === 'documented_risk'));
    candidates.push({
      scientificName: c.scientific_name,
      commonNames: c.common_names.slice(0, 5),
      likelihood: c.likelihood,
      supportingFeatures: c.supporting_features.slice(0, 6),
      howToConfirm: c.how_to_confirm.slice(0, 6),
      entity: entity ? { id: entity.id, type: entity.type, slug: entity.slug, name: entity.name, reviewStatus: entity.reviewStatus } : null,
      toxicInDatabase,
    });
  }
  const mushroomInvolved = candidates.some((c) => c.entity?.type === 'mushroom') || /hongo|seta|mushroom|fung/i.test(raw.observed_features.join(' ') + raw.image_quality);
  return {
    provider,
    isPlantOrFungus: raw.is_plant_or_fungus,
    imageQuality: raw.image_quality,
    observedFeatures: raw.observed_features.slice(0, 12),
    candidates,
    toxicLookalikes: raw.toxic_lookalikes.slice(0, 6).map((x) => ({ scientificName: x.scientific_name, reason: x.reason })),
    mushroomInvolved,
  };
}

/** Validate magic bytes so a renamed file cannot pass as an image. */
export function sniffImage(bytes: Buffer): (typeof IMAGE_TYPES)[number] | null {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (bytes.length > 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}
