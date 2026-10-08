"use client";

import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, Star, Trash2 } from "lucide-react";
import { ProductImage } from "@/components/product/product-image";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/format";
import type { ProductImage as Img } from "@/lib/types";

/** Galería editable: subir varias fotos, elegir la principal, reordenar, texto alternativo y eliminar. */
export function ImageManager({ images, onChange, productName }: { images: Img[]; onChange: (imgs: Img[]) => void; productName: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  async function upload(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    setUploading(true);
    const form = new FormData();
    list.forEach((f) => form.append("files", f));
    const res = await fetch("/api/admin/upload", { method: "POST", body: form });
    const data = (await res.json()) as { urls?: string[]; error?: string };
    setUploading(false);
    if (data.urls?.length) {
      onChange([...images, ...data.urls.map((url) => ({ url, alt: productName }))]);
      toast(`${data.urls.length} foto${data.urls.length === 1 ? "" : "s"} subida${data.urls.length === 1 ? "" : "s"}`);
    }
    if (!res.ok) toast(data.error ?? "No se pudo subir la imagen.", "error");
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= images.length) return;
    const next = [...images];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  function makeMain(i: number) {
    const next = [...images];
    const [img] = next.splice(i, 1);
    onChange([img, ...next]);
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          upload(e.dataTransfer.files);
        }}
        className={cn(
          "grid grid-cols-2 gap-3 rounded-2xl border-2 border-dashed p-3 transition sm:grid-cols-3 lg:grid-cols-4",
          dragging ? "border-nova-cyan bg-nova-cyan/5" : "border-white/10",
        )}
      >
        {images.map((img, i) => (
          <div key={img.url + i} className="group relative">
            <div className={cn("bg-space-800 relative aspect-[4/5] overflow-hidden rounded-xl ring-2", i === 0 ? "ring-nova-cyan" : "ring-transparent")}>
              <ProductImage src={img.url} alt={img.alt} fill sizes="200px" className="object-cover" />
              {i === 0 && <span className="badge badge-new absolute top-2 left-2">Principal</span>}
              <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-gradient-to-t from-black/80 to-transparent p-2 pt-6">
                <IconBtn label="Mover a la izquierda" onClick={() => move(i, -1)} disabled={i === 0}>
                  <ArrowLeft className="size-3.5" />
                </IconBtn>
                {i !== 0 && (
                  <IconBtn label="Usar como principal" onClick={() => makeMain(i)}>
                    <Star className="size-3.5" />
                  </IconBtn>
                )}
                <IconBtn label="Mover a la derecha" onClick={() => move(i, 1)} disabled={i === images.length - 1}>
                  <ArrowRight className="size-3.5" />
                </IconBtn>
                <IconBtn label="Eliminar foto" onClick={() => onChange(images.filter((_, x) => x !== i))} danger>
                  <Trash2 className="size-3.5" />
                </IconBtn>
              </div>
            </div>
            <input
              value={img.alt}
              onChange={(e) => onChange(images.map((x, idx) => (idx === i ? { ...x, alt: e.target.value } : x)))}
              placeholder="Descripción (SEO)"
              aria-label={`Texto alternativo de la foto ${i + 1}`}
              className="field mt-1.5 min-h-8 rounded-lg px-2 text-xs"
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex aspect-[4/5] flex-col items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/3 text-sm text-ink-muted transition hover:border-nova-cyan/50 hover:text-white"
        >
          {uploading ? <Loader2 className="size-6 animate-spin" /> : <ImagePlus className="size-6" />}
          {uploading ? "Subiendo…" : "Agregar fotos"}
          <span className="px-3 text-center text-[11px] text-ink-faint">JPG, PNG o WebP · arrastra aquí</span>
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) upload(e.target.files);
          e.target.value = "";
        }}
      />
      <p className="mt-2 text-xs text-ink-faint">La primera foto es la principal (la que se ve en el catálogo). La segunda aparece al pasar el cursor. Se optimizan automáticamente.</p>
    </div>
  );
}

function IconBtn({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn("grid size-7 place-items-center rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/30 disabled:opacity-30", danger && "hover:bg-danger")}
    >
      {children}
    </button>
  );
}
