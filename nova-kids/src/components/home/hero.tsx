import Link from "next/link";
import { Rocket, Sparkles } from "lucide-react";
import { store } from "@/config/store";
import { ProductImage } from "@/components/product/product-image";
import { Logo } from "@/components/layout/logo";
import type { Product } from "@/lib/types";
import { formatPrice } from "@/lib/format";

export function Hero({ spotlight }: { spotlight: Product[] }) {
  const [main, second] = spotlight;
  return (
    <section className="relative -mt-[72px] overflow-hidden pt-[72px] lg:-mt-20 lg:pt-20">
      {/* Fondo espacial */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#1a1050_0%,_#080819_45%,_#04040d_100%)]" aria-hidden />
      <div className="starfield" aria-hidden />
      <div className="absolute top-1/3 -left-40 size-[32rem] rounded-full bg-nova-blue/20 blur-[120px]" aria-hidden />
      <div className="absolute -right-32 bottom-0 size-[28rem] rounded-full bg-nova-magenta/15 blur-[120px]" aria-hidden />
      <svg className="absolute top-1/2 left-1/2 w-[160%] max-w-none -translate-x-1/2 -translate-y-1/2 opacity-40 lg:w-[120%]" viewBox="0 0 1600 700" fill="none" aria-hidden>
        <defs>
          <linearGradient id="orbit" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#1fd1ff" stopOpacity="0" />
            <stop offset=".35" stopColor="#1fd1ff" />
            <stop offset=".7" stopColor="#8b3dff" />
            <stop offset="1" stopColor="#ff2bb8" stopOpacity="0" />
          </linearGradient>
        </defs>
        <ellipse cx="800" cy="350" rx="760" ry="190" stroke="url(#orbit)" strokeWidth="1.5" transform="rotate(-12 800 350)" />
        <ellipse cx="800" cy="350" rx="560" ry="130" stroke="url(#orbit)" strokeWidth="1" strokeDasharray="4 10" transform="rotate(-12 800 350)" />
      </svg>

      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pt-10 pb-20 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pt-16 lg:pb-28">
        <div className="animate-fade-up text-center lg:text-left">
          <p className="eyebrow justify-center lg:justify-start">
            <Sparkles className="size-3.5" /> Nueva colección
          </p>
          <h1 className="mt-5">
            <span className="sr-only">NOVA KIDS — </span>
            <Logo href={null} width={420} priority className="mx-auto max-w-[78vw] drop-shadow-[0_0_40px_rgba(139,61,255,.35)] lg:mx-0" />
            <span className="mt-6 block font-display text-2xl leading-tight font-semibold text-white sm:text-3xl lg:text-[2.6rem]">
              {store.tagline}
            </span>
          </h1>
          <p className="text-nova-gradient mt-5 font-display text-sm font-bold tracking-[0.35em] sm:text-base">{store.motto}</p>
          <div className="mt-9 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center lg:justify-start">
            <Link href="/catalogo" className="btn btn-primary btn-lg">
              <Rocket className="rocket-icon size-5" /> Explorar catálogo
            </Link>
            <Link href="/novedades" className="btn btn-secondary btn-lg">
              Ver novedades
            </Link>
          </div>
        </div>

        {main && (
          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="relative mx-auto aspect-square w-[88%]">
              <div className="absolute inset-[6%] rounded-full bg-[conic-gradient(from_200deg,#1fd1ff,#2f6bff,#8b3dff,#ff2bb8,#1fd1ff)] opacity-25 blur-2xl" aria-hidden />
              <div className="absolute inset-0 rounded-full border border-white/10" aria-hidden />
              <div className="animate-orbit absolute inset-0" aria-hidden>
                <span className="absolute top-1/2 -left-1.5 size-3 rounded-full bg-nova-cyan shadow-[0_0_16px_4px_rgba(31,209,255,.6)]" />
              </div>
              <Link
                href={`/producto/${main.slug}`}
                className="animate-float absolute inset-[12%] overflow-hidden rounded-[2rem] ring-1 ring-white/15 shadow-[0_40px_80px_-30px_rgba(139,61,255,.6)]"
              >
                {main.images[0] && (
                  <ProductImage src={main.images[0].url} alt={main.name} fill priority sizes="(min-width:1024px) 420px, 80vw" className="object-cover" />
                )}
                <span className="surface-glass absolute inset-x-3 bottom-3 flex items-center justify-between rounded-2xl px-4 py-3 text-left">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-white">{main.name}</span>
                    <span className="text-xs text-ink-muted">Desde {formatPrice(main.price)}</span>
                  </span>
                  <span className="bg-nova-gradient grid size-9 shrink-0 place-items-center rounded-full">
                    <Rocket className="size-4 text-white" />
                  </span>
                </span>
              </Link>
              {second?.images[0] && (
                <Link
                  href={`/producto/${second.slug}`}
                  className="absolute -right-2 -bottom-4 hidden aspect-[4/5] w-[34%] overflow-hidden rounded-2xl ring-1 ring-white/15 shadow-2xl sm:block"
                  aria-label={second.name}
                >
                  <ProductImage src={second.images[0].url} alt={second.name} fill sizes="160px" className="object-cover" />
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
