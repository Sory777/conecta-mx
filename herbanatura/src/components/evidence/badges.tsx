import type { EvidenceCategory, EvidenceLevel, ReviewStatus } from '@/lib/domain/types';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { Pill } from '@/components/ui';

const LEVEL_STYLE: Record<EvidenceLevel, string> = {
  A: 'bg-[#1f7a3a] text-white',
  B: 'bg-[#8a9a1a] text-white',
  C: 'bg-[#c4741a] text-white',
  D: 'bg-[#2b6cb0] text-white',
  E: 'bg-[#6b4fa0] text-white',
  F: 'bg-[#7a5a3a] text-white',
  X: 'bg-[#6b7280] text-white',
};

export function LevelBadge({ level, dict, withLabel = true }: { level: EvidenceLevel; dict: Dictionary; withLabel?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2" title={dict.levels[level]}>
      <span className={`inline-grid h-7 w-7 place-items-center rounded-md font-serif text-sm font-bold ${LEVEL_STYLE[level]}`} aria-label={`${dict.claim.level} ${level}`}>
        {level}
      </span>
      {withLabel && <span className="text-sm font-medium">{dict.levels[level]}</span>}
    </span>
  );
}

export function CategoryBadge({ category, dict }: { category: EvidenceCategory; dict: Dictionary }) {
  const tone = category === 'clinical_strong' ? 'accent' : category === 'negative' ? 'danger' : ['insufficient'].includes(category) ? 'neutral' : category === 'observational' ? 'info' : 'warn';
  return <Pill tone={tone}>{dict.categories[category]}</Pill>;
}

export function ReviewBadge({ status, dict }: { status: ReviewStatus; dict: Dictionary }) {
  const tone = status === 'reviewed' ? 'accent' : status === 'rejected' ? 'danger' : status === 'pending_review' ? 'warn' : 'neutral';
  return <Pill tone={tone}>{dict.review[status]}</Pill>;
}
