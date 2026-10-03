import type { Metadata } from 'next';
import { EntityDetailPage } from '@/components/pages/EntityDetailPage';
import { entityMetadata } from '@/components/pages/entity-metadata';
import { pageContext } from '@/lib/i18n/server';

export const revalidate = 3600;
export const generateStaticParams = () => [];

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { locale } = await pageContext(params);
  return entityMetadata(slug, locale);
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const { locale, dict } = await pageContext(params);
  return <EntityDetailPage type="mushroom" slug={slug} locale={locale} dict={dict} />;
}
