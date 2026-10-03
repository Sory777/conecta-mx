import type { Citation, LocalizedText } from '@/lib/domain/types';

/** Date the demo dataset was assembled. Nothing in the demo set has been human-reviewed yet. */
export const SEED_DATE = '2026-10-03';

export const L = (es: string, en?: string): LocalizedText => (en ? { es, en } : { es });

export const cite = (sourceId: string, locator?: string): Citation => ({ sourceId, locator: locator ?? null });

export const PENDING: LocalizedText = {
  es: 'Pendiente de investigación/verificación.',
  en: 'Pending research/verification.',
};

export const INSUFFICIENT: LocalizedText = {
  es: 'Información insuficiente.',
  en: 'Insufficient information.',
};
