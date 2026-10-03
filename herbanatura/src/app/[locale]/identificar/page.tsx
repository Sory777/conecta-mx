import type { Metadata } from 'next';
import { serverEnv } from '@/lib/env';
import { pageContext } from '@/lib/i18n/server';
import { Container, Notice } from '@/components/ui';
import { IdentifyForm } from '@/components/identify/IdentifyForm';
import { PremiumGate } from '@/components/premium/PremiumGate';

export const metadata: Metadata = { title: 'Identificar planta' };

export default async function IdentifyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, dict } = await pageContext(params);
  const es = locale === 'es';
  return (
    <Container className="max-w-3xl py-10">
      <h1 className="font-serif text-4xl font-semibold">📷 {es ? 'Identificar planta' : 'Identify a plant'}</h1>
      <p className="mt-2 text-muted">
        {es ? 'Sube una fotografía: analizamos forma de hoja, flor, fruto, tallo y otras características visibles, y mostramos varias posibilidades. Nunca es una identificación definitiva.' : 'Upload a photo: we analyze leaf shape, flower, fruit, stem and other visible features, and show several possibilities. It is never a definitive identification.'}
      </p>
      <div className="mt-6">
        {serverEnv.identifyProvider === 'none' ? (
          <Notice tone="warn">{es ? 'La identificación por imagen no está configurada en este entorno (IDENTIFY_PROVIDER / clave de API).' : 'Image identification is not configured in this environment (IDENTIFY_PROVIDER / API key).'}</Notice>
        ) : (
          <PremiumGate feature="image_identification" dict={dict} locale={locale}>
            <IdentifyForm />
          </PremiumGate>
        )}
      </div>
    </Container>
  );
}
