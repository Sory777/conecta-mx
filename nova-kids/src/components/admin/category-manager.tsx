"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Eye, EyeOff, ImagePlus, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "@/components/ui/toaster";
import { cn, slugify } from "@/lib/format";
import type { Category, CategoryInput, CategoryKind } from "@/lib/types";

const KINDS: { id: CategoryKind; label: string; hint: string }[] = [
  { id: "garment", label: "Tipo de prenda", hint: "Se asigna manualmente a cada producto" },
  { id: "gender", label: "Por género", hint: "Muestra productos de niña o niño (y unisex)" },
  { id: "new", label: "Novedades", hint: "Productos marcados como nuevos o recientes" },
  { id: "sale", label: "Ofertas", hint: "Productos con precio anterior" },
];

const blank: CategoryInput = { slug: "", name: "", description: "", image: null, kind: "garment", gender: null, sortOrder: 10, visible: true };

export function CategoryManager({ initial, counts }: { initial: Category[]; counts: Record<string, number> }) {
  const router = useRouter();
  const [categories, setCategories] = useState(initial);
  const [editing, setEditing] = useState<{ id: string | null; data: CategoryInput } | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    const res = await fetch(editing.id ? `/api/admin/categories/${editing.id}` : "/api/admin/categories", {
      method: editing.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing.data),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) return toast(data.error, "error");
    setCategories((prev) =>
      (editing.id ? prev.map((c) => (c.id === editing.id ? data.category : c)) : [...prev, data.category]).sort(
        (a: Category, b: Category) => a.sortOrder - b.sortOrder,
      ),
    );
    setEditing(null);
    toast("Categoría guardada");
    router.refresh();
  }

  async function toggle(c: Category) {
    const { id, ...rest } = c;
    const res = await fetch(`/api/admin/categories/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...rest, visible: !c.visible }),
    });
    const data = await res.json();
    if (!res.ok) return toast(data.error, "error");
    setCategories((prev) => prev.map((x) => (x.id === id ? data.category : x)));
  }

  async function remove(c: Category) {
    if (!confirm(`¿Eliminar la categoría "${c.name}"?`)) return;
    const res = await fetch(`/api/admin/categories/${c.id}`, { method: "DELETE" });
    if (!res.ok) return toast((await res.json()).error, "error");
    setCategories((prev) => prev.filter((x) => x.id !== c.id));
    toast("Categoría eliminada");
  }

  async function uploadImage(file: File) {
    if (!editing) return;
    setUploading(true);
    const form = new FormData();
    form.append("files", file);
    const res = await fetch("/api/admin/upload", { method: "POST", body: form });
    const data = await res.json();
    setUploading(false);
    if (!res.ok || !data.urls?.[0]) return toast(data.error ?? "No se pudo subir la imagen.", "error");
    setEditing({ ...editing, data: { ...editing.data, image: data.urls[0] } });
  }

  const d = editing?.data;

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing({ id: null, data: { ...blank, sortOrder: categories.length + 1 } })}>
          <Plus className="size-4" /> Nueva categoría
        </button>
      </div>
      <ul className="surface divide-y divide-white/8">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center gap-3 p-3 sm:p-4">
            <span className="bg-space-800 relative size-12 shrink-0 overflow-hidden rounded-lg">
              {c.image && <Image src={c.image} alt="" fill sizes="48px" unoptimized={c.image.endsWith(".svg")} className="object-cover" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn("font-medium", !c.visible && "text-ink-faint")}>{c.name}</p>
              <p className="truncate text-xs text-ink-faint">
                /categoria/{c.slug} · {KINDS.find((k) => k.id === c.kind)?.label} · {counts[c.id] ?? 0} productos
              </p>
            </div>
            <button type="button" onClick={() => toggle(c)} className="btn-ghost grid size-9 place-items-center rounded-full" aria-label={c.visible ? "Ocultar" : "Mostrar"} title={c.visible ? "Ocultar" : "Mostrar"}>
              {c.visible ? <Eye className="size-4 text-success" /> : <EyeOff className="size-4" />}
            </button>
            <button type="button" onClick={() => setEditing({ id: c.id, data: { ...c } })} className="btn-ghost grid size-9 place-items-center rounded-full" aria-label="Editar">
              <Pencil className="size-4" />
            </button>
            <button type="button" onClick={() => remove(c)} className="btn-ghost grid size-9 place-items-center rounded-full hover:text-danger" aria-label="Eliminar">
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
      </ul>

      {editing && d && (
        <div className="fixed inset-0 z-50 grid place-items-end sm:place-items-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setEditing(null)} />
          <form onSubmit={save} className="bg-space-900 relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/10 p-6 sm:rounded-3xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">{editing.id ? "Editar categoría" : "Nueva categoría"}</h2>
              <button type="button" onClick={() => setEditing(null)} className="btn-ghost grid size-9 place-items-center rounded-full" aria-label="Cerrar">
                <X className="size-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label htmlFor="cat-name" className="label">Nombre</label>
                <input
                  id="cat-name"
                  required
                  className="field"
                  value={d.name}
                  onChange={(e) => setEditing({ ...editing, data: { ...d, name: e.target.value, slug: editing.id ? d.slug : slugify(e.target.value) } })}
                />
              </div>
              <div>
                <label htmlFor="cat-slug" className="label">URL</label>
                <input id="cat-slug" required className="field" value={d.slug} onChange={(e) => setEditing({ ...editing, data: { ...d, slug: slugify(e.target.value) } })} />
              </div>
              <div>
                <label htmlFor="cat-desc" className="label">Descripción</label>
                <input id="cat-desc" className="field" value={d.description} onChange={(e) => setEditing({ ...editing, data: { ...d, description: e.target.value } })} />
              </div>
              <div>
                <label htmlFor="cat-kind" className="label">Tipo</label>
                <select id="cat-kind" className="field" value={d.kind} onChange={(e) => setEditing({ ...editing, data: { ...d, kind: e.target.value as CategoryKind, gender: e.target.value === "gender" ? d.gender ?? "nina" : null } })}>
                  {KINDS.map((k) => (
                    <option key={k.id} value={k.id}>{k.label}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-ink-faint">{KINDS.find((k) => k.id === d.kind)?.hint}</p>
              </div>
              {d.kind === "gender" && (
                <div>
                  <label htmlFor="cat-gender" className="label">Género</label>
                  <select id="cat-gender" className="field" value={d.gender ?? "nina"} onChange={(e) => setEditing({ ...editing, data: { ...d, gender: e.target.value as CategoryInput["gender"] } })}>
                    <option value="nina">Niña</option>
                    <option value="nino">Niño</option>
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="cat-order" className="label">Orden</label>
                  <input id="cat-order" type="number" min={0} className="field" value={d.sortOrder} onChange={(e) => setEditing({ ...editing, data: { ...d, sortOrder: Number(e.target.value) } })} />
                </div>
                <label className="flex items-center gap-3 self-end pb-3 text-sm">
                  <input type="checkbox" checked={d.visible} onChange={(e) => setEditing({ ...editing, data: { ...d, visible: e.target.checked } })} className="size-4 accent-[#8b3dff]" />
                  Visible en la tienda
                </label>
              </div>
              <div>
                <p className="label">Imagen</p>
                <div className="flex items-center gap-3">
                  <span className="bg-space-800 relative aspect-[4/5] w-20 overflow-hidden rounded-lg">
                    {d.image && <Image src={d.image} alt="" fill sizes="80px" unoptimized={d.image.endsWith(".svg")} className="object-cover" />}
                  </span>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />} Cambiar imagen
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])} />
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving && <Loader2 className="size-4 animate-spin" />} Guardar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
