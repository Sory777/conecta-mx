"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Eye, EyeOff, ImageOff, Pencil, Search, Trash2 } from "lucide-react";
import { ProductImage } from "@/components/product/product-image";
import { toast } from "@/components/ui/toaster";
import { cn, formatPrice, normalizeText } from "@/lib/format";
import { isOnSale, totalStock } from "@/lib/product";
import type { Category, Product, ProductStatus } from "@/lib/types";

const STATUS: Record<ProductStatus, { label: string; cls: string }> = {
  active: { label: "Activo", cls: "bg-success/15 text-success" },
  draft: { label: "Borrador", cls: "bg-white/10 text-ink-muted" },
  archived: { label: "Archivado", cls: "bg-danger/15 text-danger" },
};

export function ProductTable({ initial, categories }: { initial: Product[]; categories: Category[] }) {
  const [products, setProducts] = useState(initial);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | ProductStatus>("all");
  const [category, setCategory] = useState("all");
  const catName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const list = products
    .filter((p) => status === "all" || p.status === status)
    .filter((p) => category === "all" || p.categoryId === category)
    .filter((p) => !query || normalizeText(`${p.name} ${p.sku}`).includes(normalizeText(query)))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  async function toggle(p: Product) {
    const next: ProductStatus = p.status === "active" ? "draft" : "active";
    const res = await fetch(`/api/admin/products/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    const data = await res.json();
    if (!res.ok) return toast(data.error, "error");
    setProducts((prev) => prev.map((x) => (x.id === p.id ? data.product : x)));
    toast(next === "active" ? "Producto activado: ya es visible en la tienda" : "Producto desactivado");
  }

  async function remove(p: Product) {
    if (!confirm(`¿Eliminar "${p.name}"? Esta acción no se puede deshacer.\n\nSi solo quieres ocultarlo, usa "Desactivar".`)) return;
    const res = await fetch(`/api/admin/products/${p.id}`, { method: "DELETE" });
    if (!res.ok) return toast((await res.json()).error, "error");
    setProducts((prev) => prev.filter((x) => x.id !== p.id));
    toast("Producto eliminado");
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre o SKU" className="field min-h-11 pl-9 text-sm" />
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="field min-h-11 text-sm sm:w-48" aria-label="Categoría">
          <option value="all">Todas las categorías</option>
          {categories.filter((c) => c.kind === "garment").map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="field min-h-11 text-sm sm:w-40" aria-label="Estado">
          <option value="all">Todos</option>
          <option value="active">Activos</option>
          <option value="draft">Borradores</option>
          <option value="archived">Archivados</option>
        </select>
      </div>

      {list.length === 0 ? (
        <p className="surface py-12 text-center text-sm text-ink-muted">No hay productos con esos filtros.</p>
      ) : (
        <ul className="surface divide-y divide-white/8">
          {list.map((p) => {
            const stock = totalStock(p);
            return (
              <li key={p.id} className="flex items-center gap-3 p-3 sm:gap-4 sm:p-4">
                <span className="bg-space-800 relative aspect-[4/5] w-12 shrink-0 overflow-hidden rounded-lg sm:w-14">
                  {p.images[0] ? <ProductImage src={p.images[0].url} alt="" fill sizes="56px" className="object-cover" /> : <ImageOff className="m-auto mt-4 size-4 text-ink-faint" />}
                </span>
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/productos/${p.id}`} className="block truncate font-medium text-white hover:underline">{p.name}</Link>
                  <p className="truncate text-xs text-ink-faint">
                    {p.sku} · {catName.get(p.categoryId) ?? "Sin categoría"} · {p.images.length} fotos
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <span className={cn("rounded-full px-2 py-0.5 font-semibold", STATUS[p.status].cls)}>{STATUS[p.status].label}</span>
                    <span className={stock === 0 ? "text-danger" : "text-ink-muted"}>{stock} en inventario</span>
                    <span className="font-semibold text-white sm:hidden">{formatPrice(p.price)}</span>
                  </div>
                </div>
                <div className="hidden w-28 text-right sm:block">
                  <p className="font-semibold">{formatPrice(p.price)}</p>
                  {isOnSale(p) && <p className="text-xs text-ink-faint line-through">{formatPrice(p.compareAtPrice!)}</p>}
                </div>
                <div className="flex shrink-0 gap-0.5">
                  <button type="button" onClick={() => toggle(p)} className="btn-ghost grid size-9 place-items-center rounded-full" title={p.status === "active" ? "Desactivar" : "Activar"} aria-label={p.status === "active" ? "Desactivar" : "Activar"}>
                    {p.status === "active" ? <Eye className="size-4 text-success" /> : <EyeOff className="size-4" />}
                  </button>
                  <Link href={`/admin/productos/${p.id}`} className="btn-ghost grid size-9 place-items-center rounded-full" title="Editar" aria-label="Editar">
                    <Pencil className="size-4" />
                  </Link>
                  <button type="button" onClick={() => remove(p)} className="btn-ghost grid size-9 place-items-center rounded-full hover:text-danger" title="Eliminar" aria-label="Eliminar">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
