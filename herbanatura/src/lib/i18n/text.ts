import type { Locale, LocalizedText } from '@/lib/domain/types';

/** Resolve a localized text, falling back to Spanish (the mandatory language). */
export function tr(text: LocalizedText | null | undefined, locale: Locale): string {
  if (!text) return '';
  return text[locale] ?? text.es;
}

/** True when the requested language is missing and Spanish is shown instead. */
export function isFallback(text: LocalizedText | null | undefined, locale: Locale): boolean {
  return !!text && locale !== 'es' && !text[locale];
}
