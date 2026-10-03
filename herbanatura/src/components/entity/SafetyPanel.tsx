import type { Locale, SafetyNote, SafetyTopic, Source } from '@/lib/domain/types';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { tr } from '@/lib/i18n/text';
import { Pill } from '@/components/ui';
import { ReviewBadge } from '@/components/evidence/badges';

/** Topics always listed on every entry, so missing information is visible rather than silent. */
const CORE_TOPICS: SafetyTopic[] = ['toxicity', 'side_effects', 'allergies', 'contraindications', 'pregnancy', 'lactation', 'children', 'elderly', 'liver', 'kidney', 'surgery'];

const STATUS_TONE = { documented_risk: 'danger', caution: 'warn', no_known_risk: 'accent', insufficient: 'neutral', pending: 'neutral' } as const;

export function SafetyPanel({ notes, sources, dict, locale }: { notes: SafetyNote[]; sources: Source[]; dict: Dictionary; locale: Locale }) {
  const byId = new Map(sources.map((s) => [s.id, s]));
  const missing = CORE_TOPICS.filter((t) => !notes.some((n) => n.topic === t));
  return (
    <div className="space-y-3">
      {notes.map((n, i) => (
        <div key={i} className={`rounded-xl border p-4 ${n.status === 'documented_risk' ? 'border-danger/40 bg-danger-soft/60' : 'border-border bg-surface'}`}>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{dict.safetyTopics[n.topic]}</h3>
            <Pill tone={STATUS_TONE[n.status]}>{dict.safetyStatus[n.status]}</Pill>
            <ReviewBadge status={n.reviewStatus} dict={dict} />
          </div>
          <p className="mt-2 text-sm leading-relaxed">{tr(n.text, locale)}</p>
          {n.citations.length > 0 && (
            <p className="mt-2 text-xs text-muted">
              {dict.claim.source}:{' '}
              {n.citations
                .map((c) => byId.get(c.sourceId))
                .filter(Boolean)
                .map((s, j) => (
                  <a key={j} href={s!.url} target="_blank" rel="noopener noreferrer" className="underline">
                    {s!.title}
                  </a>
                ))}
            </p>
          )}
        </div>
      ))}
      {missing.length > 0 && (
        <div className="rounded-xl border border-dashed border-border p-4 text-sm">
          <p className="font-medium">{dict.entity.safetyMissing}</p>
          <p className="mt-1 text-muted">{missing.map((t) => dict.safetyTopics[t]).join(' · ')}</p>
        </div>
      )}
    </div>
  );
}
