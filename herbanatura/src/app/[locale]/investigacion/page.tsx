import type { Metadata } from 'next';
import { getRepository } from '@/lib/data';
import { pageContext } from '@/lib/i18n/server';
import { Container, ExternalLink, Notice, SectionTitle } from '@/components/ui';
import { PremiumGate } from '@/components/premium/PremiumGate';
import { ResearchExplorer } from '@/components/research/ResearchExplorer';

export const metadata: Metadata = { title: 'Investigación' };

export default async function ResearchPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string }> }) {
  const { locale, dict } = await pageContext(params);
  const { q } = await searchParams;
  const es = locale === 'es';
  const studies = await getRepository().listStudies({ limit: 50 });
  return (
    <Container className="py-10">
      <h1 className="font-serif text-4xl font-semibold">🔬 {es ? 'Modo investigador' : 'Researcher mode'}</h1>
      <p className="mt-2 max-w-3xl text-muted">
        {es
          ? 'Explora estudios, ensayos clínicos, revisiones, metaanálisis y estudios preclínicos. Este contenido es técnico y está separado de la información para el público general.'
          : 'Explore studies, clinical trials, reviews, meta-analyses and preclinical studies. This content is technical and kept separate from general-public information.'}
      </p>
      <div className="mt-4"><Notice tone="info">{dict.modes.researcherNotice}</Notice></div>

      <SectionTitle sub={es ? 'Estudios incorporados y revisados por el equipo editorial, con su ficha completa.' : 'Studies added and reviewed by the editorial team, with full record.'}>
        📚 {es ? 'Base HerbaNatura' : 'HerbaNatura database'}
      </SectionTitle>
      {studies.length ? (
        <ul className="space-y-2">
          {studies.map((s) => (
            <li key={s.id} className="rounded-xl border border-border bg-surface p-3 text-sm">
              <ExternalLink href={s.url}>{s.title}</ExternalLink>
              <p className="text-xs text-muted">{s.authors.slice(0, 3).join(', ')} · {s.journal} · {s.year} · {dict.studyTypes[s.type]}{s.sampleSize ? ` · n=${s.sampleSize}` : ''}</p>
            </li>
          ))}
        </ul>
      ) : (
        <Notice>
          {es
            ? 'Aún no hay estudios incorporados. Por política editorial no se escriben estudios a mano: se importan desde PubMed o ClinicalTrials.gov y pasan por revisión humana antes de publicarse.'
            : 'No studies added yet. By editorial policy studies are never hand-written: they are imported from PubMed or ClinicalTrials.gov and human-reviewed before publication.'}
        </Notice>
      )}

      <SectionTitle sub={es ? 'Consulta en vivo de fuentes bibliográficas públicas.' : 'Live query of public bibliographic sources.'}>🌐 {es ? 'Literatura científica' : 'Scientific literature'}</SectionTitle>
      <PremiumGate feature="advanced_research" dict={dict} locale={locale}>
        <ResearchExplorer initial={q?.slice(0, 300)} />
      </PremiumGate>
    </Container>
  );
}
