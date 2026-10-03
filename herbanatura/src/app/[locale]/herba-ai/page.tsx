import type { Metadata } from 'next';
import { serverEnv } from '@/lib/env';
import { pageContext } from '@/lib/i18n/server';
import { Container, Notice } from '@/components/ui';
import { HerbaChat } from '@/components/ai/HerbaChat';

export const metadata: Metadata = { title: 'HerbaAI' };

export default async function HerbaAIPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string }> }) {
  const { locale, dict } = await pageContext(params);
  const { q } = await searchParams;
  const es = locale === 'es';
  return (
    <Container className="max-w-4xl py-10">
      <h1 className="font-serif text-4xl font-semibold">🤖 HerbaAI</h1>
      <p className="mt-2 text-muted">
        {es
          ? 'Asistente que responde únicamente con la base de conocimiento de HerbaNatura y sus fuentes. Si no hay información verificada, lo dice. Nunca inventa estudios, DOI ni resultados.'
          : 'An assistant that answers only from the HerbaNatura knowledge base and its sources. If there is no verified information, it says so. It never invents studies, DOIs or results.'}
      </p>
      <div className="mt-4 space-y-2">
        <Notice tone="info">{dict.disclaimers.general}</Notice>
        {serverEnv.aiProvider === 'none' && <Notice tone="warn">{es ? 'La IA generativa no está configurada: las respuestas se muestran en modo extractivo.' : 'Generative AI is not configured: answers are shown in extractive mode.'}</Notice>}
      </div>
      <div className="mt-6">
        <HerbaChat initial={q?.slice(0, 1000)} />
      </div>
    </Container>
  );
}
