import type { Metadata } from 'next';
import Link from 'next/link';
import { getRepository } from '@/lib/data';
import { pageContext } from '@/lib/i18n/server';
import { tr } from '@/lib/i18n/text';
import { Container, Notice, SectionTitle } from '@/components/ui';
import { InteractionsTable } from '@/components/entity/InteractionsTable';

export const metadata: Metadata = { title: 'Interacciones' };

const TEXT = {
  es: {
    title: '💊 Interacciones con medicamentos',
    intro: 'Consulta qué plantas, hongos, alimentos o compuestos tienen interacciones registradas con un medicamento, o al revés. Sólo mostramos interacciones con fuente; si no hay registro, lo decimos: “Información insuficiente”.',
    byMed: 'Por medicamento',
    byAgent: 'Por planta o producto natural',
    choose: 'Elige un medicamento',
    chooseAgent: 'Elige una planta o producto',
    legend: 'Tipos: documentada (descrita en fuentes) · posible (señales o reportes) · teórica (por mecanismo) · información insuficiente.',
    absent: 'La ausencia de una interacción en esta lista NO significa que la combinación sea segura.',
  },
  en: {
    title: '💊 Drug interactions',
    intro: 'Find which plants, mushrooms, foods or compounds have recorded interactions with a medicine, or vice versa. We only show interactions with a source; when there is no record we say so: “Insufficient information”.',
    byMed: 'By medicine',
    byAgent: 'By plant or natural product',
    choose: 'Choose a medicine',
    chooseAgent: 'Choose a plant or product',
    legend: 'Types: documented (described in sources) · possible (signals or reports) · theoretical (mechanism-based) · insufficient information.',
    absent: 'A combination missing from this list is NOT necessarily safe.',
  },
};

export default async function InteractionsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ med?: string; agente?: string }> }) {
  const { locale, dict } = await pageContext(params);
  const sp = await searchParams;
  const t = TEXT[locale];
  const repo = getRepository();
  const { items: meds } = await repo.listEntities({ type: 'medication' });
  const all = await repo.listInteractions({});
  const agents = [...new Map(all.map((i) => [i.agent.slug, i.agent])).values()].sort((a, b) => a.name.es.localeCompare(b.name.es));
  const med = meds.find((m) => m.slug === sp.med);
  const agent = agents.find((a) => a.slug === sp.agente);
  const chip = (active: boolean) => `rounded-full border px-3 py-1 text-sm ${active ? 'border-accent bg-accent text-white' : 'border-border bg-surface hover:border-accent'}`;

  return (
    <Container className="py-10">
      <h1 className="font-serif text-4xl font-semibold">{t.title}</h1>
      <p className="mt-2 max-w-3xl text-muted">{t.intro}</p>
      <div className="mt-4 space-y-2">
        <Notice tone="warn">{dict.disclaimers.stopTreatment}</Notice>
        <p className="text-xs text-muted">{t.legend}</p>
      </div>

      <SectionTitle>{t.byMed}</SectionTitle>
      <div className="flex flex-wrap gap-2">
        {meds.map((m) => (
          <Link key={m.slug} href={`/${locale}/interacciones?med=${m.slug}`} className={chip(med?.slug === m.slug)}>
            {tr(m.name, locale)}
          </Link>
        ))}
      </div>
      {med && (
        <div className="mt-4">
          <h3 className="mb-3 text-lg font-semibold">{tr(med.name, locale)}</h3>
          <InteractionsTable items={all.filter((i) => i.medication.slug === med.slug)} dict={dict} locale={locale} perspective="medication" />
          <p className="mt-3 text-sm text-muted">{t.absent}</p>
        </div>
      )}

      <SectionTitle>{t.byAgent}</SectionTitle>
      <div className="flex flex-wrap gap-2">
        {agents.map((a) => (
          <Link key={a.slug} href={`/${locale}/interacciones?agente=${a.slug}`} className={chip(agent?.slug === a.slug)}>
            {tr(a.name, locale)}
          </Link>
        ))}
      </div>
      {agent && (
        <div className="mt-4">
          <h3 className="mb-3 text-lg font-semibold">{tr(agent.name, locale)}</h3>
          <InteractionsTable items={all.filter((i) => i.agent.slug === agent.slug)} dict={dict} locale={locale} perspective="agent" />
          <p className="mt-3 text-sm text-muted">{t.absent}</p>
        </div>
      )}
    </Container>
  );
}
