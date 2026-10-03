import type { Metadata } from 'next';
import { Container } from '@/components/ui';
import { SearchBox } from '@/components/search/SearchBox';
import { SearchResultsView } from '@/components/search/SearchResultsView';
import { getRepository } from '@/lib/data';
import { pageContext } from '@/lib/i18n/server';
import { search } from '@/lib/search/engine';

export const metadata: Metadata = { title: 'Buscar', robots: { index: false } };

export default async function SearchPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string }> }) {
  const { locale, dict } = await pageContext(params);
  const q = ((await searchParams).q ?? '').slice(0, 500).trim();
  const result = q ? await search(getRepository(), q) : null;
  return (
    <Container className="py-8">
      <h1 className="sr-only">{dict.search.button}</h1>
      <SearchBox initial={q} autoFocus={!q} />
      {q && <p className="mt-4 text-sm text-muted">“{q}”</p>}
      <div className="mt-6">{result && <SearchResultsView r={result} dict={dict} locale={locale} />}</div>
    </Container>
  );
}
