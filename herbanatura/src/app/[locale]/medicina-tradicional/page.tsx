import type { Metadata } from 'next';
import Link from 'next/link';
import { getRepository } from '@/lib/data';
import { entityPath } from '@/lib/i18n/config';
import { pageContext } from '@/lib/i18n/server';
import { tr } from '@/lib/i18n/text';
import { Container, Notice, Pill } from '@/components/ui';

export const revalidate = 3600;
export const metadata: Metadata = { title: 'Medicina tradicional' };

const ORDER = ['mexico', 'america-latina', 'pueblos-indigenas', 'america-del-norte', 'asia', 'ayurveda', 'medicina-tradicional-china', 'africa', 'europa', 'medio-oriente', 'tradiciones-historicas', 'grecorromana'];

const TEXT = {
  es: {
    title: '🌎 Medicina tradicional',
    intro: 'Usos tradicionales documentados por región, pueblo o tradición medicinal, con su fuente. Un uso tradicional es conocimiento cultural valioso, pero no es una prueba clínica de eficacia ni de seguridad.',
    empty: 'Sin registros todavía.',
  },
  en: {
    title: '🌎 Traditional medicine',
    intro: 'Documented traditional uses by region, people or medical tradition, with their source. A traditional use is valuable cultural knowledge, but it is not clinical proof of efficacy or safety.',
    empty: 'No records yet.',
  },
};

export default async function TraditionalPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, dict } = await pageContext(params);
  const t = TEXT[locale];
  const repo = getRepository();
  const uses = await repo.listTraditionalUses({});
  const regions = (await repo.listRegions()).filter((r) => ORDER.includes(r.slug)).sort((a, b) => ORDER.indexOf(a.slug) - ORDER.indexOf(b.slug));
  return (
    <Container className="py-10">
      <h1 className="font-serif text-4xl font-semibold">{t.title}</h1>
      <p className="mt-2 max-w-3xl text-muted">{t.intro}</p>
      <div className="mt-4">
        <Notice tone="warn">{dict.entity.traditionalNotice}</Notice>
      </div>
      <nav className="mt-6 flex flex-wrap gap-2">
        {regions.map((r) => (
          <a key={r.slug} href={`#${r.slug}`} className="rounded-full border border-border bg-surface px-3 py-1 text-sm hover:border-accent">
            {tr(r.name, locale)}
          </a>
        ))}
      </nav>
      <div className="mt-8 space-y-10">
        {regions.map((r) => {
          const list = uses.filter((u) => u.regionSlug === r.slug);
          return (
            <section key={r.slug} id={r.slug} className="scroll-mt-28">
              <h2 className="font-serif text-2xl font-semibold">{tr(r.name, locale)}</h2>
              {list.length ? (
                <ul className="mt-3 grid gap-3 md:grid-cols-2">
                  {list.map((u) => (
                    <li key={u.id} className="rounded-2xl border border-border bg-surface p-4 text-sm">
                      <Link href={entityPath(locale, u.entity.type, u.entity.slug)} className="font-serif text-lg font-semibold hover:underline">
                        {tr(u.entity.name, locale)}
                      </Link>
                      {u.entity.scientificName && <span className="sci ml-2 text-muted">{u.entity.scientificName}</span>}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {u.culture && <Pill>{u.culture}</Pill>}
                        <Pill tone={u.documentation === 'documented' ? 'accent' : 'warn'}>{u.documentation === 'documented' ? (locale === 'es' ? 'Documentado' : 'Documented') : dict.entity.pending}</Pill>
                      </div>
                      <p className="mt-2">{tr(u.use, locale)}</p>
                      <p className="mt-2 text-xs text-muted">
                        {dict.claim.source}: {u.sources.map((s) => <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer" className="underline">{s.title}</a>)}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm italic text-muted">{t.empty}</p>
              )}
            </section>
          );
        })}
      </div>
    </Container>
  );
}
