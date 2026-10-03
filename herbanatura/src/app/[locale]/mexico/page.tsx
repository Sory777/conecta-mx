import type { Metadata } from 'next';
import Link from 'next/link';
import { getRepository } from '@/lib/data';
import { pageContext } from '@/lib/i18n/server';
import { tr } from '@/lib/i18n/text';
import { Container, Notice, SectionTitle } from '@/components/ui';
import { EntityCard } from '@/components/entity/EntityCard';

export const revalidate = 3600;
export const metadata: Metadata = { title: 'Plantas medicinales de México' };

const TEXT = {
  es: {
    title: '🇲🇽 Plantas medicinales de México',
    intro: 'México es uno de los países con mayor diversidad de plantas medicinales y de tradiciones de uso. Organizamos la información por estado y municipio cuando existe documentación confiable, y siempre separamos el uso tradicional de la evidencia científica.',
    states: 'Estados',
    priority: 'Prioridad: Guanajuato',
    plants: 'Plantas registradas en México',
    method: 'Cómo se construye este inventario',
    methodBody: 'Cada registro necesita nombre científico verificado (POWO/EncicloVida), uso tradicional con fuente etnobotánica (p. ej. Biblioteca Digital de la Medicina Tradicional Mexicana, UNAM), pueblo o cultura cuando esté documentado, y revisión humana. Los registros sin fuente específica aparecen como “Pendiente de investigación/verificación”.',
  },
  en: {
    title: '🇲🇽 Medicinal plants of Mexico',
    intro: 'Mexico is one of the most diverse countries in medicinal plants and traditions of use. We organize information by state and municipality when reliable documentation exists, always separating traditional use from scientific evidence.',
    states: 'States',
    priority: 'Priority: Guanajuato',
    plants: 'Plants recorded in Mexico',
    method: 'How this inventory is built',
    methodBody: 'Each record needs a verified scientific name (POWO/EncicloVida), traditional use with an ethnobotanical source (e.g. UNAM Digital Library of Traditional Mexican Medicine), people or culture when documented, and human review. Records without a specific source appear as “Pending research/verification”.',
  },
};

export default async function MexicoPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, dict } = await pageContext(params);
  const t = TEXT[locale];
  const repo = getRepository();
  const states = await repo.listRegions({ parentSlug: 'mexico', level: 'state' });
  const { items } = await repo.listEntities({ region: 'mexico', limit: 500 });
  return (
    <Container className="py-10">
      <h1 className="font-serif text-4xl font-semibold">{t.title}</h1>
      <p className="mt-2 max-w-3xl text-muted">{t.intro}</p>

      <Link href={`/${locale}/mexico/guanajuato`} className="mt-6 block rounded-2xl border border-accent bg-accent-soft p-5 hover:shadow-md">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent-strong">{t.priority}</p>
        <p className="mt-1 font-serif text-2xl font-semibold">Guanajuato →</p>
        <p className="text-sm text-muted">46 {locale === 'es' ? 'municipios' : 'municipalities'}</p>
      </Link>

      <SectionTitle>{t.states}</SectionTitle>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {states.map((s) => (
          <li key={s.slug}>
            <Link href={`/${locale}/mexico/${s.slug}`} className="block rounded-xl border border-border bg-surface px-3 py-2 text-sm hover:border-accent">
              <span className="font-mono text-xs text-muted">{s.code}</span> {tr(s.name, locale)}
            </Link>
          </li>
        ))}
      </ul>

      <SectionTitle>{t.plants}</SectionTitle>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((i) => (
          <li key={i.id}>
            <EntityCard item={i} dict={dict} locale={locale} />
          </li>
        ))}
      </ul>

      <div className="mt-10">
        <Notice tone="info" title={t.method}>
          {t.methodBody}
        </Notice>
      </div>
    </Container>
  );
}
