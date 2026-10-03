import { LOCALES, type EntityType, type Locale } from '@/lib/domain/types';

export const DEFAULT_LOCALE: Locale = 'es';
export const LOCALE_COOKIE = 'hn_locale';

export function isLocale(x: string | undefined | null): x is Locale {
  return !!x && (LOCALES as readonly string[]).includes(x);
}

/** URL section for each entity type (Spanish slugs shared by every locale for now). */
export const TYPE_SECTION: Record<EntityType, string> = {
  plant: 'plantas',
  mushroom: 'hongos',
  food: 'alimentos',
  compound: 'compuestos',
  condition: 'condiciones',
  medication: 'medicamentos',
};

export const SECTION_TYPE: Record<string, EntityType> = Object.fromEntries(
  Object.entries(TYPE_SECTION).map(([t, s]) => [s, t as EntityType]),
);

export const path = (locale: Locale, p = '') => `/${locale}${p.startsWith('/') || !p ? p : `/${p}`}`;
export const entityPath = (locale: Locale, type: EntityType, slug: string) => path(locale, `/${TYPE_SECTION[type]}/${slug}`);
