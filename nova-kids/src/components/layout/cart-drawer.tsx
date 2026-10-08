"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Minus, Plus, Rocket, ShoppingBag, Trash2, Truck, X } from "lucide-react";
import { useStore } from "@/components/store/store-provider";
import { ProductImage } from "@/components/product/product-image";
import { computeTotals } from "@/lib/pricing";
import { cn, formatPrice } from "@/lib/format";
import { sortSizes, stockKey } from "@/lib/product";
import type { CartItem } from "@/lib/cart-types";
import { shippingMethods } from "@/config/store";
import { Logo } from "./logo";

export function CartSummary({ items, shippingMethodId }: { items: CartItem[]; shippingMethodId: string | null }) {
  const t = computeTotals(items, shippingMethodId);
  return (
    <dl className="space-y-2 text-sm">
      <div className="flex justify-between text-ink-muted">
        <dt>Subtotal</dt>
        <dd>{formatPrice(t.subtotal + t.savings)}</dd>
      </div>
      {t.savings > 0 && (
        <div className="flex justify-between text-nova-magenta">
          <dt>Descuento</dt>
          <dd>−{formatPrice(t.savings)}</dd>
        </div>
      )}
      <div className="flex justify-between text-ink-muted">
        <dt>Envío {t.shippingMethod ? <span className="text-ink-faint">({t.shippingMethod.label.toLowerCase()})</span> : null}</dt>
        <dd>{t.shipping === 0 ? <span className="text-success">Gratis</span> : formatPrice(t.shipping)}</dd>
      </div>
      <div className="flex items-baseline justify-between border-t border-white/10 pt-3 text-white">
        <dt className="font-display font-semibold">Total</dt>
        <dd className="font-display text-xl font-bold">{formatPrice(t.total)}</dd>
      </div>
    </dl>
  );
}

