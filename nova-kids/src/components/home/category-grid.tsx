import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Category } from "@/lib/types";

export function CategoryGrid({ categories, counts }: { categories: Category[]; counts: Record<string, number> }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
      {categories.map((c) => (
        <Link
          key={c.id}
          href={`/categoria/${c.slug}`}
          className="group relative aspect-[4/5] overflow-hidden rounded-[var(--radius-card)] ring-1 ring-white/10 transition hover:ring-nova-cyan/40 hover:shadow-[0_20px_50px_-25px_rgba(31,209,255,.6)]"
        >
          {c.image ? (
            <Image
              src={c.image}
              alt=""
              fill
              sizes="(min-width:768px) 25vw, 50vw"
              unoptimized={c.image.endsWith(".svg")}
              className="object-cover transition duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="bg-space-800 absolute inset-0" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-space-950/95 via-space-950/20 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-4">
            <div className="min-w-0">
              <h3 className="font-display text-lg font-bold text-white sm:text-xl">{c.name}</h3>
              <p className="text-xs text-ink-muted">
                {counts[c.id] ?? 0} {counts[c.id] === 1 ? "producto" : "productos"}
              </p>
            </div>
            <span className="grid size-9 shrink-0 place-items-center rounded-full border border-white/20 bg-white/5 backdrop-blur transition group-hover:border-transparent group-hover:bg-white group-hover:text-space-900">
              <ArrowUpRight className="size-4" />
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
