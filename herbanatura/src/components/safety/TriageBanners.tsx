import type { TriageResult } from '@/lib/safety/triage';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { Notice } from '@/components/ui';

/** Safety notices derived from the deterministic triage. Order = priority. */
export function TriageBanners({ triage, dict }: { triage: TriageResult; dict: Dictionary }) {
  const physical = triage.emergency.filter((e) => e !== 'self_harm' && e !== 'poisoning');
  return (
    <div className="space-y-3">
      {triage.emergency.includes('self_harm') && (
        <Notice tone="danger" title="💬">
          {dict.disclaimers.selfHarm}
        </Notice>
      )}
      {(physical.length > 0 || triage.emergency.includes('poisoning')) && (
        <Notice tone="danger" title={dict.disclaimers.emergencyTitle}>
          {dict.disclaimers.emergencyBody}
          {triage.emergency.includes('poisoning') && <p className="mt-2">{dict.disclaimers.poisoning}</p>}
        </Notice>
      )}
      {triage.cancerTreatmentIntent && (
        <Notice tone="warn" title="🧬">
          {dict.disclaimers.cancer}
        </Notice>
      )}
      {triage.stopTreatmentIntent && <Notice tone="warn">{dict.disclaimers.stopTreatment}</Notice>}
      {triage.pregnancyMention && <Notice tone="info">{dict.disclaimers.pregnancy}</Notice>}
    </div>
  );
}
