import Link from 'next/link';
import { Container, Notice } from '@/components/ui';
import { SearchBox } from '@/components/search/SearchBox';
import { LevelBadge } from '@/components/evidence/badges';
import { getRepository } from '@/lib/data';
import { EVIDENCE_LEVELS } from '@/lib/domain/types';
import { pageContext } from '@/lib/i18n/server';

export const revalidate = 3600;

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, dict } = await pageContext(params);
  const repo = getRepository();
  const stats = await repo.stats();
  const l = (p: string) => `/${locale}${p}`;
  const modules: [string, string, string, string][] = [
    ['/plantas', '🌿', dict.nav.plants, `${stats.entities.plant}`],
    ['/hongos', '🍄', dict.nav.mushrooms, `${stats.entities.mushroom}`],
    ['/alimentos', '🥦', dict.nav.foods, `${stats.entities.food}`],
    ['/compuestos', '⚗️', dict.nav.compounds, `${stats.entities.compound}`],
    ['/cancer', '🧬', dict.nav.cancer, ''],
    ['/investigacion', '🔬', dict.nav.research, 'PubMed · ClinicalTrials.gov'],
    ['/interacciones', '💊', dict.nav.interactions, `${stats.interactions}`],
    ['/identificar', '📷', dict.nav.identify, ''],
    ['/mexico', '🇲🇽', dict.nav.mexico, '32 + Guanajuato'],
    ['/seguridad', '⚠️', dict.nav.safety, ''],
    ['/herba-ai', '🤖', dict.nav.ai, ''],
    ['/medicina-tradicional', '🌎', dict.nav.traditional, `${stats.traditionalUses}`],
  ];
  const examples = locale === 'es'
    ? ['curcumina cáncer colon', '¿Qué plantas pueden interactuar con warfarina?', 'hongos estudiados en oncología', 'alimentos relacionados con prevención del cáncer', 'manzanilla', 'Reishi']
    : ['curcumin colon cancer', 'warfarin', 'mushrooms oncology', 'broccoli', 'chamomile', 'reishi'];

  return (
    <>
      <section className="leaf-pattern hero-bg text-white">
        <Container className="py-14 sm:py-20">
          <p className="text-sm uppercase tracking-[0.2em] text-white/70">🌿 {dict.home.heroTitle}</p>
          <h1 className="mt-3 max-w-3xl font-serif text-4xl font-semibold leading-tight sm:text-5xl">{dict.meta.tagline}</h1>
          <p className="mt-4 max-w-2xl text-lg text-white/85">{dict.home.heroSub}</p>
          <div className="mt-8 max-w-3xl text-text">
            <SearchBox size="lg" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <span className="text-white/70">{dict.search.examples}:</span>
            {examples.map((e) => (
              <Link key={e} href={l(`/buscar?q=${encodeURIComponent(e)}`)} className="rounded-full bg-white/10 px-3 py-1 hover:bg-white/20">
                {e}
              </Link>
            ))}
          </div>
        </Container>
      </section>

      <Container className="py-10">
        <nav aria-label={dict.home.explore}>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {modules.map(([href, icon, label, meta]) => (
              <li key={href}>
                <Link href={l(href)} className="flex h-full items-center gap-3 rounded-2xl border border-border bg-surface p-4 transition hover:-translate-y-0.5 hover:border-accent hover:shadow-md">
                  <span aria-hidden className="text-3xl">
                    {icon}
                  </span>
                  <span>
                    <span className="block font-semibold">{label}</span>
                    {meta && <span className="block text-xs text-muted">{meta}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <section className="mt-12 grid gap-4 md:grid-cols-4">
          {dict.home.pillars.map(([icon, title, body]) => (
            <div key={title} className="rounded-2xl bg-surface-2 p-5">
              <p className="text-2xl" aria-hidden>
                {icon}
              </p>
              <h2 className="mt-2 font-serif text-lg font-semibold">{title}</h2>
              <p className="mt-1 text-sm text-muted">{body}</p>
            </div>
          ))}
        </section>

        <section className="mt-12 rounded-2xl border border-border bg-surface p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-serif text-2xl font-semibold">{dict.home.howToRead}</h2>
            <Link href={l('/evidencia')} className="text-sm text-accent underline">
              {dict.nav.evidence} →
            </Link>
          </div>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {EVIDENCE_LEVELS.map((lv) => (
              <li key={lv}>
                <LevelBadge level={lv} dict={dict} />
              </li>
            ))}
          </ul>
        </section>

        {repo.mode === 'seed' && (
          <div className="mt-8">
            <Notice tone="warn" title={dict.common.demoData}>
              {dict.entity.demoNotice}
            </Notice>
          </div>
        )}
      </Container>
    </>
  );
}
