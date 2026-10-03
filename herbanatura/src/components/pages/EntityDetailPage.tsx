import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Entity, EntityType, Locale } from '@/lib/domain/types';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { getRepository } from '@/lib/data';
import { scientificName } from '@/lib/domain/entity';
import { entityPath, path, TYPE_SECTION } from '@/lib/i18n/config';
import { isFallback, tr } from '@/lib/i18n/text';
import { Container, DefinitionRow, ExternalLink, Notice, Pill, SectionTitle } from '@/components/ui';
import { ReviewBadge } from '@/components/evidence/badges';
import { ClaimsByContext } from '@/components/evidence/ClaimCard';
import { EntityImage } from '@/components/entity/EntityImage';
import { InteractionsTable } from '@/components/entity/InteractionsTable';
import { SafetyPanel } from '@/components/entity/SafetyPanel';
import { SourcesList } from '@/components/entity/SourcesList';
import { Timeline } from '@/components/research/Timeline';
import { FavoriteButton, PersonalAlerts, ViewRecorder } from '@/components/user/EntityClientTools';

const AGENTS: EntityType[] = ['plant', 'mushroom', 'food', 'compound'];

function family(e: Entity) {
  return e.type === 'plant' ? e.plant.family : e.type === 'mushroom' ? e.mushroom.family : e.type === 'food' ? (e.food.family ?? null) : null;
}

/** English term used for literature queries (PubMed indexes in English). */
export function literatureTerm(e: Entity): string {
  if (e.type === 'compound') return e.compound.pubchemQuery;
  const sci = scientificName(e);
  if (sci && !sci.includes('spp.')) return sci.split(' ').slice(0, 2).join(' ');
  return e.name.en ?? e.name.es;
}

