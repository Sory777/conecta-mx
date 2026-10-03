import type { Entity, Locale } from '@/lib/domain/types';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { tr } from '@/lib/i18n/text';
import { scientificName } from '@/lib/domain/entity';
import { wikimediaImage } from '@/lib/images/wikimedia';

const EMOJI: Record<Entity['type'], string> = { plant: '🌿', mushroom: '🍄', food: '🥦', compound: '⚗️', condition: '🩺', medication: '💊' };

/** Photo with mandatory attribution, or an illustrated placeholder. Never used for identification. */
export async function EntityImage({ entity, dict, locale }: { entity: Entity; dict: Dictionary; locale: Locale }) {
  const own = entity.images[0];
  const sci = scientificName(entity);
  const img = own ?? (sci && !sci.includes('spp.') ? await wikimediaImage(sci) : null);
  if (!img) {
    return (
      <div aria-hidden className="leaf-pattern grid aspect-[4/3] w-full place-items-center rounded-2xl hero-bg text-6xl">
        <span className="drop-shadow">{EMOJI[entity.type]}</span>
      </div>
    );
  }
  return (
    <figure>
      {/* eslint-disable-next-line @next/next/no-img-element -- remote Commons image with attribution */}
      <img src={img.thumbUrl ?? img.url} alt={`${tr(entity.name, locale)}${sci ? ` (${sci})` : ''}`} className="aspect-[4/3] w-full rounded-2xl object-cover" loading="lazy" />
      <figcaption className="mt-1 text-xs text-muted">
        {dict.entity.imageCredit}: {img.author} · {img.license} ·{' '}
        <a href={img.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">
          Wikimedia Commons
        </a>
        . {img.verified ? '' : dict.entity.imageWarning}
      </figcaption>
    </figure>
  );
}
