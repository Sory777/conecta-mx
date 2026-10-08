"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ExternalLink, Loader2, Percent, Plus, Save, X } from "lucide-react";
import { toast } from "@/components/ui/toaster";
import { cn, slugify } from "@/lib/format";
import { sortSizes, stockKey } from "@/lib/product";
import { store } from "@/config/store";
import type { Category, Product, ProductColor, ProductInput } from "@/lib/types";
import { ImageManager } from "./image-manager";

const PRESET_COLORS: ProductColor[] = [
  { name: "Azul cósmico", hex: "#2563EB" },
  { name: "Azul marino", hex: "#1E3A8A" },
  { name: "Morado nebulosa", hex: "#7C3AED" },
  { name: "Fucsia", hex: "#DB2777" },
  { name: "Rosa estelar", hex: "#F472B6" },
  { name: "Cian", hex: "#06B6D4" },
  { name: "Blanco", hex: "#F8FAFC" },
  { name: "Negro espacial", hex: "#111827" },
  { name: "Gris luna", hex: "#9CA3AF" },
];

type FormState = Omit<ProductInput, "price" | "compareAtPrice"> & { price: string; compareAtPrice: string };

function initialState(product: Product | null, categories: Category[]): FormState {
  if (product) {
    return {
      ...product,
      price: String(product.price),
      compareAtPrice: product.compareAtPrice === null ? "" : String(product.compareAtPrice),
    };
  }
  return {
    slug: "",
    sku: "",
    name: "",
    description: "",
    price: "",
    compareAtPrice: "",
    categoryId: categories.find((c) => c.kind === "garment")?.id ?? "",
    gender: "unisex",
    sizes: ["4", "6", "8", "10", "12"],
    colors: [],
    stock: {},
    images: [],
    status: "draft",
    isNew: true,
    featured: false,
    seoTitle: null,
    seoDescription: null,
  };
}

