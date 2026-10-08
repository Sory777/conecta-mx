import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function SectionHeading({
  eyebrow,
  title,
  description,
  href,
  linkLabel = "Ver todo",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && (
          <p className="eyebrow">
            <OrbitMark /> {eyebrow}
          </p>
        )}
        <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">{title}</h2>
        {description && <p className="mt-2 max-w-xl text-ink-muted">{description}</p>}
      </div>
      {href && (
        <Link href={href} className="group inline-flex shrink-0 items-center gap-1.5 font-display text-sm font-semibold text-nova-cyan hover:text-white">
          {linkLabel}
          <ArrowRight className="size-4 transition group-hover:translate-x-1" />
        </Link>
      )}
    </div>
  );
}

/** Marca decorativa: estrella de cuatro puntas con trazo orbital, inspirada en el logotipo. */
export function OrbitMark({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <defs>
        <linearGradient id="om" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1fd1ff" />
          <stop offset="1" stopColor="#ff2bb8" />
        </linearGradient>
      </defs>
      <path d="M3 17c4 3 13 1 18-8" fill="none" stroke="url(#om)" strokeWidth="2" strokeLinecap="round" />
      <path d="M17 1.5q.6 3.9 4.5 4.5-3.9.6-4.5 4.5-.6-3.9-4.5-4.5 3.9-.6 4.5-4.5z" fill="#1fd1ff" />
    </svg>
  );
}
