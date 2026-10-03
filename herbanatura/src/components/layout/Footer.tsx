import Link from 'next/link';
import type { Locale } from '@/lib/domain/types';
import type { Dictionary } from '@/lib/i18n/dictionaries';

export function Footer({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  const l = (p: string) => `/${locale}${p}`;
  return (
    <footer className="mt-16 border-t border-border bg-surface-2">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <p className="font-serif text-lg font-bold text-accent-strong">🌿 HerbaNatura</p>
          <p className="mt-1 italic text-muted">{dict.meta.tagline}</p>
          <p className="mt-3 text-muted">{dict.footer.about}</p>
          <p className="mt-3 rounded-lg border border-border bg-surface p-3 text-xs">{dict.disclaimers.general}</p>
        </div>
        <div>
          <p className="font-semibold">{dict.home.explore}</p>
          <ul className="mt-2 space-y-1">
            <li><Link href={l('/medicina-tradicional')} className="hover:underline">{dict.nav.traditional}</Link></li>
            <li><Link href={l('/prevencion')} className="hover:underline">{dict.nav.prevention}</Link></li>
            <li><Link href={l('/comparar')} className="hover:underline">{dict.nav.compare}</Link></li>
            <li><Link href={l('/evidencia')} className="hover:underline">{dict.nav.evidence}</Link></li>
            <li><Link href={l('/premium')} className="hover:underline">{dict.nav.premium}</Link></li>
            <li><Link href={l('/admin')} className="hover:underline">{dict.nav.admin}</Link></li>
          </ul>
        </div>
        <div>
          <p className="font-semibold">{dict.footer.legal}</p>
          <ul className="mt-2 space-y-1">
            <li><Link href={l('/privacidad')} className="hover:underline">{dict.footer.privacy}</Link></li>
            <li><Link href={l('/terminos')} className="hover:underline">{dict.footer.terms}</Link></li>
            <li><Link href={l('/evidencia')} className="hover:underline">{dict.footer.evidence}</Link></li>
          </ul>
          <p className="mt-4 text-xs text-muted">{dict.footer.sources}</p>
        </div>
      </div>
    </footer>
  );
}
