"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Heart, Menu, Search, ShoppingBag, User, X } from "lucide-react";
import { useStore } from "@/components/store/store-provider";
import { cn } from "@/lib/format";
import { store } from "@/config/store";
import { Logo } from "./logo";
import { InstagramIcon, FacebookIcon, TikTokIcon, YouTubeIcon } from "@/components/ui/social-icons";

export const NAV_LINKS = [
  { href: "/", label: "Inicio" },
  { href: "/catalogo", label: "Catálogo" },
  { href: "/novedades", label: "Novedades" },
  { href: "/ofertas", label: "Ofertas" },
  { href: "/nosotros", label: "Nosotros" },
  { href: "/contacto", label: "Contacto" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function Header() {
  const pathname = usePathname();
  const { itemCount, hydrated, setCartOpen, setSearchOpen, favorites } = useStore();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-50 transition-all duration-300",
          scrolled ? "surface-glass border-x-0 border-t-0 shadow-[0_10px_40px_-20px_rgba(0,0,0,.8)]" : "border-b border-transparent bg-transparent",
        )}
      >
        <div className={cn("mx-auto flex max-w-7xl items-center gap-2 px-4 transition-all sm:px-6", scrolled ? "h-16" : "h-[72px] lg:h-20")}>
          <button
            type="button"
            className="btn-ghost -ml-2 inline-flex size-11 items-center justify-center rounded-full lg:hidden"
            aria-label="Abrir menú"
            onClick={() => setMenuOpen(true)}
          >
            <Menu className="size-6" />
          </button>

          <Logo priority width={scrolled ? 100 : 116} className="transition-all duration-300" />

          <nav aria-label="Principal" className="ml-8 hidden items-center gap-1 lg:flex">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "relative rounded-full px-3.5 py-2 font-display text-sm font-medium transition-colors",
                  isActive(pathname, l.href) ? "text-white" : "text-ink-muted hover:text-white",
                )}
              >
                {l.label}
                {isActive(pathname, l.href) && (
                  <span className="bg-nova-gradient absolute inset-x-3.5 -bottom-0.5 h-0.5 rounded-full" aria-hidden />
                )}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="btn-ghost inline-flex size-11 items-center justify-center rounded-full"
              aria-label="Buscar"
            >
              <Search className="size-5" />
            </button>
            <Link
              href="/favoritos"
              className="btn-ghost relative hidden size-11 items-center justify-center rounded-full sm:inline-flex"
              aria-label="Favoritos"
            >
              <Heart className="size-5" />
              {hydrated && favorites.length > 0 && (
                <span className="bg-nova-magenta absolute top-2 right-2 size-2 rounded-full" aria-hidden />
              )}
            </Link>
            <Link
              href="/cuenta"
              className="btn-ghost hidden size-11 items-center justify-center rounded-full sm:inline-flex"
              aria-label="Mi cuenta"
            >
              <User className="size-5" />
            </Link>
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="btn-ghost relative inline-flex size-11 items-center justify-center rounded-full"
              aria-label={`Carrito, ${itemCount} artículos`}
              data-cart-target
            >
              <ShoppingBag className="size-5" />
              {hydrated && itemCount > 0 && (
                <span className="bg-nova-gradient absolute top-0.5 right-0.5 grid min-w-5 place-items-center rounded-full px-1 text-[11px] leading-5 font-bold text-white">
                  {itemCount > 99 ? "99+" : itemCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Menú móvil */}
      <div
        className={cn("fixed inset-0 z-[60] lg:hidden", menuOpen ? "pointer-events-auto" : "pointer-events-none")}
        aria-hidden={!menuOpen}
      >
        <div
          className={cn("absolute inset-0 bg-black/60 transition-opacity", menuOpen ? "opacity-100" : "opacity-0")}
          onClick={() => setMenuOpen(false)}
        />
        <aside
          role="dialog"
          aria-modal="true"
          aria-label="Menú"
          className={cn(
            "bg-space-900 absolute inset-y-0 left-0 flex w-[min(86vw,360px)] flex-col overflow-y-auto border-r border-white/10 transition-transform duration-300",
            menuOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="starfield opacity-60" aria-hidden />
          <div className="relative flex items-center justify-between px-5 pt-5">
            <Logo width={112} />
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="btn-ghost inline-flex size-11 items-center justify-center rounded-full"
              aria-label="Cerrar menú"
            >
              <X className="size-6" />
            </button>
          </div>
          <nav aria-label="Móvil" className="relative mt-6 flex flex-col px-3">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "flex items-center justify-between rounded-xl px-4 py-3.5 font-display text-lg font-medium",
                  isActive(pathname, l.href) ? "bg-white/6 text-white" : "text-ink-muted",
                )}
              >
                {l.label}
                {isActive(pathname, l.href) && <span className="bg-nova-gradient size-2 rounded-full" />}
              </Link>
            ))}
            <div className="my-3 h-px bg-white/10" />
            <Link href="/favoritos" className="flex items-center gap-3 rounded-xl px-4 py-3 text-ink-muted">
              <Heart className="size-5" /> Favoritos
            </Link>
            <Link href="/cuenta" className="flex items-center gap-3 rounded-xl px-4 py-3 text-ink-muted">
              <User className="size-5" /> Mi cuenta
            </Link>
          </nav>
          <div className="relative mt-auto px-7 pt-8 pb-8">
            <p className="text-nova-gradient font-display text-sm font-bold tracking-[0.25em]">{store.motto}</p>
            <div className="mt-4 flex gap-3 text-ink-muted">
              {store.social.instagram && <a href={store.social.instagram} aria-label="Instagram" target="_blank" rel="noopener noreferrer"><InstagramIcon className="size-5" /></a>}
              {store.social.facebook && <a href={store.social.facebook} aria-label="Facebook" target="_blank" rel="noopener noreferrer"><FacebookIcon className="size-5" /></a>}
              {store.social.tiktok && <a href={store.social.tiktok} aria-label="TikTok" target="_blank" rel="noopener noreferrer"><TikTokIcon className="size-5" /></a>}
              {store.social.youtube && <a href={store.social.youtube} aria-label="YouTube" target="_blank" rel="noopener noreferrer"><YouTubeIcon className="size-5" /></a>}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
