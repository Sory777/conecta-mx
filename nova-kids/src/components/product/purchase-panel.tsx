"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Check, Minus, PackageCheck, Plus, Rocket, Zap } from "lucide-react";
import { useStore } from "@/components/store/store-provider";
import { toast } from "@/components/ui/toaster";
import { flyToCart } from "@/lib/fly-to-cart";
import { cn } from "@/lib/format";
import { sortSizes, variantStock, totalStock } from "@/lib/product";
import { store } from "@/config/store";
import type { Product } from "@/lib/types";
import { FavoriteButton } from "./favorite-button";

export function PurchasePanel({ product }: { product: Product }) {
  const { addItem, setCartOpen } = useStore();
  const router = useRouter();
  const sizes = useMemo(() => sortSizes(product.sizes), [product.sizes]);
  const soldOut = totalStock(product) === 0;

  const firstColor = product.colors.find((c) => sizes.some((s) => variantStock(product, s, c.name) > 0)) ?? product.colors[0];
  const [color, setColor] = useState(firstColor?.name ?? "");
  const [size, setSize] = useState<string | null>(sizes.length === 1 ? sizes[0] : null);
  const [qty, setQty] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const available = size ? variantStock(product, size, color) : null;
  const maxQty = available ?? 10;

  function selectColor(name: string) {
    setColor(name);
    setQty(1);
    if (size && variantStock(product, size, name) === 0) setSize(null);
  }

  function add(buyNow: boolean) {
    if (!size) {
      setError("Elige una talla para continuar.");
      return;
    }
    setError(null);
    const res = addItem(product, size, color, qty);
    if (!res.ok) return toast(res.message ?? "No se pudo agregar.", "error");
    if (buyNow) {
      router.push("/checkout");
      return;
    }
    flyToCart(document.querySelector<HTMLElement>("[data-gallery-main]"));
    toast(res.message ?? `Agregado: ${product.name} · Talla ${size}`);
    setTimeout(() => setCartOpen(true), 550);
  }

  return (
    <div className="space-y-7">
      {product.colors.length > 0 && (
        <div>
          <p className="label">
            Color: <span className="text-white">{color}</span>
          </p>
          <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Color">
            {product.colors.map((c) => {
              const hasStock = sizes.some((s) => variantStock(product, s, c.name) > 0);
              return (
                <button
                  key={c.name}
                  type="button"
                  role="radio"
                  aria-checked={color === c.name}
                  aria-label={`${c.name}${hasStock ? "" : " (agotado)"}`}
                  title={c.name}
                  onClick={() => selectColor(c.name)}
                  className={cn(
                    "relative size-11 rounded-full ring-2 ring-offset-[3px] ring-offset-space-950 transition",
                    color === c.name ? "ring-nova-cyan" : "ring-white/15 hover:ring-white/40",
                    !hasStock && "opacity-40",
                  )}
                  style={{ background: c.hex }}
                >
                  {color === c.name && (
                    <Check className={cn("absolute inset-0 m-auto size-4", isLight(c.hex) ? "text-space-900" : "text-white")} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between">
          <p className="label">
            Talla{size && <span className="text-white">: {size}</span>}
          </p>
          <span className="text-xs text-ink-faint">Tallas en años</span>
        </div>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Talla">
          {sizes.map((s) => {
            const stock = variantStock(product, s, color);
            return (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={size === s}
                disabled={stock === 0}
                onClick={() => {
                  setSize(s);
                  setQty(1);
                  setError(null);
                }}
                className="chip min-h-12 min-w-12 text-base"
              >
                {s}
              </button>
            );
          })}
        </div>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div>
          <p className="label">Cantidad</p>
          <div className="flex items-center rounded-full border border-white/12">
            <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid size-12 place-items-center rounded-full hover:bg-white/5" aria-label="Disminuir cantidad">
              <Minus className="size-4" />
            </button>
            <span className="w-10 text-center font-semibold tabular-nums" aria-live="polite">{qty}</span>
            <button
              type="button"
              onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
              disabled={qty >= maxQty}
              className="grid size-12 place-items-center rounded-full hover:bg-white/5 disabled:opacity-30"
              aria-label="Aumentar cantidad"
            >
              <Plus className="size-4" />
            </button>
          </div>
        </div>
        <div className="pt-6 text-sm">
          {soldOut ? (
            <span className="text-danger">Agotado por ahora</span>
          ) : available === null ? (
            <span className="flex items-center gap-1.5 text-success"><PackageCheck className="size-4" /> Disponible</span>
          ) : available === 0 ? (
            <span className="text-danger">Agotado en esta talla y color</span>
          ) : available <= store.lowStockThreshold ? (
            <span className="text-warning">¡Últimas {available} piezas!</span>
          ) : (
            <span className="flex items-center gap-1.5 text-success"><PackageCheck className="size-4" /> {available} disponibles</span>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <button type="button" onClick={() => add(false)} disabled={soldOut} className="btn btn-primary btn-lg w-full text-base tracking-[0.08em] uppercase">
          <Rocket className="rocket-icon size-5" /> Agregar al carrito
        </button>
        <div className="flex gap-3">
          <button type="button" onClick={() => add(true)} disabled={soldOut} className="btn btn-secondary min-w-0 flex-1 px-4">
            <Zap className="size-4" /> Comprar ahora
          </button>
          <FavoriteButton productId={product.id} withLabel className="shrink-0" />
        </div>
      </div>
    </div>
  );
}

function isLight(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 > 0.7;
}
