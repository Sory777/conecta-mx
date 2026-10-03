import Link from 'next/link';
import type { Locale } from '@/lib/domain/types';
import type { EntitySummary } from '@/lib/data/repository';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { entityPath } from '@/lib/i18n/config';
import { tr } from '@/lib/i18n/text';
import { Pill } from '@/components/ui';

const EMOJI = { plant: '🌿', mushroom: '🍄', food: '🥦', compound: '⚗️', condition: '🩺', medication: '💊' } as const;

export function EntityCard({ item, dict, locale }: { item: EntitySummary; dict: Dictionary; locale: Locale }) {
  const toxic = item.type === 'mushroom' && (item.hint === 'toxic' || item.hint === 'deadly');
  const hint =
    item.type === 'mushroom' && item.hint
      ? dict.edibility[item.hint as keyof typeof dict.edibility]
      : item.type === 'condition' || item.type === 'medication'
        ? null
        : item.hint;
  return (
    <Link
      href={entityPath(locale, item.type, item.slug)}
      className={`group block rounded-2xl border bg-surface p-4 transition hover:-translate-y-0.5 hover:shadow-md ${toxic ? 'border-danger/50' : 'border-border'}`}
    >
      <div className="flex items-start gap-3">
        <span aria-hidden className="text-2xl">
          {EMOJI[item.type]}
        </span>
        <div className="min-w-0">
          <h3 className="font-serif text-lg font-semibold leading-tight group-hover:text-accent">{tr(item.name, locale)}</h3>
          {item.scientificName && <p className="sci truncate text-sm text-muted">{item.scientificName}</p>}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Pill>{dict.types[item.type]}</Pill>
            {item.family && <Pill>{item.family}</Pill>}
            {hint && <Pill tone={toxic ? 'danger' : 'neutral'}>{hint}</Pill>}
          </div>
          {item.summary && <p className="mt-2 line-clamp-2 text-sm text-muted">{tr(item.summary, locale)}</p>}
        </div>
      </div>
    </Link>
  );
}
