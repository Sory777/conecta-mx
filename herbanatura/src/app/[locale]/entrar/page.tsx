import type { Metadata } from 'next';
import { isSupabaseConfigured } from '@/lib/env';
import { pageContext } from '@/lib/i18n/server';
import { Container, Notice } from '@/components/ui';
import { SignInForm } from '@/components/user/SignInForm';

export const metadata: Metadata = { title: 'Entrar', robots: { index: false } };

export default async function SignInPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, dict } = await pageContext(params);
  const es = locale === 'es';
  return (
    <Container className="max-w-md py-10">
      <h1 className="font-serif text-3xl font-semibold">{dict.nav.signIn}</h1>
      <p className="mt-2 text-sm text-muted">{es ? 'La cuenta es opcional: sirve para sincronizar favoritos y colecciones entre dispositivos y para el panel editorial.' : 'An account is optional: it syncs favorites and collections across devices and gives access to the editorial panel.'}</p>
      <div className="mt-6">
        {isSupabaseConfigured() ? <SignInForm /> : <Notice tone="warn">{es ? 'Las cuentas no están habilitadas en este entorno (configura Supabase).' : 'Accounts are not enabled in this environment (configure Supabase).'}</Notice>}
      </div>
    </Container>
  );
}
