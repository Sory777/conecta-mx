import Link from 'next/link';
import type { Locale, ResolvedInteraction } from '@/lib/domain/types';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { entityPath } from '@/lib/i18n/config';
import { tr } from '@/lib/i18n/text';
import { Pill } from '@/components/ui';
import { LevelBadge, ReviewBadge } from '@/components/evidence/badges';

const KIND_TONE = { documented: 'danger', possible: 'warn', theoretical: 'info', insufficient: 'neutral' } as const;

export function InteractionsTable({ items, dict, locale, perspective }: { items: ResolvedInteraction[]; dict: Dictionary; locale: Locale; perspective: 'agent' | 'medication' }) {
  if (!items.length) return <p className="text-sm italic text-muted">{dict.entity.noInteractions}</p>;
  return (
    <ul className="space-y-3">
      {items.map((i) => {
        const other = perspective === 'agent' ? i.medication : i.agent;
        return (
          <li key={i.id} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={entityPath(locale, other.type, other.slug)} className="font-semibold underline-offset-2 hover:underline">
                {tr(other.name, locale)}
              </Link>
              <Pill tone={KIND_TONE[i.kind]}>{dict.interactionKinds[i.kind]}</Pill>
              <Pill>{dict.severity[i.severity]}</Pill>
              <ReviewBadge status={i.reviewStatus} dict={dict} />
            </div>
            <p className="mt-2 text-sm">{tr(i.effect, locale)}</p>
            {i.mechanism && (
              <p className="hide-simple mt-1 text-xs text-muted">
                <span className="font-medium">Mecanismo / mechanism:</span> {tr(i.mechanism, locale)}
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted">
              <LevelBadge level={i.level} dict={dict} />
              {i.sources.map((s) => (
                <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer" className="underline">
                  {s.title}
                </a>
              ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
