import type { Metadata } from 'next';
import Link from 'next/link';
import { getRepository } from '@/lib/data';
import { entityPath } from '@/lib/i18n/config';
import { pageContext } from '@/lib/i18n/server';
import { tr } from '@/lib/i18n/text';
import { Container, ExternalLink, Notice, SectionTitle } from '@/components/ui';

export const revalidate = 3600;
export const metadata: Metadata = { title: 'Seguridad' };

type Block = { icon: string; title: string; body: string };

const TEXT: Record<'es' | 'en', { title: string; intro: string; natural: string; blocks: Block[]; recorded: string; medGroups: string; groups: [string, string][]; emergency: string }> = {
  es: {
    title: '⚠️ Seguridad',
    intro: 'Lo natural no es automáticamente seguro. Las plantas contienen sustancias activas que pueden causar efectos adversos, intoxicaciones o interacciones con medicamentos.',
    natural: '“Natural” ≠ “seguro”',
    blocks: [
      { icon: '☠️', title: 'Toxicidad', body: 'Algunas plantas y hongos son tóxicos o mortales incluso en pequeñas cantidades. La identificación incorrecta es una causa frecuente de intoxicación.' },
      { icon: '💊', title: 'Sobredosis y concentración', body: 'Un extracto o suplemento puede contener mucha más sustancia que el alimento. La dosis y la forma (infusión, extracto, aceite esencial) cambian el riesgo.' },
      { icon: '🤧', title: 'Alergias', body: 'Las personas alérgicas a una familia botánica (p. ej., Asteraceae: ambrosía, margaritas) pueden reaccionar a plantas emparentadas como la manzanilla o la equinácea.' },
      { icon: '🤰', title: 'Embarazo y lactancia', body: 'Para la mayoría de productos naturales no hay datos suficientes de seguridad. Algunos están contraindicados. Consulta siempre antes de usarlos.' },
      { icon: '🧒', title: 'Niños', body: 'Los niños no son adultos pequeños: dosis, metabolismo y riesgos son distintos. Algunos aceites esenciales y remedios son peligrosos en la infancia.' },
      { icon: '👵', title: 'Personas mayores', body: 'Mayor probabilidad de tomar varios medicamentos (polifarmacia) y de sufrir interacciones o efectos adversos.' },
      { icon: '🫀', title: 'Enfermedades hepáticas', body: 'Varios suplementos se han asociado con daño hepático. Si tienes una enfermedad del hígado, consulta antes de usar cualquiera.' },
      { icon: '🫘', title: 'Enfermedades renales', body: 'La eliminación de sustancias puede estar alterada; algunos productos contienen minerales o compuestos que el riñón enfermo no tolera.' },
      { icon: '🔪', title: 'Cirugías', body: 'Algunos productos (p. ej., ajo en suplemento, ginkgo) pueden aumentar el riesgo de sangrado. Informa a tu equipo médico de todo lo que tomas antes de una cirugía.' },
    ],
    recorded: 'Advertencias registradas en la base',
    medGroups: 'Medicamentos especialmente sensibles a interacciones',
    groups: [
      ['Anticoagulantes', 'Pequeños cambios en su efecto pueden causar sangrados o trombosis (p. ej., warfarina).'],
      ['Medicamentos oncológicos', 'Algunas plantas reducen o aumentan la acción de la quimioterapia o de terapias dirigidas.'],
      ['Medicamentos cardiovasculares', 'Digoxina, betabloqueadores y otros tienen márgenes estrechos.'],
      ['Medicamentos psiquiátricos', 'Riesgo de síndrome serotoninérgico o pérdida de eficacia (p. ej., hipérico con antidepresivos).'],
      ['Inmunosupresores', 'Una caída de niveles puede provocar rechazo de un trasplante.'],
    ],
    emergency: 'Ante una posible intoxicación o una reacción grave, llama al 911 o acude a urgencias. En México también puedes contactar a un Centro de Información y Atención Toxicológica.',
  },
  en: {
    title: '⚠️ Safety',
    intro: 'Natural does not automatically mean safe. Plants contain active substances that can cause side effects, poisoning or drug interactions.',
    natural: '“Natural” ≠ “safe”',
    blocks: [
      { icon: '☠️', title: 'Toxicity', body: 'Some plants and mushrooms are toxic or deadly even in small amounts. Misidentification is a frequent cause of poisoning.' },
      { icon: '💊', title: 'Overdose and concentration', body: 'An extract or supplement can contain far more substance than the food. Dose and form (tea, extract, essential oil) change the risk.' },
      { icon: '🤧', title: 'Allergies', body: 'People allergic to a botanical family (e.g., Asteraceae: ragweed, daisies) may react to related plants such as chamomile or echinacea.' },
      { icon: '🤰', title: 'Pregnancy and breastfeeding', body: 'For most natural products there is not enough safety data. Some are contraindicated. Always ask before using them.' },
      { icon: '🧒', title: 'Children', body: 'Children are not small adults: dose, metabolism and risks differ. Some essential oils and remedies are dangerous in childhood.' },
      { icon: '👵', title: 'Older adults', body: 'More likely to take several medicines (polypharmacy) and to have interactions or side effects.' },
      { icon: '🫀', title: 'Liver disease', body: 'Several supplements have been associated with liver injury. If you have liver disease, ask before using any.' },
      { icon: '🫘', title: 'Kidney disease', body: 'Elimination can be impaired; some products contain minerals or compounds a diseased kidney does not tolerate.' },
      { icon: '🔪', title: 'Surgery', body: 'Some products (e.g., garlic supplements, ginkgo) may increase bleeding risk. Tell your medical team everything you take before surgery.' },
    ],
    recorded: 'Warnings recorded in the database',
    medGroups: 'Medicines especially sensitive to interactions',
    groups: [
      ['Anticoagulants', 'Small changes in effect can cause bleeding or thrombosis (e.g., warfarin).'],
      ['Cancer medicines', 'Some plants weaken or strengthen chemotherapy or targeted therapies.'],
      ['Cardiovascular medicines', 'Digoxin, beta-blockers and others have narrow margins.'],
      ['Psychiatric medicines', 'Risk of serotonin syndrome or loss of efficacy (e.g., St. John’s wort with antidepressants).'],
      ['Immunosuppressants', 'A drop in levels can cause transplant rejection.'],
    ],
    emergency: 'In case of possible poisoning or a severe reaction, call 911 or go to the emergency department.',
  },
};

