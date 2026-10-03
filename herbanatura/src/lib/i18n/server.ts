import { notFound } from 'next/navigation';
import type { Locale } from '@/lib/domain/types';
import { isLocale } from './config';
import { getDictionary } from './dictionaries';

export async function pageContext(params: Promise<{ locale: string }>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return { locale: locale as Locale, dict: getDictionary(locale) };
}

export const localeParams = () => [{ locale: 'es' }, { locale: 'en' }];
