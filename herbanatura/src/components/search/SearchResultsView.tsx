import Link from 'next/link';
import type { Locale } from '@/lib/domain/types';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import type { SearchResponse } from '@/lib/search/engine';
import { entityPath } from '@/lib/i18n/config';
import { tr } from '@/lib/i18n/text';
import { Notice, Pill, SectionTitle } from '@/components/ui';
import { ClaimsByContext } from '@/components/evidence/ClaimCard';
import { LevelBadge } from '@/components/evidence/badges';
import { EntityCard } from '@/components/entity/EntityCard';
import { InteractionsTable } from '@/components/entity/InteractionsTable';
import { TriageBanners } from '@/components/safety/TriageBanners';

function Chip({ href, children, tone }: { href: string; children: React.ReactNode; tone?: 'accent' }) {
  return (
    <Link href={href} className={`inline-flex items-center rounded-xl border px-3 py-2 text-sm font-semibold hover:underline ${tone ? 'border-accent bg-accent-soft text-accent-strong' : 'border-border bg-surface'}`}>
      {children}
    </Link>
  );
}

const Arrow = () => <span aria-hidden className="px-1 text-muted">→</span>;

export function SearchResultsView({ r, dict, locale }: { r: SearchResponse; dict: Dictionary; locale: Locale }) {
  const pubmed = (q: string) => `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(q)}`;
  return (
    <div className="space-y-8">
      <TriageBanners triage={r.triage} dict={dict} />

      {r.recognized.length > 0 && (
        <div>
          <p className="text-sm text-muted">{dict.search.recognized}:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {r.recognized.map((x) => (
              <Link key={x.entity.id} href={entityPath(locale, x.entity.type, x.entity.slug)}>
                <Pill tone="accent">
                  {dict.types[x.entity.type]}: {tr(x.entity.name, locale)}
                  {x.fuzzy && <span className="opacity-70"> ({dict.search.fuzzy})</span>}
                </Pill>
              </Link>
            ))}
          </div>
        </div>
      )}

      {!r.triage.withholdRemedies && r.chains.length > 0 && (
        <section>
          <SectionTitle>{dict.search.chains}</SectionTitle>
          <div className="space-y-6">
            {r.chains.map((c, i) => (
              <div key={i} className="rounded-2xl border border-border bg-surface-2 p-4">
                <div className="flex flex-wrap items-center gap-1">
                  <Chip href={entityPath(locale, c.agent.type, c.agent.slug)} tone="accent">
                    {tr(c.agent.name, locale)}
                  </Chip>
                  {c.via.map((v) => (
                    <span key={v.id} className="flex items-center">
                      <Arrow />
                      <Chip href={entityPath(locale, v.type, v.slug)}>
                        {tr(v.name, locale)} <span className="ml-1 text-xs font-normal text-muted">({dict.types[v.type]})</span>
                      </Chip>
                    </span>
                  ))}
                  {c.condition && (
                    <>
                      <Arrow />
                      <Chip href={entityPath(locale, c.condition.type, c.condition.slug)} tone="accent">
                        {tr(c.condition.name, locale)}
                      </Chip>
                    </>
                  )}
                  {c.claims.length > 0 && (
                    <>
                      <Arrow />
                      <span className="flex flex-wrap gap-1">
                        {[...new Set(c.claims.map((x) => x.level))].map((lv) => (
                          <LevelBadge key={lv} level={lv} dict={dict} withLabel={false} />
                        ))}
                      </span>
                      <Arrow />
                      <span className="text-sm text-muted">📚 {new Set(c.claims.flatMap((x) => x.sources.map((s) => s.id))).size}</span>
                    </>
                  )}
                </div>
                <div className="mt-4">
                  {c.claims.length ? (
                    <ClaimsByContext claims={c.claims} dict={dict} locale={locale} showSubject />
                  ) : (
                    <Notice tone="info">
                      {dict.search.noClaimsForPair}{' '}
                      <a className="underline" target="_blank" rel="noopener noreferrer" href={pubmed(`${c.agent.name.en ?? c.agent.name.es} ${c.condition?.name.en ?? ''}`)}>
                        {dict.search.searchPubmed} ↗
                      </a>
                    </Notice>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {!r.triage.withholdRemedies && r.conditionClaims.length > 0 && (
        <section>
          <SectionTitle>{dict.search.claimsForCondition}</SectionTitle>
          <ClaimsByContext claims={r.conditionClaims} dict={dict} locale={locale} showSubject />
        </section>
      )}

      {(r.interactions.length > 0 || r.missingInteractions.length > 0) && (
        <section>
          <SectionTitle>💊 {dict.search.interactionsFound}</SectionTitle>
          <InteractionsTable items={r.interactions} dict={dict} locale={locale} perspective="medication" />
          {r.missingInteractions.map((m) => (
            <div key={m.agent.id + m.medication.id} className="mt-3">
              <Notice tone="info" title={`${tr(m.agent.name, locale)} × ${tr(m.medication.name, locale)}`}>
                {dict.search.noInteractionRecord}
              </Notice>
            </div>
          ))}
        </section>
      )}

      {r.results.length > 0 && (
        <section>
          <SectionTitle>{dict.search.results}</SectionTitle>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {r.results.map((x) => (
              <li key={x.id}>
                <EntityCard item={x} dict={dict} locale={locale} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {!r.triage.withholdRemedies && !r.results.length && !r.chains.length && !r.conditionClaims.length && (
        <Notice tone="info">
          {dict.search.noResults}{' '}
          <a className="underline" target="_blank" rel="noopener noreferrer" href={pubmed(r.query)}>
            {dict.search.searchPubmed} ↗
          </a>
        </Notice>
      )}
    </div>
  );
}
