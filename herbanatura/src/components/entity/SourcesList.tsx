import type { Source } from '@/lib/domain/types';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { ExternalLink } from '@/components/ui';

export function SourcesList({ sources, dict, compact = false }: { sources: Source[]; dict: Dictionary; compact?: boolean }) {
  if (!sources.length) return <p className="text-sm italic text-muted">{dict.entity.pending}</p>;
  return (
    <ol className={`space-y-2 ${compact ? 'text-xs' : 'text-sm'}`}>
      {sources.map((s) => (
        <li key={s.id} className="leading-snug">
          <ExternalLink href={s.url} className="font-medium">
            {s.title}
          </ExternalLink>
          <span className="text-muted"> — {s.publisher}</span>
          {!compact && (
            <span className="mt-0.5 block text-xs text-muted">
              {dict.entity.reviewDate}: {s.reviewedAt ? s.reviewedAt : dict.entity.pendingReview}
              {s.doi && <> · DOI {s.doi}</>}
              {s.pmid && <> · PMID {s.pmid}</>}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
