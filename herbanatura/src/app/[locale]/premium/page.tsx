import type { Metadata } from 'next';
import { pageContext } from '@/lib/i18n/server';
import { Container, Notice } from '@/components/ui';

export const metadata: Metadata = { title: 'Premium' };

const PLANS = {
  es: [
    { name: 'Gratis', price: '0', items: ['Buscador universal', 'Fichas básicas de plantas, hongos, alimentos y compuestos', 'Información tradicional', 'Fuentes principales', 'Seguridad e interacciones esenciales', 'Alertas de emergencia'] },
    { name: 'Premium', price: '—', items: ['Investigación avanzada (PubMed, ensayos, filtros)', 'Comparador científico', 'Historial ilimitado y biblioteca personal', 'HerbaAI avanzada', 'Identificación por imagen', 'Alertas de interacciones con tus medicamentos', 'Acceso offline'] },
  ],
  en: [
    { name: 'Free', price: '0', items: ['Universal search', 'Basic plant, mushroom, food and compound entries', 'Traditional information', 'Main sources', 'Essential safety and interactions', 'Emergency alerts'] },
    { name: 'Premium', price: '—', items: ['Advanced research (PubMed, trials, filters)', 'Scientific comparator', 'Unlimited history and personal library', 'Advanced HerbaAI', 'Image identification', 'Interaction alerts for your medicines', 'Offline access'] },
  ],
};

export default async function PremiumPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await pageContext(params);
  const es = locale === 'es';
  return (
    <Container className="py-10">
      <h1 className="font-serif text-4xl font-semibold">⭐ Premium</h1>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {PLANS[locale].map((p) => (
          <div key={p.name} className="rounded-2xl border border-border bg-surface p-6">
            <h2 className="font-serif text-2xl font-semibold">{p.name}</h2>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">{p.items.map((i) => <li key={i}>{i}</li>)}</ul>
          </div>
        ))}
      </div>
      <div className="mt-6 space-y-3">
        <Notice tone="accent" title={es ? 'Compromiso' : 'Commitment'}>
          {es ? 'Nunca permitiremos que un anunciante, afiliado o suscriptor pague para cambiar la clasificación científica de una planta. La información de seguridad y emergencias siempre es gratuita.' : 'We will never let an advertiser, affiliate or subscriber pay to change the scientific rating of a plant. Safety and emergency information is always free.'}
        </Notice>
        <Notice>{es ? 'Los pagos aún no están habilitados en esta versión.' : 'Payments are not enabled in this version yet.'}</Notice>
      </div>
    </Container>
  );
}
