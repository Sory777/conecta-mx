import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '../globals.css';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { MODE_BOOTSTRAP } from '@/components/layout/ModeToggle';
import { I18nProvider } from '@/components/layout/Providers';
import { env } from '@/lib/env';
import { localeParams, pageContext } from '@/lib/i18n/server';

export const generateStaticParams = localeParams;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { dict, locale } = await pageContext(params);
  return {
    metadataBase: new URL(env.siteUrl),
    title: { default: `${dict.meta.title} — ${dict.meta.tagline}`, template: `%s · ${dict.meta.title}` },
    description: dict.meta.description,
    alternates: { languages: { es: '/es', en: '/en' } },
    openGraph: { siteName: 'HerbaNatura', locale, type: 'website' },
    icons: { icon: '/icon.svg' },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf8f2' },
    { media: '(prefers-color-scheme: dark)', color: '#111613' },
  ],
};

export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale, dict } = await pageContext(params);
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: MODE_BOOTSTRAP }} />
      </head>
      <body className="min-h-dvh">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:p-2">
          {locale === 'es' ? 'Saltar al contenido' : 'Skip to content'}
        </a>
        <I18nProvider locale={locale} dict={dict}>
          <Header />
          <main id="main">{children}</main>
          <Footer dict={dict} locale={locale} />
        </I18nProvider>
      </body>
    </html>
  );
}
