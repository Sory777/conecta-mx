import type { Metadata } from 'next';
import Link from 'next/link';
import type { EntityDetail } from '@/lib/domain/types';
import { EVIDENCE_LEVELS } from '@/lib/domain/types';
import { getRepository } from '@/lib/data';
import { scientificName } from '@/lib/domain/entity';
import { entityPath } from '@/lib/i18n/config';
import { pageContext } from '@/lib/i18n/server';
import { tr } from '@/lib/i18n/text';
import { Container, Notice } from '@/components/ui';
import { LevelBadge } from '@/components/evidence/badges';
import { PremiumGate } from '@/components/premium/PremiumGate';

export const metadata: Metadata = { title: 'Comparar' };

export default async function ComparePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ a?: string; b?: string }> }) {
  const { locale, dict } = await pageContext(params);
  const { a, b } = await searchParams;
  const repo = getRepository();
  const options = (await repo.listEntities({ limit: 2000 })).items.filter((i) => ['plant', 'mushroom', 'food', 'compound'].includes(i.type));
  const details = (await Promise.all([a, b].map((s) => (s ? repo.getEntityDetail(s) : null)))).filter(Boolean) as EntityDetail[];
  const es = locale === 'es';

  const rows: [string, (d: EntityDetail) => React.ReactNode][] = [
    [es ? 'Tipo' : 'Type', (d) => dict.types[d.entity.type]],
    [dict.entity.scientificName, (d) => <span className="sci">{scientificName(d.entity) ?? '—'}</span>],
    [es ? 'Fuente / compuestos' : 'Source / compounds', (d) => d.relations.filter((r) => r.predicate === 'contains').map((r) => tr((r.subjectId === d.entity.id ? r.object : r.subject).name, locale)).join(', ') || '—'],
    [dict.claim.studyTypes, (d) => [...new Set(d.claims.flatMap((c) => c.studyTypes))].map((s) => dict.studyTypes[s]).join(' · ') || '—'],
    [es ? 'Niveles de evidencia registrados' : 'Recorded evidence levels', (d) => <span className="flex flex-wrap gap-1">{EVIDENCE_LEVELS.filter((l) => d.claims.some((c) => c.level === l)).map((l) => <LevelBadge key={l} level={l} dict={dict} withLabel={false} />)}{!d.claims.length && '—'}</span>],
    [es ? 'Estudios en humanos' : 'Human studies', (d) => (d.claims.some((c) => c.humanEvidence) ? dict.common.yes : dict.common.no)],
    [es ? 'Contextos' : 'Contexts', (d) => [...new Set(d.claims.map((c) => dict.contexts[c.context]))].join(' · ') || '—'],
    [dict.entity.safety, (d) => d.entity.safety.map((s) => `${dict.safetyTopics[s.topic]} (${dict.safetyStatus[s.status]})`).join('; ') || dict.entity.pending],
    [dict.entity.interactions, (d) => d.interactions.map((i) => `${tr(i.medication.name, locale)} (${dict.interactionKinds[i.kind]})`).join('; ') || '—'],
    [dict.entity.traditionalUses, (d) => d.traditionalUses.length || '—'],
    [dict.entity.sources, (d) => d.sources.length],
  ];

  return (
    <Container className="py-10">
      <h1 className="font-serif text-4xl font-semibold">⚖️ {dict.nav.compare}</h1>
      <p className="mt-2 max-w-3xl text-muted">{es ? 'Compara la naturaleza de la evidencia, la seguridad y las interacciones. No declaramos una “ganadora”: los niveles describen la evidencia, no el valor de una planta.' : 'Compare the nature of evidence, safety and interactions. We never declare a “winner”: levels describe evidence, not the worth of a plant.'}</p>
      <form className="mt-6 flex flex-wrap items-end gap-3" action={`/${locale}/comparar`}>
        {(['a', 'b'] as const).map((k, idx) => (
          <label key={k} className="text-sm">
            <span className="block font-medium">{idx === 0 ? 'A' : 'B'}</span>
            <select name={k} defaultValue={idx === 0 ? a : b} className="mt-1 rounded-lg border border-border bg-surface px-3 py-2">
              <option value="">—</option>
              {options.map((o) => <option key={o.slug} value={o.slug}>{tr(o.name, locale)} ({dict.types[o.type]})</option>)}
            </select>
          </label>
        ))}
        <button className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white">{dict.nav.compare}</button>
      </form>
      <div className="mt-8">
        <PremiumGate feature="compare" dict={dict} locale={locale}>
          {details.length === 2 ? (
            <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-2 text-left">
                    <th className="w-48 p-3" />
                    {details.map((d) => <th key={d.entity.id} className="p-3 font-serif text-lg"><Link href={entityPath(locale, d.entity.type, d.entity.slug)} className="hover:underline">{tr(d.entity.name, locale)}</Link></th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([label, fn]) => (
                    <tr key={label} className="border-b border-border/60 align-top last:border-0">
                      <th scope="row" className="p-3 text-left font-medium text-muted">{label}</th>
                      {details.map((d) => <td key={d.entity.id} className="p-3">{fn(d)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Notice>{es ? 'Elige dos fichas para compararlas (por ejemplo, Curcumina y EGCG).' : 'Choose two entries to compare (e.g., Curcumin and EGCG).'} <Link className="underline" href={`/${locale}/comparar?a=curcumina&b=egcg`}>Curcumina vs EGCG →</Link></Notice>
          )}
        </PremiumGate>
      </div>
    </Container>
  );
}
