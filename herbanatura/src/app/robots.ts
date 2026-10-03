import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/es/admin', '/en/admin', '/es/perfil', '/en/perfil'] }], sitemap: `${env.siteUrl}/sitemap.xml` };
}
