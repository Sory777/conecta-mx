import type { Metadata } from 'next';
import { EVIDENCE_CATEGORIES, EVIDENCE_LEVELS, REVIEW_STATUSES } from '@/lib/domain/types';
import { pageContext } from '@/lib/i18n/server';
import { Container, Notice, SectionTitle } from '@/components/ui';
import { LevelBadge } from '@/components/evidence/badges';

export const metadata: Metadata = { title: 'Niveles de evidencia' };

const DESC = {
  es: {
    A: 'Varios ensayos clínicos de calidad y/o revisiones sistemáticas concordantes en humanos.',
    B: 'Algunos ensayos en humanos con limitaciones de tamaño, duración o calidad.',
    C: 'Estudios piloto, ensayos pequeños o no aleatorizados.',
    D: 'Cohortes y casos y controles: muestran asociación, no causalidad.',
    E: 'Sólo estudios en células y/o animales.',
    F: 'Uso documentado sin evidencia clínica suficiente.',
    X: 'Datos escasos, de baja calidad o con resultados opuestos; incluye evidencia negativa.',
  },
  en: {
    A: 'Several good-quality clinical trials and/or concordant systematic reviews in humans.',
    B: 'Some human trials with limitations in size, duration or quality.',
    C: 'Pilot studies, small or non-randomized trials.',
    D: 'Cohort and case-control studies: association, not causation.',
    E: 'Only cell and/or animal studies.',
    F: 'Documented use without sufficient clinical evidence.',
    X: 'Scarce, low-quality or conflicting data; includes negative evidence.',
  },
};

const RULES = {
  es: ['Nunca inventamos estudios, resultados, fuentes, DOI ni propiedades medicinales.', 'Un resultado en células o animales nunca se presenta como eficacia en humanos.', 'Un uso tradicional nunca se presenta como prueba clínica.', 'Nunca aconsejamos abandonar, retrasar o sustituir un tratamiento.', 'El nivel describe la naturaleza de la evidencia; no dice que una planta sea “mejor”.', 'Ningún anunciante puede modificar una clasificación.', 'El contenido médico generado por IA no se publica sin revisión humana.'],
  en: ['We never invent studies, results, sources, DOIs or medicinal properties.', 'A cell or animal result is never presented as efficacy in humans.', 'A traditional use is never presented as clinical proof.', 'We never advise stopping, delaying or replacing treatment.', 'The level describes the nature of the evidence; it does not say a plant is “better”.', 'No advertiser can change a rating.', 'AI-generated medical content is not published without human review.'],
};

export default async function EvidencePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, dict } = await pageContext(params);
  return (
    <Container className="py-10">
      <h1 className="font-serif text-4xl font-semibold">{dict.nav.evidence}</h1>
      <p className="mt-2 max-w-3xl text-muted">{locale === 'es' ? 'Un sistema transparente para explicar la calidad y la naturaleza de la evidencia — y para aprender a distinguir la ciencia de las afirmaciones sin respaldo.' : 'A transparent system to explain the quality and nature of evidence — and to learn to tell science from unsupported claims.'}</p>
      <SectionTitle>{locale === 'es' ? 'Niveles' : 'Levels'}</SectionTitle>
      <ul className="space-y-3">
        {EVIDENCE_LEVELS.map((l) => (
          <li key={l} className="rounded-xl border border-border bg-surface p-4">
            <LevelBadge level={l} dict={dict} />
            <p className="mt-1 text-sm text-muted">{DESC[locale][l]}</p>
          </li>
        ))}
      </ul>
      <SectionTitle>{locale === 'es' ? 'Naturaleza de la evidencia' : 'Nature of the evidence'}</SectionTitle>
      <ul className="grid gap-2 sm:grid-cols-3">{EVIDENCE_CATEGORIES.map((c) => <li key={c} className="rounded-xl bg-surface-2 px-3 py-2 text-sm">{dict.categories[c]}</li>)}</ul>
      <SectionTitle>{locale === 'es' ? 'Contextos (nunca se mezclan)' : 'Contexts (never mixed)'}</SectionTitle>
      <ul className="grid gap-2 sm:grid-cols-2">
        {(['prevention', 'research', 'complementary', 'cancer_treatment'] as const).map((c) => <li key={c} className="rounded-xl border border-border bg-surface p-3 text-sm"><span className="font-semibold">{dict.contexts[c]}</span> — {dict.contextHelp[c]}</li>)}
      </ul>
      <SectionTitle>{locale === 'es' ? 'Estados de revisión' : 'Review states'}</SectionTitle>
      <ul className="flex flex-wrap gap-2">{REVIEW_STATUSES.map((s) => <li key={s} className="rounded-full bg-surface-2 px-3 py-1 text-sm">{dict.review[s]}</li>)}</ul>
      <SectionTitle>{locale === 'es' ? 'Reglas absolutas' : 'Absolute rules'}</SectionTitle>
      <Notice tone="accent"><ul className="list-disc space-y-1 pl-5">{RULES[locale].map((r) => <li key={r}>{r}</li>)}</ul></Notice>
    </Container>
  );
}