export function ProductForm({ product, categories }: { product: Product | null; categories: Category[] }) {
  const router = useRouter();
  const [f, setF] = useState<FormState>(() => initialState(product, categories));
  const [slugTouched, setSlugTouched] = useState(Boolean(product));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customSize, setCustomSize] = useState("");
  const [newColor, setNewColor] = useState<ProductColor>({ name: "", hex: "#8B3DFF" });
  const [discount, setDiscount] = useState("");
  const garmentCategories = categories.filter((c) => c.kind === "garment");

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setF((prev) => ({ ...prev, [key]: value }));

  function setName(name: string) {
    setF((prev) => ({ ...prev, name, slug: slugTouched ? prev.slug : slugify(name) }));
  }

  function toggleSize(size: string) {
    set("sizes", f.sizes.includes(size) ? f.sizes.filter((s) => s !== size) : sortSizes([...f.sizes, size]));
  }

  function addColor(color: ProductColor) {
    const name = color.name.trim();
    if (!name || f.colors.some((c) => c.name.toLowerCase() === name.toLowerCase())) return;
    set("colors", [...f.colors, { name, hex: color.hex.toUpperCase() }]);
    setNewColor({ name: "", hex: "#8B3DFF" });
  }

  function removeColor(name: string) {
    set("colors", f.colors.filter((c) => c.name !== name));
  }

  function setStock(size: string, color: string, value: string) {
    const n = Math.max(0, Math.floor(Number(value) || 0));
    set("stock", { ...f.stock, [stockKey(size, color)]: n });
  }

  function fillStock() {
    const value = prompt("¿Cuántas piezas quieres asignar a todas las combinaciones?", "5");
    if (value === null) return;
    const n = Math.max(0, Math.floor(Number(value) || 0));
    const stock: Record<string, number> = {};
    f.sizes.forEach((s) => f.colors.forEach((c) => (stock[stockKey(s, c.name)] = n)));
    set("stock", stock);
  }

  /** Crea un descuento: el precio actual pasa a "precio anterior" y se calcula el nuevo. */
  function applyDiscount() {
    const pct = Number(discount);
    const base = Number(f.compareAtPrice || f.price);
    if (!base || !pct || pct <= 0 || pct >= 100) return toast("Escribe un porcentaje entre 1 y 99.", "error");
    setF((prev) => ({ ...prev, compareAtPrice: String(base), price: String(Math.round(base * (1 - pct / 100))) }));
    setDiscount("");
  }

  function removeDiscount() {
    if (!f.compareAtPrice) return;
    setF((prev) => ({ ...prev, price: prev.compareAtPrice, compareAtPrice: "" }));
  }

  const totalStock = f.sizes.reduce((sum, s) => sum + f.colors.reduce((n, c) => n + (f.stock[stockKey(s, c.name)] ?? 0), 0), 0);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // Solo se guardan las variantes que existen (talla × color actuales).
    const stock: Record<string, number> = {};
    f.sizes.forEach((s) => f.colors.forEach((c) => (stock[stockKey(s, c.name)] = f.stock[stockKey(s, c.name)] ?? 0)));
    const payload: ProductInput = {
      ...f,
      sku: f.sku.trim() || `NK-${f.slug.slice(0, 12).toUpperCase()}`,
      price: Number(f.price),
      compareAtPrice: f.compareAtPrice === "" ? null : Number(f.compareAtPrice),
      stock,
      seoTitle: f.seoTitle?.trim() || null,
      seoDescription: f.seoDescription?.trim() || null,
    };
    if (!payload.price && payload.price !== 0) return setError("Escribe el precio.");
    setSaving(true);
    const res = await fetch(product ? `/api/admin/products/${product.id}` : "/api/admin/products", {
      method: product ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "No se pudo guardar.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    toast(product ? "Cambios guardados" : "Producto creado");
    if (!product) router.replace(`/admin/productos/${data.product.id}`);
    else router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-6 pb-28">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/productos" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-white">
          <ArrowLeft className="size-4" /> Productos
        </Link>
        {product && product.status === "active" && (
          <Link href={`/producto/${product.slug}`} target="_blank" className="inline-flex items-center gap-1.5 text-sm text-nova-cyan hover:underline">
            Ver en la tienda <ExternalLink className="size-3.5" />
          </Link>
        )}
      </div>
      <h1 className="font-display text-2xl font-bold sm:text-3xl">{product ? "Editar producto" : "Agregar producto"}</h1>

      {error && <p className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">{error}</p>}

      <Card title="Información">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="p-name" className="label">Nombre *</label>
            <input id="p-name" required className="field" value={f.name} onChange={(e) => setName(e.target.value)} placeholder="Conjunto espacial infantil" />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="p-desc" className="label">Descripción</label>
            <textarea id="p-desc" rows={4} className="field" value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="Materiales, cuidados, ajuste…" />
          </div>
          <div>
            <label htmlFor="p-cat" className="label">Categoría *</label>
            <select id="p-cat" required className="field" value={f.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
              <option value="">Selecciona…</option>
              {garmentCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-ink-faint">Niñas, Niños, Novedades y Ofertas se llenan automáticamente.</p>
          </div>
          <div>
            <label htmlFor="p-gender" className="label">Para *</label>
            <select id="p-gender" className="field" value={f.gender} onChange={(e) => set("gender", e.target.value as FormState["gender"])}>
              <option value="unisex">Niña y niño (unisex)</option>
              <option value="nina">Niña</option>
              <option value="nino">Niño</option>
            </select>
          </div>
          <div>
            <label htmlFor="p-sku" className="label">Código / SKU</label>
            <input id="p-sku" className="field uppercase" value={f.sku} onChange={(e) => set("sku", e.target.value.toUpperCase())} placeholder="NK-CJ-001" />
          </div>
          <div>
            <label htmlFor="p-slug" className="label">URL del producto *</label>
            <div className="flex items-center rounded-xl border border-white/10 bg-space-900 pl-3 text-sm text-ink-faint focus-within:border-nova-cyan/70">
              /producto/
              <input
                id="p-slug"
                required
                className="min-h-12 min-w-0 flex-1 bg-transparent pr-3 text-ink outline-none"
                value={f.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  set("slug", slugify(e.target.value));
                }}
              />
            </div>
          </div>
        </div>
      </Card>

      <Card title="Fotografías">
        <ImageManager images={f.images} onChange={(images) => set("images", images)} productName={f.name} />
      </Card>

      <Card title="Precio y descuento">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="p-price" className="label">Precio (MXN) *</label>
            <input id="p-price" required type="number" min={0} step="0.01" inputMode="decimal" className="field" value={f.price} onChange={(e) => set("price", e.target.value)} />
          </div>
          <div>
            <label htmlFor="p-compare" className="label">Precio anterior (opcional)</label>
            <input id="p-compare" type="number" min={0} step="0.01" inputMode="decimal" className="field" value={f.compareAtPrice} onChange={(e) => set("compareAtPrice", e.target.value)} placeholder="Para mostrar oferta" />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-2 rounded-xl bg-white/3 p-3">
          <div>
            <label htmlFor="p-disc" className="label">Crear descuento rápido</label>
            <div className="relative">
              <input id="p-disc" type="number" min={1} max={99} className="field min-h-10 w-28 pr-8 text-sm" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="20" />
              <Percent className="pointer-events-none absolute top-1/2 right-3 size-3.5 -translate-y-1/2 text-ink-faint" />
            </div>
          </div>
          <button type="button" onClick={applyDiscount} className="btn btn-secondary btn-sm">Aplicar</button>
          {f.compareAtPrice && (
            <button type="button" onClick={removeDiscount} className="btn btn-ghost btn-sm">Quitar oferta</button>
          )}
        </div>
      </Card>

      <Card title="Tallas">
        <div className="flex flex-wrap gap-2">
          {sortSizes([...new Set([...store.sizeOrder, ...f.sizes])]).map((s) => (
            <button key={s} type="button" className="chip" aria-pressed={f.sizes.includes(s)} onClick={() => toggleSize(s)}>
              {s}
            </button>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input value={customSize} onChange={(e) => setCustomSize(e.target.value.toUpperCase())} placeholder="Otra talla (ej. XS, 18)" className="field min-h-10 max-w-48 text-sm" aria-label="Agregar talla personalizada" />
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              const s = customSize.trim();
              if (s && !f.sizes.includes(s)) set("sizes", sortSizes([...f.sizes, s]));
              setCustomSize("");
            }}
          >
            <Plus className="size-4" /> Agregar
          </button>
        </div>
      </Card>

      <Card title="Colores">
        <div className="flex flex-wrap gap-2">
          {f.colors.map((c) => (
            <span key={c.name} className="inline-flex items-center gap-2 rounded-full border border-white/12 py-1 pr-1.5 pl-1.5 text-sm">
              <span className="size-6 rounded-full ring-1 ring-white/20" style={{ background: c.hex }} />
              {c.name}
              <button type="button" onClick={() => removeColor(c.name)} className="grid size-6 place-items-center rounded-full hover:bg-white/10" aria-label={`Quitar ${c.name}`}>
                <X className="size-3.5" />
              </button>
            </span>
          ))}
          {!f.colors.length && <p className="text-sm text-ink-faint">Agrega al menos un color.</p>}
        </div>
        <p className="label mt-4">Colores frecuentes</p>
        <div className="flex flex-wrap gap-2">
          {PRESET_COLORS.filter((p) => !f.colors.some((c) => c.name === p.name)).map((p) => (
            <button key={p.name} type="button" onClick={() => addColor(p)} className="chip gap-2 text-xs">
              <span className="size-4 rounded-full ring-1 ring-white/20" style={{ background: p.hex }} /> {p.name}
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="c-hex" className="label">Color nuevo</label>
            <input id="c-hex" type="color" value={newColor.hex} onChange={(e) => setNewColor({ ...newColor, hex: e.target.value })} className="h-10 w-14 cursor-pointer rounded-lg border border-white/10 bg-space-900 p-1" />
          </div>
          <input value={newColor.name} onChange={(e) => setNewColor({ ...newColor, name: e.target.value })} placeholder="Nombre del color" className="field min-h-10 max-w-56 text-sm" aria-label="Nombre del color" />
          <button type="button" onClick={() => addColor(newColor)} className="btn btn-ghost btn-sm">
            <Plus className="size-4" /> Agregar color
          </button>
        </div>
      </Card>

      <Card
        title={`Inventario · ${totalStock} piezas`}
        action={
          f.sizes.length > 0 && f.colors.length > 0 ? (
            <button type="button" onClick={fillStock} className="text-xs text-nova-cyan hover:underline">Llenar todo</button>
          ) : null
        }
      >
        {f.sizes.length && f.colors.length ? (
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[320px] text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-faint">
                  <th className="py-2 pr-3 font-medium">Talla</th>
                  {f.colors.map((c) => (
                    <th key={c.name} className="px-1 py-2 font-medium">
                      <span className="flex items-center gap-1.5 whitespace-nowrap">
                        <span className="size-3 rounded-full" style={{ background: c.hex }} />
                        {c.name}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortSizes(f.sizes).map((s) => (
                  <tr key={s} className="border-t border-white/6">
                    <td className="py-2 pr-3 font-semibold">{s}</td>
                    {f.colors.map((c) => {
                      const v = f.stock[stockKey(s, c.name)] ?? 0;
                      return (
                        <td key={c.name} className="px-1 py-1.5">
                          <input
                            type="number"
                            min={0}
                            inputMode="numeric"
                            aria-label={`Inventario talla ${s} color ${c.name}`}
                            value={v}
                            onChange={(e) => setStock(s, c.name, e.target.value)}
                            className={cn("field min-h-9 w-20 rounded-lg px-2 text-sm", v === 0 && "text-danger")}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-ink-faint">Selecciona tallas y colores para capturar el inventario por variante.</p>
        )}
      </Card>

      <Card title="Visibilidad">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="p-status" className="label">Estado</label>
            <select id="p-status" className="field" value={f.status} onChange={(e) => set("status", e.target.value as FormState["status"])}>
              <option value="active">Activo (visible)</option>
              <option value="draft">Borrador (oculto)</option>
              <option value="archived">Archivado</option>
            </select>
          </div>
          <Check label="Marcar como NUEVO" checked={f.isNew} onChange={(v) => set("isNew", v)} />
          <Check label="Destacar en inicio" checked={f.featured} onChange={(v) => set("featured", v)} />
        </div>
      </Card>

      <Card title="SEO (opcional)">
        <div className="space-y-4">
          <div>
            <label htmlFor="p-seot" className="label">Título para buscadores ({(f.seoTitle ?? "").length}/70)</label>
            <input id="p-seot" maxLength={70} className="field" value={f.seoTitle ?? ""} onChange={(e) => set("seoTitle", e.target.value)} placeholder={f.name || "Se usa el nombre del producto"} />
          </div>
          <div>
            <label htmlFor="p-seod" className="label">Descripción para buscadores ({(f.seoDescription ?? "").length}/170)</label>
            <textarea id="p-seod" maxLength={170} rows={2} className="field" value={f.seoDescription ?? ""} onChange={(e) => set("seoDescription", e.target.value)} placeholder="Se usa el inicio de la descripción" />
          </div>
          <p className="text-xs text-ink-faint">La imagen social (Open Graph) es la foto principal del producto.</p>
        </div>
      </Card>

      <div className="surface-glass fixed inset-x-0 bottom-0 z-30 border-x-0 border-b-0 px-4 py-3 lg:left-60">
        <div className="mx-auto flex max-w-6xl items-center justify-end gap-3">
          <Link href="/admin/productos" className="btn btn-ghost">Cancelar</Link>
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Guardar producto
          </button>
        </div>
      </div>
    </form>
  );
}

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="surface p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center gap-3 self-end rounded-xl border border-white/10 px-4 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-[#8b3dff]" />
      {label}
    </label>
  );
}
