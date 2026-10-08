"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ImageOff, Rocket, X } from "lucide-react";
import { useStore } from "@/components/store/store-provider";
import { toast } from "@/components/ui/toaster";
import { flyToCart } from "@/lib/fly-to-cart";
import { cn } from "@/lib/format";
import { discountPercent, isNewProduct, isOnSale, sortSizes, totalStock, variantStock } from "@/lib/product";
import type { Product } from "@/lib/types";
import { FavoriteButton } from "./favorite-button";
import { Price } from "./price";
import { ProductImage } from "./product-image";

export function ProductCard({ product, priority = false }: { product: Product; priority?: boolean }) {
  const { addItem, setCartOpen } = useStore();
  const [picking, setPicking] = useState(false);
  const [color, setColor] = useState(
    () => product.colors.find((c) => product.sizes.some((s) => variantStock(product, s, c.name) > 0))?.name ?? product.colors[0]?.name ?? "",
  );
  const imageRef = useRef<HTMLDivElement>(null);

  const [primary, secondary] = product.images;
  const soldOut = totalStock(product) === 0;
  const sale = isOnSale(product);
  const fresh = isNewProduct(product);
  const sizes = sortSizes(product.sizes);
  const href = `/producto/${product.slug}`;

  function add(size: string, colorName: string) {
    const res = addItem(product, size, colorName, 1);
    if (!res.ok) return toast(res.message ?? "No se pudo agregar.", "error");
    flyToCart(imageRef.current);
    toast(res.message ?? `${product.name} · Talla ${size} agregado`);
    setPicking(false);
    setTimeout(() => setCartOpen(true), 550);
  }

  function onAddClick() {
    if (soldOut) return;
    const singleSize = sizes.length === 1;
    const singleColor = product.colors.length === 1;
    if (singleSize && singleColor) add(sizes[0], product.colors[0].name);
    else setPicking(true);
  }

  return (
    <article className="group relative flex flex-col">
      <div
        ref={imageRef}
        className="bg-space-800 relative aspect-[4/5] overflow-hidden rounded-[var(--radius-card)] ring-1 ring-white/8 transition duration-300 group-hover:ring-white/20 group-hover:shadow-[0_20px_50px_-25px_rgba(139,61,255,.7)]"
      >
        <Link href={href} aria-label={product.name} className="absolute inset-0">
          {primary ? (
            <>
              <ProductImage
                src={primary.url}
                alt={primary.alt || product.name}
                fill
                priority={priority}
                sizes="(min-width:1280px) 300px, (min-width:768px) 33vw, 50vw"
                className={cn("object-cover transition duration-500", secondary && "md:group-hover:opacity-0", soldOut && "opacity-60")}
              />
              {secondary && (
                <ProductImage
                  src={secondary.url}
                  alt={secondary.alt || product.name}
                  fill
                  sizes="(min-width:1280px) 300px, (min-width:768px) 33vw, 50vw"
                  className="hidden scale-105 object-cover opacity-0 transition duration-500 md:block md:group-hover:scale-100 md:group-hover:opacity-100"
                />
              )}
            </>
          ) : (
            <div className="text-ink-faint grid h-full place-items-center">
              <ImageOff className="size-8" />
            </div>
          )}
        </Link>

        <div className="pointer-events-none absolute top-3 left-3 flex flex-col items-start gap-1.5">
          {fresh && !soldOut && <span className="badge badge-new">Nuevo</span>}
          {sale && !soldOut && <span className="badge badge-sale">Oferta −{discountPercent(product)}%</span>}
          {soldOut && <span className="badge bg-white/90 text-space-900">Agotado</span>}
        </div>
        <FavoriteButton productId={product.id} className="absolute top-2.5 right-2.5" />

        {/* Selector rápido de talla */}
        {picking && (
          <div className="surface-glass animate-fade-up absolute inset-x-2 bottom-2 rounded-2xl p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-display text-xs font-semibold tracking-wider text-ink-muted uppercase">Elige talla</p>
              <button type="button" onClick={() => setPicking(false)} aria-label="Cerrar" className="text-ink-muted -m-1 p-1 hover:text-white">
                <X className="size-4" />
              </button>
            </div>
            {product.colors.length > 1 && (
              <div className="mb-2.5 flex flex-wrap gap-2" role="radiogroup" aria-label="Color">
                {product.colors.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    role="radio"
                    aria-checked={color === c.name}
                    aria-label={c.name}
                    title={c.name}
                    onClick={() => setColor(c.name)}
                    className={cn("size-7 rounded-full ring-2 ring-offset-2 ring-offset-space-900 transition", color === c.name ? "ring-nova-cyan" : "ring-transparent")}
                    style={{ background: c.hex }}
                  />
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              {sizes.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={variantStock(product, s, color) === 0}
                  onClick={() => add(s, color)}
                  className="chip min-h-9 min-w-9 px-2.5 text-xs"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col pt-3.5">
        <p className="font-display text-[11px] font-semibold tracking-[0.2em] text-nova-cyan/90 uppercase">NOVA KIDS</p>
        <h3 className="mt-1 line-clamp-2 text-[15px] leading-snug font-medium text-white">
          <Link href={href} className="hover:underline hover:decoration-nova-cyan/60 hover:underline-offset-4">
            {product.name}
          </Link>
        </h3>
        <Price price={product.price} compareAt={product.compareAtPrice} className="mt-1.5" />
        {product.colors.length > 1 && (
          <div className="mt-2 flex gap-1.5" aria-label={`${product.colors.length} colores`}>
            {product.colors.map((c) => (
              <span key={c.name} title={c.name} className="size-3.5 rounded-full ring-1 ring-white/25" style={{ background: c.hex }} />
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={onAddClick}
          disabled={soldOut}
          className="btn btn-secondary btn-sm mt-3.5 w-full px-2 text-[13px] whitespace-nowrap sm:px-4 sm:text-sm"
        >
          {soldOut ? (
            "Agotado"
          ) : (
            <>
              <Rocket className="rocket-icon hidden size-4 shrink-0 min-[400px]:block" aria-hidden />
              Agregar al carrito
            </>
          )}
        </button>
      </div>
    </article>
  );
}
