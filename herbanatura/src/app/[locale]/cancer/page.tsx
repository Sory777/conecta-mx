import type { Metadata } from 'next';
import Link from 'next/link';
import type { ClaimContext, EntityType } from '@/lib/domain/types';
import { getRepository } from '@/lib/data';
import { pageContext } from '@/lib/i18n/server';
import { tr } from '@/lib/i18n/text';
import { Container, Notice } from '@/components/ui';
import { ClaimsByContext } from '@/components/evidence/ClaimCard';
import { SearchBox } from '@/components/search/SearchBox';

export const metadata: Metadata = { title: 'Naturaleza y cáncer' };

const CONTEXTS: ClaimContext[] = ['prevention', 'research', 'complementary', 'cancer_treatment'];
const TYPES: EntityType[] = ['plant', 'mushroom', 'food', 'compound'];

const TEXT = {
  es: {
    title: '🧬 Naturaleza y cáncer',
    intro:
      'Qué se ha investigado sobre plantas, hongos, alimentos y compuestos naturales en relación con el cáncer — separando prevención, investigación experimental, tratamiento complementario y tratamiento del cáncer.',
    cancerType: 'Tipo de cáncer',
    source: 'Origen',
    context: 'Contexto',
    none: 'No hay afirmaciones registradas con estos filtros. La ausencia de datos no es evidencia de eficacia ni de ineficacia.',
    howTo: 'Cómo leer este módulo',
    bullets: [
      'Un resultado en células (🧫) o animales (🐁) NO demuestra que algo trate el cáncer en personas.',
      'La prevención se basa a menudo en estudios observacionales (🔵): muestran asociación, no causa.',
      '“Complementario” significa junto con el tratamiento médico, nunca en su lugar.',
      'Algunos productos naturales interfieren con la quimioterapia u otros fármacos: consulta la sección Interacciones.',
    ],
  },
  en: {
    title: '🧬 Nature and cancer',
    intro:
      'What has been researched about plants, mushrooms, foods and natural compounds in relation to cancer — separating prevention, experimental research, complementary treatment and cancer treatment.',
    cancerType: 'Cancer type',
    source: 'Source',
    context: 'Context',
    none: 'No claims recorded with these filters. Absence of data is not evidence of efficacy or inefficacy.',
    howTo: 'How to read this module',
    bullets: [
      'A result in cells (🧫) or animals (🐁) does NOT show that something treats cancer in people.',
      'Prevention often relies on observational studies (🔵): they show association, not causation.',
      '“Complementary” means alongside medical treatment, never instead of it.',
      'Some natural products interfere with chemotherapy or other drugs: see Interactions.',
    ],
  },
};

type SP = { tipo?: string; origen?: string; ctx?: string };

export default async function CancerPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale, dict } = await pageContext(params);
  const sp = await searchParams;
  const t = TEXT[locale];
  const repo = getRepository();
  const { items: conditions } = await repo.listEntities({ type: 'condition', limit: 1000 });
  const cancers = conditions.filter((c) => c.hint === 'cancer');
  const selected = cancers.find((c) => c.slug === sp.tipo);
  const origin = TYPES.find((x) => x === sp.origen);
  const ctx = CONTEXTS.find((x) => x === sp.ctx);

  let claims = await repo.listClaims({ cancerOnly: !selected, conditionIds: selected ? [selected.id, ...cancers.filter((c) => c.slug === 'cancer').map((c) => c.id)] : undefined, contexts: ctx ? [ctx] : CONTEXTS.concat('safety') });
  // Also include supportive-care claims (e.g. chemo-induced nausea) under the general view
  if (!selected) {
    const support = conditions.filter((c) => c.parentSlug === 'cancer' && c.hint !== 'cancer').map((c) => c.id);
    if (support.length) claims = claims.concat(await repo.listClaims({ conditionIds: support, contexts: ctx ? [ctx] : undefined }));
  }
  if (origin) claims = claims.filter((c) => c.subject.type === origin);

  const href = (patch: Partial<SP>) => {
    const next = { ...sp, ...patch };
    const qs = Object.entries(next).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v!)}`).join('&');
    return `/${locale}/cancer${qs ? `?${qs}` : ''}`;
  };
  const chip = (active: boolean) => `rounded-full border px-3 py-1 text-sm ${active ? 'border-accent bg-accent text-white' : 'border-border bg-surface hover:border-accent'}`;

  return (
    <Container className="py-10">
      <h1 className="font-serif text-4xl font-semibold">{t.title}</h1>
      <p className="mt-2 max-w-3xl text-muted">{t.intro}</p>
      <div className="mt-6">
        <Notice tone="warn" title="⚠️">
          {dict.disclaimers.cancer}
        </Notice>
      </div>

      <div className="mt-6 max-w-2xl">
        <SearchBox />
      </div>

      <div className="mt-6 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-32 text-sm font-medium text-muted">{t.context}</span>
          <Link href={href({ ctx: undefined })} className={chip(!ctx)}>{dict.common.all}</Link>
          {CONTEXTS.map((c) => (
            <Link key={c} href={href({ ctx: c })} className={chip(ctx === c)}>{dict.contexts[c]}</Link>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-32 text-sm font-medium text-muted">{t.cancerType}</span>
          <Link href={href({ tipo: undefined })} className={chip(!selected)}>{dict.common.all}</Link>
          {cancers.filter((c) => c.slug !== 'cancer').map((c) => (
            <Link key={c.slug} href={href({ tipo: c.slug })} className={chip(selected?.slug === c.slug)}>{tr(c.name, locale)}</Link>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-32 text-sm font-medium text-muted">{t.source}</span>
          <Link href={href({ origen: undefined })} className={chip(!origin)}>{dict.common.all}</Link>
          {TYPES.map((x) => (
            <Link key={x} href={href({ origen: x })} className={chip(origin === x)}>{dict.typesPlural[x]}</Link>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_300px]">
        <div>{claims.length ? <ClaimsByContext claims={claims} dict={dict} locale={locale} showSubject /> : <Notice>{t.none}</Notice>}</div>
        <aside className="h-fit rounded-2xl border border-border bg-surface-2 p-5 text-sm lg:sticky lg:top-28">
          <h2 className="font-serif text-lg font-semibold">{t.howTo}</h2>
          <ul className="mt-2 list-disc space-y-2 pl-5">
            {t.bullets.map((b) => <li key={b}>{b}</li>)}
          </ul>
          <Link href={`/${locale}/interacciones`} className="mt-4 inline-block text-accent underline">💊 {dict.nav.interactions} →</Link>
        </aside>
      </div>
    </Container>
  );
}
