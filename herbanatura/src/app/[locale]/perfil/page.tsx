import type { Metadata } from 'next';
import { getRepository } from '@/lib/data';
import { isSupabaseConfigured } from '@/lib/env';
import { pageContext } from '@/lib/i18n/server';
import { tr } from '@/lib/i18n/text';
import { Container } from '@/components/ui';
import { ProfileDashboard } from '@/components/user/ProfileDashboard';

export const metadata: Metadata = { title: 'Mi perfil', robots: { index: false } };

export default async function ProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, dict } = await pageContext(params);
  const { items } = await getRepository().listEntities({ type: 'medication' });
  return (
    <Container className="py-10">
      <h1 className="mb-6 font-serif text-4xl font-semibold">{dict.nav.profile}</h1>
      <ProfileDashboard medications={items.map((m) => ({ slug: m.slug, name: tr(m.name, locale) }))} accountEnabled={isSupabaseConfigured()} />
    </Container>
  );
}
