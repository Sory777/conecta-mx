import Link from 'next/link';
import type { ClaimContext, Locale, LocalizedText, ResolvedClaim } from '@/lib/domain/types';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { entityPath } from '@/lib/i18n/config';
import { tr } from '@/lib/i18n/text';
import { Pill } from '@/components/ui';
import { SourcesList } from '@/components/entity/SourcesList';
import { CategoryBadge, LevelBadge, ReviewBadge } from './badges';

function Bullets({ title, items, locale, tone }: { title: string; items: LocalizedText[]; locale: Locale; tone?: 'danger' }) {
  if (!items.length) return null;
  return (
    <div>
      <h4 className={`text-sm font-semibold ${tone === 'danger' ? 'text-danger' : ''}`}>{title}</h4>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
        {items.map((x, i) => (
          <li key={i}>{tr(x, locale)}</li>
        ))}
      </ul>
    </div>
  );
}

export function ClaimCard({ claim, dict, locale, showSubject = false }: { claim: ResolvedClaim; dict: Dictionary; locale: Locale; showSubject?: boolean }) {
  const isTreatment = claim.context === 'cancer_treatment';
  return (
    <article className={`rounded-2xl border bg-surface p-5 ${isTreatment ? 'border-danger/40' : 'border-border'}`}>
      <header className="flex flex-wrap items-center gap-2">
        <LevelBadge level={claim.level} dict={dict} />
        <CategoryBadge category={claim.category} dict={dict} />
        <Pill tone={claim.humanEvidence ? 'accent' : 'warn'}>{claim.humanEvidence ? `👥 ${dict.claim.humanEvidence}` : `🚫 ${dict.claim.noHumanEvidence}`}</Pill>
        <ReviewBadge status={claim.reviewStatus} dict={dict} />
      </header>

      {showSubject && (
        <p className="mt-3 text-sm text-muted">
          <Link href={entityPath(locale, claim.subject.type, claim.subject.slug)} className="font-semibold text-text underline-offset-2 hover:underline">
            {tr(claim.subject.name, locale)}
          </Link>
          {claim.condition && (
            <>
              {' → '}
              <Link href={entityPath(locale, claim.condition.type, claim.condition.slug)} className="font-semibold text-text underline-offset-2 hover:underline">
                {tr(claim.condition.name, locale)}
              </Link>
            </>
          )}
          {' · '}
          {dict.contexts[claim.context]}
        </p>
      )}

      {/* General + researcher: scientific statement. Simple mode: plain language first. */}
      <div className="mt-3">
        <p className="hide-simple text-base leading-relaxed">{tr(claim.statement, locale)}</p>
        <div className="only-simple rounded-xl bg-accent-soft p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent-strong">🧠 {dict.claim.simple}</p>
          <p className="mt-1 text-base leading-relaxed">{tr(claim.simple, locale)}</p>
        </div>
        <details className="hide-simple mt-2 text-sm">
          <summary className="cursor-pointer text-accent">{dict.modes.simple}</summary>
          <p className="mt-1">{tr(claim.simple, locale)}</p>
        </details>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Bullets title={`✅ ${dict.claim.whatWeKnow}`} items={claim.whatWeKnow} locale={locale} />
        <Bullets title={`❓ ${dict.claim.whatWeDontKnow}`} items={claim.whatWeDontKnow} locale={locale} />
        <Bullets title={`🔭 ${dict.claim.underInvestigation}`} items={claim.underInvestigation} locale={locale} />
        <Bullets title={`⚠️ ${dict.claim.risks}`} items={claim.risks} locale={locale} tone="danger" />
      </div>

      {/* Researcher-only technical block */}
      <div className="only-researcher mt-4 rounded-xl border border-dashed border-info/40 bg-info-soft/50 p-3 text-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-info">🔬 {dict.modes.researcherNotice}</p>
        <p className="mt-2">
          <span className="font-medium">{dict.claim.studyTypes}:</span> {claim.studyTypes.map((s) => dict.studyTypes[s]).join(' · ') || '—'}
        </p>
        <Bullets title={dict.claim.limitations} items={claim.limitations} locale={locale} />
        {claim.researchDoses && (
          <p className="mt-2">
            <span className="font-medium">{dict.claim.researchDoses}:</span> {tr(claim.researchDoses, locale)}
          </p>
        )}
      </div>

      <details className="mt-4 rounded-xl bg-surface-2 p-3 text-sm">
        <summary className="cursor-pointer font-medium">ℹ️ {dict.claim.why}</summary>
        <div className="mt-3 space-y-2">
          <p className="text-muted">{dict.claim.whyIntro}</p>
          <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[200px_1fr]">
            <dt className="text-muted">{dict.claim.level}</dt>
            <dd>
              {claim.level} — {dict.levels[claim.level]}
            </dd>
            <dt className="text-muted">{dict.claim.category}</dt>
            <dd>{dict.categories[claim.category]}</dd>
            <dt className="text-muted">{dict.claim.studyTypes}</dt>
            <dd>{claim.studyTypes.map((s) => dict.studyTypes[s]).join(' · ') || '—'}</dd>
            <dt className="text-muted">{dict.claim.date}</dt>
            <dd>{claim.updatedAt}</dd>
            <dt className="text-muted">{dict.claim.reviewStatus}</dt>
            <dd>
              {dict.review[claim.reviewStatus]}
              {claim.reviewedAt ? ` · ${dict.claim.reviewedOn} ${String(claim.reviewedAt).slice(0, 10)}` : ` · ${dict.claim.notReviewedYet}`}
            </dd>
            <dt className="text-muted">{dict.claim.limitations}</dt>
            <dd>{claim.limitations.length ? claim.limitations.map((l) => tr(l, locale)).join(' ') : '—'}</dd>
          </dl>
          <div>
            <p className="font-medium">{dict.entity.sources}</p>
            <SourcesList sources={claim.sources} dict={dict} compact />
          </div>
        </div>
      </details>
    </article>
  );
}

const ORDER: ClaimContext[] = ['general', 'prevention', 'research', 'complementary', 'cancer_treatment', 'safety'];

export function ClaimsByContext({ claims, dict, locale, showSubject }: { claims: ResolvedClaim[]; dict: Dictionary; locale: Locale; showSubject?: boolean }) {
  const groups = ORDER.map((c) => [c, claims.filter((x) => x.context === c)] as const).filter(([, list]) => list.length);
  return (
    <div className="space-y-8">
      {groups.map(([context, list]) => (
        <section key={context} aria-labelledby={`ctx-${context}`}>
          <h3 id={`ctx-${context}`} className="text-lg font-semibold">
            {dict.contexts[context]}
          </h3>
          <p className="mb-3 text-sm text-muted">{dict.contextHelp[context]}</p>
          <div className="space-y-4">
            {list.map((c) => (
              <ClaimCard key={c.id} claim={c} dict={dict} locale={locale} showSubject={showSubject} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

