import type { EntityType, Locale } from '@/lib/domain/types';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { getRepository } from '@/lib/data';
import { Container, Notice } from '@/components/ui';
import { EntityCard } from '@/components/entity/EntityCard';
import { SearchBox } from '@/components/search/SearchBox';

const INTRO: Partial<Record<EntityType, { es: string; en: string }>> = {
  plant: {
    es: 'Cada ficha separa nombre, identidad botánica, uso tradicional documentado, evidencia científica graduada y seguridad.',
    en: 'Each entry separates name, botanical identity, documented traditional use, graded scientific evidence and safety.',
  },
  mushroom: {
    es: 'Hongos medicinales y alimenticios, separados claramente de las especies tóxicas y mortales. Nunca consumas hongos silvestres sin identificación experta presencial.',
    en: 'Medicinal and edible mushrooms, clearly separated from toxic and deadly species. Never eat wild mushrooms without in-person expert identification.',
  },
  food: {
    es: 'Alimentos, sus nutrientes y compuestos bioactivos, y lo que dicen los estudios epidemiológicos y clínicos — incluido lo que NO se ha demostrado.',
    en: 'Foods, their nutrients and bioactive compounds, and what epidemiological and clinical studies say — including what has NOT been shown.',
  },
  compound: {
    es: 'Base de datos de compuestos naturales: fórmula, fuentes naturales, evidencia, biodisponibilidad, riesgos e interacciones. No inventamos mecanismos.',
    en: 'Natural compound database: formula, natural sources, evidence, bioavailability, risks and interactions. We never invent mechanisms.',
  },
  condition: { es: 'Enfermedades y síntomas con la evidencia registrada para cada uno.', en: 'Diseases and symptoms with the evidence recorded for each.' },
  medication: { es: 'Medicamentos y sus interacciones registradas con productos naturales.', en: 'Medicines and their recorded interactions with natural products.' },
};

export async function EntityListPage({ type, locale, dict }: { type: EntityType; locale: Locale; dict: Dictionary }) {
  const { items, total } = await getRepository().listEntities({ type, limit: 500 });
  const groups =
    type === 'mushroom'
      ? [
          { title: locale === 'es' ? 'Medicinales y comestibles' : 'Medicinal and edible', items: items.filter((i) => !['toxic', 'deadly'].includes(i.hint ?? '')) },
          { title: locale === 'es' ? '☠️ Tóxicos y mortales — sólo para prevención' : '☠️ Toxic and deadly — for prevention only', items: items.filter((i) => ['toxic', 'deadly'].includes(i.hint ?? '')), danger: true },
        ]
      : [{ title: '', items }];
  return (
    <Container className="py-10">
      <h1 className="font-serif text-4xl font-semibold">{dict.typesPlural[type]}</h1>
      <p className="mt-2 max-w-3xl text-muted">{INTRO[type]?.[locale]}</p>
      <p className="mt-1 text-sm text-muted">{total} {locale === 'es' ? 'fichas' : 'entries'}</p>
      <div className="mt-6 max-w-2xl">
        <SearchBox />
      </div>
      {groups.map((g) => (
        <section key={g.title} className="mt-8">
          {g.title && <h2 className={`mb-3 font-serif text-2xl font-semibold ${'danger' in g ? 'text-danger' : ''}`}>{g.title}</h2>}
          {'danger' in g && (
            <div className="mb-4">
              <Notice tone="danger">{INTRO.mushroom![locale]}</Notice>
            </div>
          )}
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {g.items.map((item) => (
              <li key={item.id}>
                <EntityCard item={item} dict={dict} locale={locale} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </Container>
  );
}
