import type { Metadata } from 'next';
import Link from 'next/link';
import { pageContext } from '@/lib/i18n/server';
import { Container, ExternalLink, Notice, Pill, SectionTitle } from '@/components/ui';
import { SOURCE_BY_ID } from '@/data/seed/sources';

export const metadata: Metadata = { title: 'Prevención y estilo de vida' };

type Strength = 'cause' | 'associated' | 'pending';
type Item = { icon: string; title: [string, string]; strength: Strength; body: [string, string]; sources: string[] };

/** Each statement paraphrases the linked WHO/IARC/NCI page and is pending human review. */
const ITEMS: Item[] = [
  { icon: '🚭', title: ['Tabaco', 'Tobacco'], strength: 'cause', body: ['El consumo de tabaco es una causa demostrada de numerosos tipos de cáncer y otras enfermedades. Dejar de fumar reduce el riesgo a cualquier edad.', 'Tobacco use is a proven cause of many cancers and other diseases. Quitting lowers risk at any age.'], sources: ['who-tobacco', 'who-cancer'] },
  { icon: '🍷', title: ['Alcohol', 'Alcohol'], strength: 'cause', body: ['El alcohol está clasificado como carcinógeno y se relaciona causalmente con varios tipos de cáncer; el riesgo aumenta con la cantidad consumida.', 'Alcohol is classified as a carcinogen and is causally linked to several cancers; risk increases with the amount consumed.'], sources: ['who-alcohol', 'iarc-monographs'] },
  { icon: '🥩', title: ['Carne procesada y carne roja', 'Processed and red meat'], strength: 'cause', body: ['La IARC clasificó la carne procesada como carcinógena (Grupo 1) y la carne roja como probablemente carcinógena (Grupo 2A), sobre todo por el cáncer colorrectal.', 'IARC classified processed meat as carcinogenic (Group 1) and red meat as probably carcinogenic (Group 2A), mainly for colorectal cancer.'], sources: ['who-red-meat'] },
  { icon: '🥦', title: ['Alimentación con frutas y verduras', 'Diet with fruit and vegetables'], strength: 'associated', body: ['Una baja ingesta de frutas y verduras figura entre los factores de riesgo de cáncer. Para alimentos concretos (p. ej., crucíferas), los estudios en humanos son inconsistentes.', 'Low fruit and vegetable intake is among cancer risk factors. For specific foods (e.g., cruciferous vegetables), human studies are inconsistent.'], sources: ['who-cancer', 'nci-cruciferous'] },
  { icon: '🏃', title: ['Actividad física', 'Physical activity'], strength: 'associated', body: ['La inactividad física es un factor de riesgo para varias enfermedades crónicas, incluido el cáncer. La OMS publica recomendaciones de actividad por edad.', 'Physical inactivity is a risk factor for several chronic diseases, including cancer. WHO publishes activity recommendations by age.'], sources: ['who-physical-activity', 'who-cancer'] },
  { icon: '⚖️', title: ['Peso saludable', 'Healthy weight'], strength: 'associated', body: ['Un índice de masa corporal elevado se asocia con mayor riesgo de varios tipos de cáncer.', 'A high body mass index is associated with higher risk of several cancers.'], sources: ['who-cancer'] },
  { icon: '☀️', title: ['Exposición solar', 'Sun exposure'], strength: 'cause', body: ['La radiación ultravioleta es un carcinógeno reconocido para la piel. Protegerse del sol reduce el riesgo.', 'Ultraviolet radiation is a recognized skin carcinogen. Sun protection reduces risk.'], sources: ['iarc-monographs', 'nci-causes-prevention'] },
  { icon: '🏭', title: ['Factores ambientales', 'Environmental factors'], strength: 'cause', body: ['Algunos agentes ambientales y laborales (p. ej., contaminación del aire, asbesto) están clasificados como carcinógenos por la IARC.', 'Some environmental and occupational agents (e.g., air pollution, asbestos) are classified as carcinogens by IARC.'], sources: ['iarc-monographs', 'who-cancer'] },
  { icon: '😴', title: ['Sueño', 'Sleep'], strength: 'pending', body: ['Pendiente de investigación/verificación.', 'Pending research/verification.'], sources: [] },
];

const LABEL: Record<Strength, [string, string, 'danger' | 'info' | 'neutral']> = {
  cause: ['Causa establecida por organismos oficiales', 'Cause established by official bodies', 'danger'],
  associated: ['Factor asociado (no causa demostrada)', 'Associated factor (not proven cause)', 'info'],
  pending: ['Pendiente de verificación', 'Pending verification', 'neutral'],
};

export default async function PreventionPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, dict } = await pageContext(params);
  const i = locale === 'es' ? 0 : 1;
  return (
    <Container className="py-10">
      <h1 className="font-serif text-4xl font-semibold">🛡️ {locale === 'es' ? 'Prevención y estilo de vida' : 'Prevention and lifestyle'}</h1>
      <p className="mt-2 max-w-3xl text-muted">
        {locale === 'es'
          ? 'Según la OMS, una parte importante de los cánceres puede prevenirse evitando factores de riesgo. Aquí distinguimos claramente entre causa demostrada y factor asociado.'
          : 'According to WHO, a substantial share of cancers can be prevented by avoiding risk factors. Here we clearly separate proven causes from associated factors.'}
      </p>
      <div className="mt-4"><Notice tone="info">{dict.entity.demoNotice}</Notice></div>
      <SectionTitle>{locale === 'es' ? 'Factores' : 'Factors'}</SectionTitle>
      <div className="grid gap-4 md:grid-cols-2">
        {ITEMS.map((it) => (
          <article key={it.title[0]} className="rounded-2xl border border-border bg-surface p-5">
            <div className="flex items-center gap-2">
              <span className="text-2xl" aria-hidden>{it.icon}</span>
              <h3 className="font-serif text-xl font-semibold">{it.title[i]}</h3>
            </div>
            <div className="mt-2"><Pill tone={LABEL[it.strength][2]}>{LABEL[it.strength][i]}</Pill></div>
            <p className="mt-2 text-sm">{it.body[i]}</p>
            {it.sources.length > 0 && (
              <p className="mt-3 text-xs text-muted">
                📚 {it.sources.map((id) => SOURCE_BY_ID.get(id)).filter(Boolean).map((s) => <ExternalLink key={s!.id} href={s!.url} className="mr-2">{s!.title}</ExternalLink>)}
              </p>
            )}
          </article>
        ))}
      </div>
      <p className="mt-8 text-sm"><Link href={`/${locale}/cancer?ctx=prevention`} className="text-accent underline">🧬 {locale === 'es' ? 'Estudios de prevención con alimentos y plantas' : 'Prevention studies with foods and plants'} →</Link></p>
    </Container>
  );
}
