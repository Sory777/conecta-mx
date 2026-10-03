import type { MetadataRoute } from 'next';
import { getRepository } from '@/lib/data';
import { env } from '@/lib/env';
import { TYPE_SECTION } from '@/lib/i18n/config';

export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { items } = await getRepository().listEntities({ limit: 50000 });
  const statics = ['', '/plantas', '/hongos', '/alimentos', '/compuestos', '/cancer', '/interacciones', '/mexico', '/seguridad', '/prevencion', '/medicina-tradicional', '/evidencia'];
  return ['es', 'en'].flatMap((l) => [
    ...statics.map((p) => ({ url: `${env.siteUrl}/${l}${p}` })),
    ...items.map((i) => ({ url: `${env.siteUrl}/${l}/${TYPE_SECTION[i.type]}/${i.slug}` })),
  ]);
}
