import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getRepository } from '@/lib/data';
import { pageContext } from '@/lib/i18n/server';
import { tr } from '@/lib/i18n/text';
import { Container, ExternalLink, Notice, SectionTitle } from '@/components/ui';
import { EntityCard } from '@/components/entity/EntityCard';

export const revalidate = 3600;
export const generateStaticParams = () => [];

type Props = { params: Promise<{ locale: string; estado: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { estado } = await params;
  const r = await getRepository().getRegion(estado);
  return { title: r ? `Plantas medicinales — ${r.name.es}` : 'México' };
}

const TEXT = {
  es: {
    municipalities: 'Municipios',
    recorded: 'Plantas con registro en este estado',
    none: 'Aún no hay plantas con registro verificado para este estado. El inventario estatal está en construcción.',
    mexican: 'Plantas registradas a nivel nacional (presencia en el estado por verificar)',
    gbif: 'Verifica la presencia de cada especie en el estado con los registros de ocurrencia de GBIF:',
    gbifLink: 'registros en GBIF',
    contribute: 'Los registros municipales sólo se publican con fuente etnobotánica específica y revisión humana.',
  },
  en: {
    municipalities: 'Municipalities',
    recorded: 'Plants recorded in this state',
    none: 'No plants with a verified record for this state yet. The state inventory is under construction.',
    mexican: 'Plants recorded nationally (presence in the state to be verified)',
    gbif: 'Check each species’ presence in the state with GBIF occurrence records:',
    gbifLink: 'GBIF records',
    contribute: 'Municipal records are only published with a specific ethnobotanical source and human review.',
  },
};

export default async function StatePage({ params }: Props) {
  const { estado } = await params;
  const { locale, dict } = await pageContext(params);
  const t = TEXT[locale];
  const repo = getRepository();
  const region = await repo.getRegion(estado);
  if (!region || region.parentSlug !== 'mexico') notFound();
  const name = tr(region.name, locale);
  const municipalities = await repo.listRegions({ parentSlug: estado, level: 'municipality' });
  const { items: inState } = await repo.listEntities({ region: estado, limit: 500 });
  const { items: national } = await repo.listEntities({ region: 'mexico', type: 'plant', limit: 500 });
  return (
    <Container className="py-10">
      <nav className="text-sm text-muted">
        <Link href={`/${locale}/mexico`} className="hover:underline">🇲🇽 México</Link> / {name}
      </nav>
      <h1 className="mt-2 font-serif text-4xl font-semibold">{name}</h1>
      <p className="text-sm text-muted">INEGI {region.code}</p>

      <SectionTitle>{t.recorded}</SectionTitle>
      {inState.length ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {inState.map((i) => <li key={i.id}><EntityCard item={i} dict={dict} locale={locale} /></li>)}
        </ul>
      ) : (
        <Notice>{t.none}</Notice>
      )}

      {municipalities.length > 0 && (
        <>
          <SectionTitle sub={t.contribute}>{t.municipalities} ({municipalities.length})</SectionTitle>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {municipalities.map((m) => (
              <li key={m.slug} className="rounded-xl border border-border bg-surface px-3 py-2 text-sm">
                {tr(m.name, locale)}
                <span className="block text-xs text-muted">{dict.entity.pending}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <SectionTitle sub={t.gbif}>{t.mexican}</SectionTitle>
      <ul className="grid gap-2 sm:grid-cols-2">
        {national.filter((p) => !inState.some((s) => s.id === p.id)).map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm">
            <Link href={`/${locale}/plantas/${p.slug}`} className="font-medium hover:underline">
              {tr(p.name, locale)} <span className="sci text-muted">{p.scientificName}</span>
            </Link>
            {p.scientificName && !p.scientificName.includes('spp.') && (
              <ExternalLink className="text-xs" href={`https://www.gbif.org/occurrence/search?q=${encodeURIComponent(p.scientificName.split(' ').slice(0, 2).join(' '))}&country=MX&state_province=${encodeURIComponent(region.name.es)}`}>
                {t.gbifLink}
              </ExternalLink>
            )}
          </li>
        ))}
      </ul>
    </Container>
  );
}