export async function EntityDetailPage({ type, slug, locale, dict }: { type: EntityType; slug: string; locale: Locale; dict: Dictionary }) {
  const repo = getRepository();
  const detail = await repo.getEntityDetail(slug);
  if (!detail || detail.entity.type !== type) notFound();
  const { entity: e, relations, claims, interactions, traditionalUses, studies, sources } = detail;
  const name = tr(e.name, locale);
  const sci = scientificName(e);
  const isAgent = AGENTS.includes(e.type);

  const contains = relations.filter((r) => r.subjectId === e.id && r.predicate === 'contains').map((r) => r.object);
  const containedIn = relations.filter((r) => r.objectId === e.id && r.predicate === 'contains').map((r) => r.subject);
  const otherRelations = relations.filter((r) => r.predicate !== 'contains');
  const summary = e.summary ? tr(e.summary, locale) : dict.entity.pending;
  const simple = e.simpleSummary ? tr(e.simpleSummary, locale) : summary;
  const deadly = e.type === 'mushroom' && (e.mushroom.edibility === 'deadly' || e.mushroom.edibility === 'toxic');

  return (
    <Container className="py-8">
      <ViewRecorder slug={e.slug} type={e.type} name={name} />
      <nav aria-label="breadcrumb" className="text-sm text-muted">
        <Link href={path(locale)} className="hover:underline">
          HerbaNatura
        </Link>{' '}
        /{' '}
        <Link href={path(locale, `/${TYPE_SECTION[e.type]}`)} className="hover:underline">
          {dict.typesPlural[e.type]}
        </Link>{' '}
        / <span aria-current="page">{name}</span>
      </nav>

      <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Pill>{dict.types[e.type]}</Pill>
            <ReviewBadge status={e.reviewStatus} dict={dict} />
            {e.tags.includes('regulada') && <Pill tone="warn">⚖️ {dict.entity.legal}</Pill>}
          </div>
          <h1 className="mt-3 font-serif text-4xl font-semibold leading-tight sm:text-5xl">{name}</h1>
          {sci && <p className="sci mt-1 text-lg text-muted">{sci}</p>}
          {isFallback(e.name, locale) && <p className="text-xs text-muted">(traducción pendiente)</p>}

          <div className="mt-4 flex flex-wrap gap-2">
            <FavoriteButton slug={e.slug} type={e.type} name={name} />
            {isAgent && (
              <Link href={path(locale, `/comparar?a=${e.slug}`)} className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium hover:border-accent">
                ⚖️ {dict.entity.compare}
              </Link>
            )}
            <Link href={path(locale, `/herba-ai?q=${encodeURIComponent(locale === 'es' ? `¿Qué se sabe sobre ${name}?` : `What is known about ${name}?`)}`)} className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium hover:border-accent">
              🤖 HerbaAI
            </Link>
          </div>

          <div className="mt-6 space-y-3">
            {deadly && (
              <Notice tone="danger" title={`☠️ ${dict.edibility[e.type === 'mushroom' ? e.mushroom.edibility : 'toxic']}`}>
                {summary}
              </Notice>
            )}
            {e.reviewStatus === 'pending_review' && <Notice tone="warn">{dict.entity.demoNotice}</Notice>}
            {e.type === 'plant' && e.plant.nameAmbiguity && <Notice tone="info" title={dict.entity.nameAmbiguity}>{tr(e.plant.nameAmbiguity, locale)}</Notice>}
            {e.type === 'plant' && e.plant.legalNotes && <Notice tone="info" title={`⚖️ ${dict.entity.legal}`}>{tr(e.plant.legalNotes, locale)}</Notice>}
            {isAgent && (
              <PersonalAlerts
                input={{
                  entityType: e.type,
                  family: family(e),
                  interactions: interactions.map((i) => ({ medicationSlug: i.medication.slug, medicationName: tr(i.medication.name, locale), kind: i.kind, categories: [] })),
                  safety: e.safety.map((s) => ({ topic: s.topic, status: s.status })),
                }}
              />
            )}
          </div>

          {!deadly && (
            <div className="prose-hn mt-6 text-lg leading-relaxed">
              <p className="hide-simple">{summary}</p>
              <p className="only-simple rounded-xl bg-accent-soft p-4">🧠 {simple}</p>
            </div>
          )}
        </div>

        <aside>
          <EntityImage entity={e} dict={dict} locale={locale} />
        </aside>
      </div>

      {/* ------------------------------------------------------------ identity */}
      <SectionTitle id="ficha">{locale === 'es' ? 'Ficha' : 'Profile'}</SectionTitle>
      <dl className="rounded-2xl border border-border bg-surface px-5">
        {sci && <DefinitionRow label={dict.entity.scientificName}><span className="sci">{sci}</span></DefinitionRow>}
        {family(e) && <DefinitionRow label={dict.entity.family}>{family(e)}</DefinitionRow>}
        {e.type === 'plant' && e.plant.synonyms.length > 0 && <DefinitionRow label={dict.entity.synonyms}><span className="sci">{e.plant.synonyms.join('; ')}</span></DefinitionRow>}
        {e.aliases.length > 0 && (
          <DefinitionRow label={dict.entity.aliases}>
            {e.aliases.filter((a) => a.kind !== 'scientific_synonym').map((a) => a.name).join(' · ')}
          </DefinitionRow>
        )}
        {e.type === 'plant' && <DefinitionRow label={dict.entity.partsUsed}>{e.plant.partsUsed.join(', ') || dict.entity.pending}</DefinitionRow>}
        {e.type === 'plant' && <DefinitionRow label={dict.entity.botanicalDescription}>{e.plant.botanicalDescription ? tr(e.plant.botanicalDescription, locale) : dict.entity.pending}</DefinitionRow>}
        {(e.type === 'plant' || e.type === 'mushroom') && (
          <DefinitionRow label={dict.entity.distribution}>
            {(e.type === 'plant' ? e.plant.distribution : e.mushroom.distribution) ? tr((e.type === 'plant' ? e.plant.distribution : e.mushroom.distribution)!, locale) : dict.entity.pending}
          </DefinitionRow>
        )}
        {e.type === 'mushroom' && <DefinitionRow label={dict.entity.edibility}>{dict.edibility[e.mushroom.edibility]}</DefinitionRow>}
        {e.type === 'food' && <DefinitionRow label={dict.entity.foodGroup}>{e.food.foodGroup}</DefinitionRow>}
        {e.type === 'food' && (
          <DefinitionRow label={dict.entity.nutrients}>{e.food.nutrients.length ? e.food.nutrients.map((n) => tr(n.name, locale)).join(', ') : dict.entity.pending}</DefinitionRow>
        )}
        {e.type === 'compound' && (
          <>
            <DefinitionRow label={dict.entity.formula}>{e.compound.formula ? <span className="font-mono">{e.compound.formula}</span> : dict.entity.pending}</DefinitionRow>
            <DefinitionRow label={dict.entity.compoundClass}>{e.compound.compoundClass.join(' · ')}</DefinitionRow>
            <DefinitionRow label={dict.entity.bioavailability}>{e.compound.bioavailability ? tr(e.compound.bioavailability, locale) : dict.entity.pending}</DefinitionRow>
            <DefinitionRow label={dict.entity.mechanisms}>
              {e.compound.mechanismsInvestigated.length ? (
                <ul className="list-disc pl-5">
                  {e.compound.mechanismsInvestigated.map((m, i) => (
                    <li key={i}>
                      {tr(m.text, locale)} <span className="text-xs text-muted">({m.studyTypes.map((s) => dict.studyTypes[s]).join(', ')})</span>
                    </li>
                  ))}
                </ul>
              ) : (
                dict.entity.pending
              )}
            </DefinitionRow>
            <DefinitionRow label="PubChem">
              <ExternalLink href={`https://pubchem.ncbi.nlm.nih.gov/#query=${encodeURIComponent(e.compound.pubchemQuery)}`}>{dict.entity.pubchem}</ExternalLink>
            </DefinitionRow>
          </>
        )}
        {e.type === 'condition' && (
          <>
            <DefinitionRow label="Tipo / kind">{e.condition.kind}</DefinitionRow>
            {e.condition.icd10 && <DefinitionRow label="CIE-10 / ICD-10">{e.condition.icd10}</DefinitionRow>}
          </>
        )}
        {e.type === 'medication' && (
          <>
            <DefinitionRow label={dict.entity.drugClass}>{tr(e.medication.drugClass, locale)}</DefinitionRow>
            {e.medication.atcCode && <DefinitionRow label={dict.entity.atc}>{e.medication.atcCode}</DefinitionRow>}
          </>
        )}
        {e.regions.length > 0 && <DefinitionRow label={dict.entity.regions}>{e.regions.join(', ')}</DefinitionRow>}
      </dl>

      {(contains.length > 0 || containedIn.length > 0 || otherRelations.length > 0) && (
        <>
          <SectionTitle id="relaciones">{dict.entity.related}</SectionTitle>
          <div className="grid gap-4 md:grid-cols-2">
            {contains.length > 0 && (
              <div className="rounded-2xl border border-border bg-surface p-5">
                <h3 className="font-semibold">⚗️ {dict.entity.compounds}</h3>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {contains.map((c) => (
                    <li key={c.id}>
                      <Link href={entityPath(locale, c.type, c.slug)} className="inline-block rounded-full bg-accent-soft px-3 py-1 text-sm text-accent-strong hover:underline">
                        {tr(c.name, locale)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {containedIn.length > 0 && (
              <div className="rounded-2xl border border-border bg-surface p-5">
                <h3 className="font-semibold">🌿 {e.type === 'compound' ? dict.entity.naturalSources : dict.entity.containedIn}</h3>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {containedIn.map((c) => (
                    <li key={c.id}>
                      <Link href={entityPath(locale, c.type, c.slug)} className="inline-block rounded-full bg-accent-soft px-3 py-1 text-sm text-accent-strong hover:underline">
                        {tr(c.name, locale)} <span className="text-xs opacity-70">({dict.types[c.type]})</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {otherRelations.map((r) => (
              <div key={r.id} className="rounded-2xl border border-border bg-surface p-5 text-sm">
                <p>
                  {tr(r.subject.name, locale)} — <em>{r.predicate}</em> — {tr(r.object.name, locale)}
                </p>
                {r.note && <p className="mt-1 text-muted">{tr(r.note, locale)}</p>}
              </div>
            ))}
          </div>
        </>
      )}

      {isAgent && (
        <>
          <SectionTitle id="tradicional" sub={dict.entity.traditionalNotice}>
            🌎 {dict.entity.traditionalUses}
          </SectionTitle>
          {traditionalUses.length ? (
            <ul className="grid gap-3 md:grid-cols-2">
              {traditionalUses.map((t) => (
                <li key={t.id} className="rounded-2xl border border-border bg-surface p-4 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone="info">{t.region ? tr(t.region.name, locale) : t.regionSlug}</Pill>
                    {t.culture && <Pill>{t.culture}</Pill>}
                    <Pill tone={t.documentation === 'documented' ? 'accent' : 'warn'}>
                      {t.documentation === 'documented' ? (locale === 'es' ? 'Uso tradicional documentado' : 'Documented traditional use') : dict.entity.pending}
                    </Pill>
                  </div>
                  <p className="mt-2">{tr(t.use, locale)}</p>
                  {t.preparation && <p className="mt-1 text-muted">{tr(t.preparation, locale)}</p>}
                  <p className="mt-2 text-xs text-muted">
                    {dict.claim.source}:{' '}
                    {t.sources.map((s) => (
                      <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer" className="underline">
                        {s.title}
                      </a>
                    ))}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm italic text-muted">{dict.entity.pending}</p>
          )}
        </>
      )}

      <SectionTitle id="evidencia" sub={e.type === 'plant' && contains.length ? (locale === 'es' ? 'Incluye la evidencia sobre sus compuestos, indicada en cada tarjeta.' : 'Includes evidence on its compounds, labelled on each card.') : undefined}>
        🔬 {dict.entity.evidence}
      </SectionTitle>
      {claims.length ? (
        <ClaimsByContext claims={claims} dict={dict} locale={locale} showSubject />
      ) : (
        <p className="text-sm italic text-muted">{dict.entity.noClaims}</p>
      )}

      {isAgent && (
        <>
          <SectionTitle id="seguridad">⚠️ {dict.entity.safety}</SectionTitle>
          <SafetyPanel notes={e.safety} sources={sources} dict={dict} locale={locale} />
        </>
      )}

      {(isAgent || e.type === 'medication') && (
        <>
          <SectionTitle id="interacciones">💊 {dict.entity.interactions}</SectionTitle>
          <InteractionsTable items={interactions} dict={dict} locale={locale} perspective={e.type === 'medication' ? 'medication' : 'agent'} />
        </>
      )}

      <SectionTitle id="estudios">📄 {dict.entity.studies}</SectionTitle>
      {studies.length ? (
        <ul className="space-y-2">
          {studies.map((s) => (
            <li key={s.id} className="rounded-xl border border-border bg-surface p-3 text-sm">
              <ExternalLink href={s.url}>{s.title}</ExternalLink>
              <p className="text-xs text-muted">
                {s.year} · {s.journal} · {dict.studyTypes[s.type]}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">
          {dict.entity.noStudies}{' '}
          <Link href={path(locale, `/investigacion?q=${encodeURIComponent(literatureTerm(e))}`)} className="text-accent underline">
            🔬 {dict.nav.research} →
          </Link>
        </p>
      )}

      {isAgent && (
        <>
          <SectionTitle id="cronologia">📈 {dict.entity.timeline}</SectionTitle>
          <Timeline term={literatureTerm(e)} />
        </>
      )}

      <SectionTitle id="fuentes">{dict.entity.sources}</SectionTitle>
      <div className="rounded-2xl border border-border bg-surface p-5">
        <SourcesList sources={sources} dict={dict} />
        <p className="mt-4 text-xs text-muted">
          {dict.claim.date}: {e.updatedAt} · {dict.entity.reviewDate}: {e.reviewedAt ? String(e.reviewedAt).slice(0, 10) : dict.entity.pendingReview}
        </p>
      </div>
    </Container>
  );
}
