"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Loader2, Search, X } from "lucide-react";
import { useStore } from "@/components/store/store-provider";
import { ProductImage } from "@/components/product/product-image";
import { Price } from "@/components/product/price";
import { searchProducts } from "@/lib/catalog";
import { cn } from "@/lib/format";
import type { Category, Product } from "@/lib/types";

const SUGGESTIONS = ["Conjunto", "Playera", "Niña", "Niño", "Sudadera", "Talla 8"];

let catalogCache: Promise<{ products: Product[]; categories: Category[] }> | null = null;

/** Índice del catálogo para búsqueda instantánea (se descarga una vez por visita). */
export function loadCatalog() {
  catalogCache ??= fetch("/api/catalog")
    .then((r) => {
      if (!r.ok) throw new Error("catalog");
      return r.json();
    })
    .catch((err) => {
      catalogCache = null;
      throw err;
    });
  return catalogCache;
}

export function SearchOverlay() {
  const { searchOpen, setSearchOpen } = useStore();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [data, setData] = useState<{ products: Product[]; categories: Category[] } | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!searchOpen) return;
    setTimeout(() => inputRef.current?.focus(), 50);
    loadCatalog().then(setData, () => setError(true));
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSearchOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [searchOpen, setSearchOpen]);

  const results = useMemo(
    () => (data && query.trim() ? searchProducts(data.products, data.categories, query) : []),
    [data, query],
  );

  function close() {
    setSearchOpen(false);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    close();
    router.push(`/catalogo?q=${encodeURIComponent(query.trim())}`);
  }

  if (!searchOpen) return null;

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="Buscar productos">
      <div className="absolute inset-0 bg-space-950/80 backdrop-blur-md" onClick={close} />
      <div className="animate-fade-up relative mx-auto flex h-full max-w-3xl flex-col px-4 pt-4 sm:h-auto sm:max-h-[85vh] sm:pt-20">
        <div className="bg-space-900 flex max-h-full flex-col overflow-hidden rounded-3xl border border-white/10 shadow-[0_30px_80px_-30px_rgba(31,209,255,.35)]">
          <form onSubmit={submit} className="flex items-center gap-3 border-b border-white/10 px-4 sm:px-5">
            <Search className="size-5 shrink-0 text-nova-cyan" />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Busca playeras, conjuntos, talla 8…"
              className="h-16 min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-ink-faint sm:text-lg"
              aria-label="Buscar"
              enterKeyHint="search"
            />
            <button type="button" onClick={close} className="btn-ghost -mr-2 grid size-10 shrink-0 place-items-center rounded-full" aria-label="Cerrar búsqueda">
              <X className="size-5" />
            </button>
          </form>

          <div className="overflow-y-auto overscroll-contain p-4 sm:p-5">
            {!query.trim() && (
              <div>
                <p className="eyebrow mb-3">Búsquedas populares</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} type="button" className="chip" onClick={() => setQuery(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {query.trim() && !data && !error && (
              <p className="flex items-center gap-2 py-6 text-sm text-ink-muted">
                <Loader2 className="size-4 animate-spin" /> Buscando…
              </p>
            )}
            {error && <p className="py-6 text-sm text-danger">No se pudo cargar el buscador. Intenta de nuevo.</p>}

            {query.trim() && data && (
              <>
                <p className="mb-2 text-sm text-ink-muted">
                  {results.length ? `${results.length} resultado${results.length === 1 ? "" : "s"}` : `Sin resultados para “${query}”.`}
                </p>
                <ul className="divide-y divide-white/8">
                  {results.slice(0, 8).map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/producto/${p.slug}`}
                        onClick={close}
                        className="flex items-center gap-4 rounded-xl px-2 py-2.5 transition hover:bg-white/5"
                      >
                        <span className="bg-space-800 relative aspect-[4/5] w-14 shrink-0 overflow-hidden rounded-lg">
                          {p.images[0] && <ProductImage src={p.images[0].url} alt="" fill sizes="56px" className="object-cover" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-white">{p.name}</span>
                          <span className="text-ink-faint block truncate text-xs">Tallas {p.sizes.join(" · ")}</span>
                        </span>
                        <Price price={p.price} compareAt={p.compareAtPrice} size="sm" className="shrink-0 flex-col items-end gap-0" />
                      </Link>
                    </li>
                  ))}
                </ul>
                {results.length > 0 && (
                  <button type="button" onClick={submit} className={cn("btn btn-secondary btn-sm mt-4 w-full")}>
                    Ver todos los resultados <ArrowRight className="size-4" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
