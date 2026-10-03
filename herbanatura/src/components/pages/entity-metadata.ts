import type { Metadata } from 'next';
import type { Locale } from '@/lib/domain/types';
import { getRepository } from '@/lib/data';
import { scientificName } from '@/lib/domain/entity';
import { tr } from '@/lib/i18n/text';

export async function entityMetadata(slug: string, locale: Locale): Promise<Metadata> {
  const e = await getRepository().getEntity(slug);
  if (!e) return {};
  const sci = scientificName(e);
  return {
    title: sci ? `${tr(e.name, locale)} (${sci})` : tr(e.name, locale),
    description: e.summary ? tr(e.summary, locale).slice(0, 160) : undefined,
  };
}
