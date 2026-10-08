"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { SlidersHorizontal, X, SearchX } from "lucide-react";
import { ProductGrid } from "@/components/product/product-grid";
import { applyFilters, emptyFilters, SORT_OPTIONS, type CatalogFilters, type SortOption } from "@/lib/catalog";
import { cn, formatPrice } from "@/lib/format";
import { sortSizes } from "@/lib/product";
import { GENDER_LABELS, type Category, type Gender, type Product } from "@/lib/types";

const PRICE_RANGES = [
  { label: "Hasta $250", min: null, max: 250 },
  { label: "$250 – $450", min: 250, max: 450 },
  { label: "Más de $450", min: 450, max: null },
];

const list = (v: string | null) => (v ? v.split(",").filter(Boolean) : []);
const numOrNull = (v: string | null) => (v && !Number.isNaN(Number(v)) ? Number(v) : null);

function fromParams(sp: URLSearchParams): CatalogFilters {
  const sort = sp.get("orden") as SortOption | null;
  return {
    categories: list(sp.get("categoria")),
    genders: list(sp.get("genero")) as Gender[],
    sizes: list(sp.get("talla")),
    colors: list(sp.get("color")),
    minPrice: numOrNull(sp.get("min")),
    maxPrice: numOrNull(sp.get("max")),
    inStock: sp.get("disponible") === "1",
    onlyNew: sp.get("nuevo") === "1",
    onlySale: sp.get("oferta") === "1",
    query: sp.get("q") ?? "",
    sort: SORT_OPTIONS.some((o) => o.id === sort) ? sort! : "recientes",
  };
}

function toParams(f: CatalogFilters): string {
  const sp = new URLSearchParams();
  if (f.query) sp.set("q", f.query);
  if (f.categories.length) sp.set("categoria", f.categories.join(","));
  if (f.genders.length) sp.set("genero", f.genders.join(","));
  if (f.sizes.length) sp.set("talla", f.sizes.join(","));
  if (f.colors.length) sp.set("color", f.colors.join(","));
  if (f.minPrice !== null) sp.set("min", String(f.minPrice));
  if (f.maxPrice !== null) sp.set("max", String(f.maxPrice));
  if (f.inStock) sp.set("disponible", "1");
  if (f.onlyNew) sp.set("nuevo", "1");
  if (f.onlySale) sp.set("oferta", "1");
  if (f.sort !== "recientes") sp.set("orden", f.sort);
  return sp.toString();
}

const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

