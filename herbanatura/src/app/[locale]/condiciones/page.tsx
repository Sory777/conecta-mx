import type { Metadata } from 'next';
import { EntityListPage } from '@/components/pages/EntityListPage';
import { pageContext } from '@/lib/i18n/server';

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { dict } = await pageContext(params);
  return { title: dict.typesPlural.condition };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, dict } = await pageContext(params);
  return <EntityListPage type="condition" locale={locale} dict={dict} />;
}
