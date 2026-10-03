'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useI18n } from './Providers';
import { ModeToggle } from './ModeToggle';

export function Header() {
  const { dict, locale } = useI18n();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const other = locale === 'es' ? 'en' : 'es';
  const switchHref = pathname.replace(/^\/(es|en)/, `/${other}`);
  const nav: [string, string, string][] = [
    ['/plantas', '🌿', dict.nav.plants],
    ['/hongos', '🍄', dict.nav.mushrooms],
    ['/alimentos', '🥦', dict.nav.foods],
    ['/compuestos', '⚗️', dict.nav.compounds],
    ['/cancer', '🧬', dict.nav.cancer],
    ['/investigacion', '🔬', dict.nav.research],
    ['/interacciones', '💊', dict.nav.interactions],
    ['/identificar', '📷', dict.nav.identify],
    ['/mexico', '🇲🇽', dict.nav.mexico],
    ['/seguridad', '⚠️', dict.nav.safety],
    ['/herba-ai', '🤖', dict.nav.ai],
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        <Link href={`/${locale}`} className="flex items-center gap-2 font-serif text-xl font-bold text-accent-strong">
          <span aria-hidden>🌿</span> HerbaNatura
        </Link>
        <div className="ml-auto hidden items-center gap-3 md:flex">
          <ModeToggle compact />
          <Link href={switchHref} hrefLang={other} className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold uppercase" onClick={() => (document.cookie = `hn_locale=${other};path=/;max-age=31536000;samesite=lax`)}>
            {other}
          </Link>
          <Link href={`/${locale}/perfil`} className="text-sm font-medium hover:text-accent">
            {dict.nav.profile}
          </Link>
        </div>
        <button className="ml-auto rounded-lg border border-border px-3 py-1.5 text-sm md:hidden" aria-expanded={open} aria-controls="hn-nav" onClick={() => setOpen(!open)}>
          ☰ {dict.nav.menu}
        </button>
      </div>
      <nav id="hn-nav" aria-label="Principal" className={`${open ? 'block' : 'hidden'} border-t border-border md:block`}>
        <ul className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-2 sm:px-6 md:flex-row md:flex-wrap md:gap-0">
          {nav.map(([href, icon, label]) => {
            const full = `/${locale}${href}`;
            const active = pathname.startsWith(full);
            return (
              <li key={href}>
                <Link
                  href={full}
                  onClick={() => setOpen(false)}
                  className={`block rounded-lg px-3 py-2 text-sm md:py-1.5 ${active ? 'bg-accent-soft font-semibold text-accent-strong' : 'text-text hover:bg-surface-2'}`}
                >
                  <span aria-hidden>{icon}</span> {label}
                </Link>
              </li>
            );
          })}
          <li className="flex flex-wrap items-center gap-2 py-2 md:hidden">
            <ModeToggle compact />
            <Link href={switchHref} className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold uppercase">
              {other}
            </Link>
            <Link href={`/${locale}/perfil`} className="px-3 py-1.5 text-sm">
              {dict.nav.profile}
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