export function CatalogView({
  products,
  categories,
  lockedCategory,
}: {
  products: Product[];
  categories: Category[];
  /** Categoría fija de la página (por ejemplo /categoria/ninas). */
  lockedCategory?: Category;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<CatalogFilters>(() => fromParams(new URLSearchParams(searchParams.toString())));
  const [sheetOpen, setSheetOpen] = useState(false);

  // Si cambia la URL (por ejemplo, una nueva búsqueda desde el header), sincroniza.
  useEffect(() => {
    setFilters(fromParams(new URLSearchParams(searchParams.toString())));
  }, [searchParams]);

  function update(next: Partial<CatalogFilters>) {
    const merged = { ...filters, ...next };
    setFilters(merged);
    const qs = toParams(merged);
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  useEffect(() => {
    document.body.style.overflow = sheetOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [sheetOpen]);

  const results = useMemo(() => applyFilters(products, categories, filters), [products, categories, filters]);

  const options = useMemo(() => {
    const sizes = sortSizes([...new Set(products.flatMap((p) => p.sizes))]);
    const colors = new Map<string, string>();
    products.forEach((p) => p.colors.forEach((c) => colors.set(c.name, c.hex)));
    const genders = [...new Set(products.map((p) => p.gender))].filter((g) => g !== "unisex") as Gender[];
    const filterCats = categories.filter((c) => c.kind === "garment" && c.id !== lockedCategory?.id);
    return { sizes, colors: [...colors.entries()], genders, filterCats };
  }, [products, categories, lockedCategory]);

  const activeCount =
    filters.categories.length +
    filters.genders.length +
    filters.sizes.length +
    filters.colors.length +
    (filters.minPrice !== null || filters.maxPrice !== null ? 1 : 0) +
    Number(filters.inStock) +
    Number(filters.onlyNew) +
    Number(filters.onlySale);

  const clearAll = () => update({ ...emptyFilters, sort: filters.sort });

  const panel = (
    <div className="space-y-7">
      {options.filterCats.length > 0 && (
        <FilterGroup title="Categoría">
          <div className="flex flex-wrap gap-2">
            {options.filterCats.map((c) => (
              <button key={c.id} type="button" className="chip" aria-pressed={filters.categories.includes(c.slug)} onClick={() => update({ categories: toggle(filters.categories, c.slug) })}>
                {c.name}
              </button>
            ))}
          </div>
        </FilterGroup>
      )}
      {lockedCategory?.kind !== "gender" && options.genders.length > 0 && (
        <FilterGroup title="Niño / Niña">
          <div className="flex flex-wrap gap-2">
            {options.genders.map((g) => (
              <button key={g} type="button" className="chip" aria-pressed={filters.genders.includes(g)} onClick={() => update({ genders: toggle(filters.genders, g) })}>
                {GENDER_LABELS[g]}
              </button>
            ))}
          </div>
        </FilterGroup>
      )}
      <FilterGroup title="Talla">
        <div className="flex flex-wrap gap-2">
          {options.sizes.map((s) => (
            <button key={s} type="button" className="chip" aria-pressed={filters.sizes.includes(s)} onClick={() => update({ sizes: toggle(filters.sizes, s) })}>
              {s}
            </button>
          ))}
        </div>
      </FilterGroup>
      <FilterGroup title="Precio">
        <div className="flex flex-wrap gap-2">
          {PRICE_RANGES.map((r) => {
            const active = filters.minPrice === r.min && filters.maxPrice === r.max;
            return (
              <button
                key={r.label}
                type="button"
                className="chip"
                aria-pressed={active}
                onClick={() => update(active ? { minPrice: null, maxPrice: null } : { minPrice: r.min, maxPrice: r.max })}
              >
                {r.label}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="Mín"
            aria-label="Precio mínimo"
            value={filters.minPrice ?? ""}
            onChange={(e) => update({ minPrice: e.target.value === "" ? null : Number(e.target.value) })}
            className="field min-h-10 w-full text-sm"
          />
          <span className="text-ink-faint">–</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="Máx"
            aria-label="Precio máximo"
            value={filters.maxPrice ?? ""}
            onChange={(e) => update({ maxPrice: e.target.value === "" ? null : Number(e.target.value) })}
            className="field min-h-10 w-full text-sm"
          />
        </div>
      </FilterGroup>
      <FilterGroup title="Color">
        <div className="flex flex-wrap gap-2.5">
          {options.colors.map(([name, hex]) => (
            <button
              key={name}
              type="button"
              aria-pressed={filters.colors.includes(name)}
              aria-label={name}
              title={name}
              onClick={() => update({ colors: toggle(filters.colors, name) })}
              className={cn(
                "size-9 rounded-full ring-2 ring-offset-2 ring-offset-space-900 transition",
                filters.colors.includes(name) ? "ring-nova-cyan" : "ring-white/10 hover:ring-white/40",
              )}
              style={{ background: hex }}
            />
          ))}
        </div>
      </FilterGroup>
      <FilterGroup title="Mostrar">
        <div className="space-y-1">
          <Toggle label="Solo disponibles" checked={filters.inStock} onChange={(v) => update({ inStock: v })} />
          {lockedCategory?.kind !== "new" && <Toggle label="Novedades" checked={filters.onlyNew} onChange={(v) => update({ onlyNew: v })} />}
          {lockedCategory?.kind !== "sale" && <Toggle label="Ofertas" checked={filters.onlySale} onChange={(v) => update({ onlySale: v })} />}
        </div>
      </FilterGroup>
    </div>
  );

  const chips: { label: string; clear: () => void }[] = [
    ...(filters.query ? [{ label: `“${filters.query}”`, clear: () => update({ query: "" }) }] : []),
    ...filters.categories.map((slug) => ({
      label: categories.find((c) => c.slug === slug)?.name ?? slug,
      clear: () => update({ categories: toggle(filters.categories, slug) }),
    })),
    ...filters.genders.map((g) => ({ label: GENDER_LABELS[g], clear: () => update({ genders: toggle(filters.genders, g) }) })),
    ...filters.sizes.map((s) => ({ label: `Talla ${s}`, clear: () => update({ sizes: toggle(filters.sizes, s) }) })),
    ...filters.colors.map((c) => ({ label: c, clear: () => update({ colors: toggle(filters.colors, c) }) })),
    ...(filters.minPrice !== null || filters.maxPrice !== null
      ? [
          {
            label: `${filters.minPrice !== null ? formatPrice(filters.minPrice) : "$0"} – ${filters.maxPrice !== null ? formatPrice(filters.maxPrice) : "más"}`,
            clear: () => update({ minPrice: null, maxPrice: null }),
          },
        ]
      : []),
    ...(filters.inStock ? [{ label: "Disponibles", clear: () => update({ inStock: false }) }] : []),
    ...(filters.onlyNew ? [{ label: "Novedades", clear: () => update({ onlyNew: false }) }] : []),
    ...(filters.onlySale ? [{ label: "Ofertas", clear: () => update({ onlySale: false }) }] : []),
  ];

  return (
    <div className="lg:grid lg:grid-cols-[250px_1fr] lg:gap-10">
      <aside className="hidden lg:block" aria-label="Filtros">
        <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-2 pb-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-display font-semibold">Filtros</h2>
            {activeCount > 0 && (
              <button type="button" onClick={clearAll} className="text-xs text-nova-cyan hover:underline">
                Limpiar todo
              </button>
            )}
          </div>
          {panel}
        </div>
      </aside>

      <div>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-x-3 gap-y-3">
          <p className="text-sm text-ink-muted" aria-live="polite">
            <strong className="text-white">{results.length}</strong> {results.length === 1 ? "producto" : "productos"}
          </p>
          <div className="ml-auto flex min-w-0 items-center gap-2">
            <button type="button" onClick={() => setSheetOpen(true)} className="btn btn-secondary btn-sm lg:hidden">
              <SlidersHorizontal className="size-4" /> Filtros
              {activeCount > 0 && <span className="bg-nova-gradient grid size-5 place-items-center rounded-full text-[10px]">{activeCount}</span>}
            </button>
            <label htmlFor="sort" className="sr-only">Ordenar por</label>
            <select
              id="sort"
              value={filters.sort}
              onChange={(e) => update({ sort: e.target.value as SortOption })}
              className="field min-h-10 w-40 min-w-0 rounded-full py-0 pr-8 pl-3.5 text-sm sm:w-auto"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {chips.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            {chips.map((c) => (
              <button key={c.label} type="button" onClick={c.clear} className="inline-flex items-center gap-1.5 rounded-full bg-white/8 px-3 py-1.5 text-xs text-white hover:bg-white/12">
                {c.label} <X className="size-3.5" />
              </button>
            ))}
            <button type="button" onClick={clearAll} className="px-2 text-xs text-nova-cyan hover:underline">
              Limpiar
            </button>
          </div>
        )}

        {results.length > 0 ? (
          <ProductGrid products={results} priorityCount={4} />
        ) : (
          <div className="surface flex flex-col items-center px-6 py-16 text-center">
            <SearchX className="size-10 text-ink-faint" />
            <p className="mt-4 font-display text-lg font-semibold">No encontramos productos</p>
            <p className="mt-1 max-w-sm text-sm text-ink-muted">Prueba con otros filtros o una búsqueda diferente.</p>
            {(activeCount > 0 || filters.query) && (
              <button type="button" onClick={clearAll} className="btn btn-secondary btn-sm mt-6">
                Quitar filtros
              </button>
            )}
          </div>
        )}
      </div>

      {/* Hoja de filtros en móvil */}
      <div className={cn("fixed inset-0 z-[65] lg:hidden", sheetOpen ? "pointer-events-auto" : "pointer-events-none")} aria-hidden={!sheetOpen}>
        <div className={cn("absolute inset-0 bg-black/60 transition-opacity", sheetOpen ? "opacity-100" : "opacity-0")} onClick={() => setSheetOpen(false)} />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Filtros"
          className={cn(
            "bg-space-900 absolute inset-x-0 bottom-0 flex max-h-[88vh] flex-col rounded-t-3xl border-t border-white/10 transition-transform duration-300",
            sheetOpen ? "translate-y-0" : "translate-y-full",
          )}
        >
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <h2 className="font-display text-lg font-semibold">Filtros</h2>
            <button type="button" onClick={() => setSheetOpen(false)} className="btn-ghost -mr-2 grid size-10 place-items-center rounded-full" aria-label="Cerrar filtros">
              <X className="size-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-6">{panel}</div>
          <div className="flex gap-3 border-t border-white/10 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button type="button" onClick={clearAll} className="btn btn-ghost flex-1">
              Limpiar
            </button>
            <button type="button" onClick={() => setSheetOpen(false)} className="btn btn-primary flex-[2]">
              Ver {results.length} {results.length === 1 ? "producto" : "productos"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-3 font-display text-xs font-semibold tracking-[0.2em] text-ink-muted uppercase">{title}</legend>
      {children}
    </fieldset>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-lg py-2 text-sm text-white">
      {label}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn("relative h-6 w-11 rounded-full transition", checked ? "bg-nova-gradient" : "bg-white/12")}
      >
        <span className={cn("absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition", checked && "translate-x-5")} />
      </button>
    </label>
  );
}
