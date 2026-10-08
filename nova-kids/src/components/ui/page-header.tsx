import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { OrbitMark } from "./section-heading";

export function PageHeader({
  title,
  description,
  eyebrow,
  crumbs = [],
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  crumbs?: { href: string; label: string }[];
}) {
  return (
    <section className="relative -mt-[72px] overflow-hidden pt-[72px] lg:-mt-20 lg:pt-20">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#1a1050_0%,_#080819_55%,_#04040d_100%)]" aria-hidden />
      <div className="starfield opacity-70" aria-hidden />
      <div className="bg-nova-gradient absolute inset-x-0 bottom-0 h-px opacity-40" aria-hidden />
      <div className="relative mx-auto max-w-7xl px-4 pt-8 pb-10 sm:px-6 lg:pt-12 lg:pb-14">
        {crumbs.length > 0 && (
          <nav aria-label="Ruta" className="mb-4 flex flex-wrap items-center gap-1 text-xs text-ink-muted">
            <Link href="/" className="hover:text-white">Inicio</Link>
            {crumbs.map((c) => (
              <span key={c.href} className="flex items-center gap-1">
                <ChevronRight className="size-3" />
                <Link href={c.href} className="hover:text-white">{c.label}</Link>
              </span>
            ))}
          </nav>
        )}
        {eyebrow && (
          <p className="eyebrow">
            <OrbitMark /> {eyebrow}
          </p>
        )}
        <h1 className="mt-2 font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">{title}</h1>
        {description && <p className="mt-3 max-w-2xl text-ink-muted sm:text-lg">{description}</p>}
      </div>
    </section>
  );
}