export default async function SafetyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, dict } = await pageContext(params);
  const t = TEXT[locale];
  const repo = getRepository();
  const all = (await Promise.all((await repo.listEntities({ limit: 2000 })).items.filter((i) => ['plant', 'mushroom', 'food', 'compound'].includes(i.type)).map((i) => repo.getEntity(i.slug)))).filter(Boolean);
  const risks = all.flatMap((e) => e!.safety.filter((s) => s.status === 'documented_risk').map((s) => ({ e: e!, s })));
  return (
    <Container className="py-10">
      <h1 className="font-serif text-4xl font-semibold">{t.title}</h1>
      <p className="mt-2 max-w-3xl text-lg text-muted">{t.intro}</p>
      <div className="mt-6">
        <Notice tone="danger" title={dict.disclaimers.emergencyTitle}>{t.emergency}</Notice>
      </div>
      <SectionTitle>{t.natural}</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {t.blocks.map((b) => (
          <div key={b.title} className="rounded-2xl border border-border bg-surface p-5">
            <p className="text-2xl" aria-hidden>{b.icon}</p>
            <h3 className="mt-1 font-semibold">{b.title}</h3>
            <p className="mt-1 text-sm text-muted">{b.body}</p>
          </div>
        ))}
      </div>
      <SectionTitle>{t.medGroups}</SectionTitle>
      <ul className="grid gap-3 md:grid-cols-2">
        {t.groups.map(([title, body]) => (
          <li key={title} className="rounded-xl border border-border bg-surface p-4 text-sm"><span className="font-semibold">{title}.</span> {body}</li>
        ))}
      </ul>
      <p className="mt-3 text-sm"><Link className="text-accent underline" href={`/${locale}/interacciones`}>💊 {dict.nav.interactions} →</Link></p>
      <SectionTitle>{t.recorded}</SectionTitle>
      <ul className="space-y-2">
        {risks.map(({ e, s }, i) => (
          <li key={i} className="rounded-xl border border-danger/30 bg-danger-soft/50 p-3 text-sm">
            <Link href={entityPath(locale, e.type, e.slug)} className="font-semibold hover:underline">{tr(e.name, locale)}</Link> — {dict.safetyTopics[s.topic]}: {tr(s.text, locale)}
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm text-muted">
        <ExternalLink href="https://www.nccih.nih.gov/health/using-dietary-supplements-wisely">NCCIH — Using Dietary Supplements Wisely</ExternalLink>
      </p>
    </Container>
  );
}