export function CartLine({ item, compact = false }: { item: CartItem; compact?: boolean }) {
  const { setQuantity, removeItem, changeVariant, setCartOpen } = useStore();
  const max = Math.max(0, item.stock[stockKey(item.size, item.color)] ?? 0);
  return (
    <li className="flex gap-3 py-4">
      <Link
        href={`/producto/${item.slug}`}
        onClick={() => setCartOpen(false)}
        className="bg-space-800 relative aspect-[4/5] w-20 shrink-0 overflow-hidden rounded-xl ring-1 ring-white/10 sm:w-24"
      >
        {item.image && <ProductImage src={item.image} alt={item.name} fill sizes="96px" className="object-cover" />}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-display text-[10px] font-semibold tracking-[0.2em] text-nova-cyan uppercase">NOVA KIDS</p>
            <Link
              href={`/producto/${item.slug}`}
              onClick={() => setCartOpen(false)}
              className="line-clamp-2 text-sm leading-snug font-medium text-white hover:underline"
            >
              {item.name}
            </Link>
          </div>
          <button
            type="button"
            onClick={() => removeItem(item.key)}
            className="text-ink-faint -m-1.5 shrink-0 rounded-full p-1.5 hover:bg-white/5 hover:text-danger"
            aria-label={`Eliminar ${item.name}`}
          >
            <Trash2 className="size-4" />
          </button>
        </div>

        <div className={cn("mt-2 grid gap-2", compact ? "grid-cols-2" : "grid-cols-2")}>
          <label className="sr-only" htmlFor={`size-${item.key}`}>Talla</label>
          <select
            id={`size-${item.key}`}
            value={item.size}
            onChange={(e) => changeVariant(item.key, e.target.value, item.color)}
            className="field min-h-9 rounded-lg px-2 text-xs"
          >
            {sortSizes(item.sizes).map((s) => (
              <option key={s} value={s} disabled={(item.stock[stockKey(s, item.color)] ?? 0) <= 0}>
                Talla {s}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor={`color-${item.key}`}>Color</label>
          <select
            id={`color-${item.key}`}
            value={item.color}
            onChange={(e) => changeVariant(item.key, item.size, e.target.value)}
            className="field min-h-9 rounded-lg px-2 text-xs"
          >
            {item.colors.map((c) => (
              <option key={c.name} value={c.name} disabled={(item.stock[stockKey(item.size, c.name)] ?? 0) <= 0}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center rounded-full border border-white/12">
            <button
              type="button"
              onClick={() => setQuantity(item.key, item.quantity - 1)}
              className="grid size-9 place-items-center rounded-full hover:bg-white/5"
              aria-label="Disminuir cantidad"
            >
              <Minus className="size-3.5" />
            </button>
            <span className="w-7 text-center text-sm font-semibold tabular-nums" aria-live="polite">
              {item.quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity(item.key, item.quantity + 1)}
              disabled={item.quantity >= max}
              className="grid size-9 place-items-center rounded-full hover:bg-white/5 disabled:opacity-30"
              aria-label="Aumentar cantidad"
            >
              <Plus className="size-3.5" />
            </button>
          </div>
          <div className="text-right">
            <p className="font-display text-sm font-bold text-white">{formatPrice(item.unitPrice * item.quantity)}</p>
            {item.quantity > 1 && <p className="text-ink-faint text-[11px]">{formatPrice(item.unitPrice)} c/u</p>}
          </div>
        </div>
        {max > 0 && max <= 3 && <p className="mt-1 text-[11px] text-warning">Últimas {max} piezas</p>}
        {max === 0 && <p className="mt-1 text-[11px] text-danger">Agotado: cambia la talla o el color</p>}
      </div>
    </li>
  );
}

export function CartDrawer() {
  const { items, cartOpen, setCartOpen, itemCount } = useStore();
  const router = useRouter();
  const t = computeTotals(items, shippingMethods[0]?.id ?? null);

  useEffect(() => {
    if (!cartOpen) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setCartOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [cartOpen, setCartOpen]);

  const freeFrom = shippingMethods[0]?.freeFrom ?? null;
  const progress = freeFrom ? Math.min(100, (t.subtotal / freeFrom) * 100) : 0;

  return (
    <div className={cn("fixed inset-0 z-[70]", cartOpen ? "pointer-events-auto" : "pointer-events-none")} aria-hidden={!cartOpen}>
      <div
        className={cn("absolute inset-0 bg-black/60 backdrop-blur-[2px] transition-opacity duration-300", cartOpen ? "opacity-100" : "opacity-0")}
        onClick={() => setCartOpen(false)}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Carrito de compras"
        className={cn(
          "bg-space-900 absolute inset-y-0 right-0 flex w-full flex-col border-l border-white/10 shadow-2xl transition-transform duration-300 ease-out sm:max-w-md",
          cartOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="flex items-center gap-2.5 font-display text-lg font-semibold">
            <span className="bg-nova-gradient grid size-8 place-items-center rounded-full">
              <Rocket className="size-4 text-white" />
            </span>
            Tu carrito
            {itemCount > 0 && <span className="text-ink-faint text-sm font-normal">({itemCount})</span>}
          </h2>
          <button
            type="button"
            onClick={() => setCartOpen(false)}
            className="btn-ghost -mr-2 inline-flex size-11 items-center justify-center rounded-full"
            aria-label="Cerrar carrito"
          >
            <X className="size-6" />
          </button>
        </header>

        {items.length === 0 ? (
          <div className="relative flex flex-1 flex-col items-center justify-center px-8 text-center">
            <div className="starfield opacity-50" aria-hidden />
            <Logo width={150} href={null} className="relative opacity-90" />
            <ShoppingBag className="text-ink-faint relative mt-8 size-10" />
            <p className="relative mt-3 font-display text-lg font-semibold">Tu carrito está listo para despegar</p>
            <p className="text-ink-muted relative mt-1 text-sm">Agrega tus prendas favoritas para comenzar.</p>
            <button
              type="button"
              className="btn btn-primary relative mt-6"
              onClick={() => {
                setCartOpen(false);
                router.push("/catalogo");
              }}
            >
              <Rocket className="rocket-icon size-4" /> Explorar catálogo
            </button>
          </div>
        ) : (
          <>
            {freeFrom && (
              <div className="border-b border-white/10 px-5 py-3">
                <p className="flex items-center gap-2 text-xs text-ink-muted">
                  <Truck className="size-4 text-nova-cyan" />
                  {t.freeShippingRemaining ? (
                    <span>
                      Te faltan <strong className="text-white">{formatPrice(t.freeShippingRemaining)}</strong> para envío gratis
                    </span>
                  ) : (
                    <span className="text-success">¡Tu pedido tiene envío estándar gratis!</span>
                  )}
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
                  <div className="bg-nova-gradient h-full rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}
            <ul className="flex-1 divide-y divide-white/8 overflow-y-auto overscroll-contain px-5">
              {items.map((item) => (
                <CartLine key={item.key} item={item} />
              ))}
            </ul>
            <footer className="border-t border-white/10 bg-space-950/60 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <CartSummary items={items} shippingMethodId={shippingMethods[0]?.id ?? null} />
              <p className="text-ink-faint mt-2 text-[11px]">Envío estimado. Elige el método final y aplica cupones al continuar.</p>
              <button
                type="button"
                className="btn btn-primary btn-lg mt-4 w-full"
                onClick={() => {
                  setCartOpen(false);
                  router.push("/checkout");
                }}
              >
                <Rocket className="rocket-icon size-5" /> Continuar compra
              </button>
              <button type="button" className="btn btn-ghost btn-sm mt-1 w-full" onClick={() => setCartOpen(false)}>
                Seguir comprando
              </button>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}
