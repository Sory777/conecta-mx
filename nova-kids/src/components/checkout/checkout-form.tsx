"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { ArrowLeft, Check, CreditCard, Landmark, Loader2, Lock, MapPin, Rocket, Tag, Truck, User, Wallet } from "lucide-react";
import { useStore } from "@/components/store/store-provider";
import { ProductImage } from "@/components/product/product-image";
import { Logo } from "@/components/layout/logo";
import { computeTotals } from "@/lib/pricing";
import { cn, formatPrice } from "@/lib/format";
import { cartKey, type CartItem } from "@/lib/cart-types";
import type { ShippingMethod } from "@/config/store";
import type { OrderAddress, OrderCustomer, PaymentMethodId } from "@/lib/types";
import type { PaymentMethodInfo } from "@/lib/payments/types";
import { MX_STATES } from "@/lib/mx-states";

const PROFILE_KEY = "nk_checkout_profile_v1";
const STEPS = [
  { id: 1, label: "Datos", Icon: User },
  { id: 2, label: "Dirección", Icon: MapPin },
  { id: 3, label: "Envío", Icon: Truck },
  { id: 4, label: "Pago", Icon: CreditCard },
];
const PAYMENT_ICONS: Record<PaymentMethodId, typeof CreditCard> = {
  mercadopago: Wallet,
  stripe: CreditCard,
  paypal: Wallet,
  transferencia: Landmark,
};

const emptyCustomer: OrderCustomer = { firstName: "", lastName: "", phone: "", email: "" };
const emptyAddress: OrderAddress = { street: "", number: "", neighborhood: "", city: "", state: "", postalCode: "", references: "" };

export function CheckoutForm({ shippingMethods, paymentMethods }: { shippingMethods: ShippingMethod[]; paymentMethods: PaymentMethodInfo[] }) {
  const { items, hydrated, replaceItems, clearCart } = useStore();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [customer, setCustomer] = useState(emptyCustomer);
  const [address, setAddress] = useState(emptyAddress);
  const [shippingId, setShippingId] = useState(shippingMethods[0]?.id ?? "");
  const [payment, setPayment] = useState<PaymentMethodId>(paymentMethods[0]?.id ?? "transferencia");
  const [remember, setRemember] = useState(true);
  const [coupon, setCoupon] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Datos guardados en este dispositivo.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? "null");
      if (saved?.customer) setCustomer({ ...emptyCustomer, ...saved.customer });
      if (saved?.address) setAddress({ ...emptyAddress, ...saved.address });
    } catch {
      /* sin datos guardados */
    }
  }, []);

  // Actualiza precios e inventario del carrito con los datos actuales del servidor.
  useEffect(() => {
    if (!hydrated || !items.length) return;
    let cancelled = false;
    fetch("/api/cart/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productIds: [...new Set(items.map((i) => i.productId))] }),
    })
      .then((r) => r.json())
      .then(({ products }: { products: { id: string; slug: string; name: string; image: string | null; price: number; compareAtPrice: number | null; sizes: string[]; colors: CartItem["colors"]; stock: Record<string, number> }[] }) => {
        if (cancelled || !products) return;
        const byId = new Map(products.map((p) => [p.id, p]));
        const changes: string[] = [];
        const next: CartItem[] = [];
        for (const item of items) {
          const p = byId.get(item.productId);
          if (!p) {
            changes.push(`${item.name} ya no está disponible y se quitó del carrito.`);
            continue;
          }
          const stock = p.stock[`${item.size}|${item.color}`] ?? 0;
          if (stock <= 0) {
            changes.push(`${item.name} (talla ${item.size}) se agotó y se quitó del carrito.`);
            continue;
          }
          if (p.price !== item.unitPrice) changes.push(`El precio de ${item.name} se actualizó.`);
          if (item.quantity > stock) changes.push(`Ajustamos ${item.name} a ${stock} piezas disponibles.`);
          next.push({
            ...item,
            key: cartKey(item.productId, item.size, item.color),
            slug: p.slug,
            name: p.name,
            image: p.image,
            unitPrice: p.price,
            compareAtPrice: p.compareAtPrice,
            sizes: p.sizes,
            colors: p.colors,
            stock: p.stock,
            quantity: Math.min(item.quantity, stock),
          });
        }
        if (changes.length) {
          setNotice(changes.join(" "));
          replaceItems(next);
        } else if (JSON.stringify(next) !== JSON.stringify(items)) {
          replaceItems(next);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // Solo al entrar al checkout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  const totals = computeTotals(items, shippingId, appliedCoupon?.discount ?? 0);

  // Si cambia el subtotal, el cupón debe revalidarse.
  useEffect(() => {
    setAppliedCoupon(null);
  }, [totals.subtotal]);

  async function applyCoupon() {
    setCouponMsg(null);
    const res = await fetch("/api/coupons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: coupon, subtotal: totals.subtotal }),
    });
    const data = await res.json();
    if (data.ok) {
      setAppliedCoupon({ code: data.code, discount: data.discount });
      setCouponMsg(`Cupón ${data.code} aplicado.`);
    } else {
      setAppliedCoupon(null);
      setCouponMsg(data.error ?? "Cupón no válido.");
    }
  }

  async function placeOrder() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer,
          address,
          shippingMethodId: shippingId,
          paymentMethod: payment,
          couponCode: appliedCoupon?.code ?? null,
          items: items.map((i) => ({ productId: i.productId, size: i.size, color: i.color, quantity: i.quantity })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo crear el pedido.");
      try {
        if (remember) localStorage.setItem(PROFILE_KEY, JSON.stringify({ customer, address }));
        else localStorage.removeItem(PROFILE_KEY);
      } catch {
        /* almacenamiento no disponible */
      }
      clearCart();
      if (data.redirectUrl) window.location.href = data.redirectUrl;
      else router.push(`/pedido/${data.orderId}?nuevo=1`);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  const next = (e: React.FormEvent) => {
    e.preventDefault();
    setStep((s) => Math.min(4, s + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!hydrated) {
    return (
      <div className="grid min-h-[40vh] place-items-center text-ink-muted">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  if (!items.length && !submitting) {
    return (
      <div className="surface mx-auto max-w-lg px-6 py-14 text-center">
        <Logo width={150} href={null} className="mx-auto" />
        <p className="mt-6 font-display text-xl font-semibold">Tu carrito está vacío</p>
        <p className="mt-1 text-sm text-ink-muted">Agrega productos para continuar con tu compra.</p>
        {notice && <p className="mt-4 text-sm text-warning">{notice}</p>}
        <Link href="/catalogo" className="btn btn-primary mt-6">
          <Rocket className="rocket-icon size-4" /> Explorar catálogo
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-12">
      <div>
        {/* Indicador de pasos */}
        <ol className="mb-8 grid grid-cols-4 gap-2" aria-label="Pasos de compra">
          {STEPS.map(({ id, label, Icon }) => (
            <li key={id}>
              <button
                type="button"
                disabled={id > step}
                onClick={() => setStep(id)}
                aria-current={id === step ? "step" : undefined}
                className="group flex w-full flex-col items-center gap-2 disabled:cursor-default"
              >
                <span
                  className={cn(
                    "grid size-10 place-items-center rounded-full border transition",
                    id < step && "border-transparent bg-white/10 text-nova-cyan",
                    id === step && "bg-nova-gradient border-transparent text-white shadow-[0_0_20px_-4px_rgba(139,61,255,.8)]",
                    id > step && "border-white/12 text-ink-faint",
                  )}
                >
                  {id < step ? <Check className="size-4" /> : <Icon className="size-4" />}
                </span>
                <span className={cn("text-xs font-medium", id === step ? "text-white" : "text-ink-faint")}>{label}</span>
              </button>
            </li>
          ))}
        </ol>

        {notice && <p className="mb-6 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">{notice}</p>}

        {step === 1 && (
          <form onSubmit={next} className="surface space-y-5 p-5 sm:p-7">
            <StepTitle n={1} title="Datos del cliente" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nombre" required autoComplete="given-name" value={customer.firstName} onChange={(v) => setCustomer({ ...customer, firstName: v })} />
              <Field label="Apellido" required autoComplete="family-name" value={customer.lastName} onChange={(v) => setCustomer({ ...customer, lastName: v })} />
              <Field label="Teléfono" required type="tel" inputMode="tel" autoComplete="tel" pattern="^\+?[\d\s\-]{10,16}$" title="Teléfono a 10 dígitos" value={customer.phone} onChange={(v) => setCustomer({ ...customer, phone: v })} />
              <Field label="Correo electrónico" required type="email" autoComplete="email" value={customer.email} onChange={(v) => setCustomer({ ...customer, email: v })} />
            </div>
            <StepActions />
          </form>
        )}

        {step === 2 && (
          <form onSubmit={next} className="surface space-y-5 p-5 sm:p-7">
            <StepTitle n={2} title="Dirección de envío" />
            <div className="grid gap-4 sm:grid-cols-6">
              <Field className="sm:col-span-4" label="Calle" required autoComplete="address-line1" value={address.street} onChange={(v) => setAddress({ ...address, street: v })} />
              <Field className="sm:col-span-2" label="Número (ext. / int.)" required value={address.number} onChange={(v) => setAddress({ ...address, number: v })} />
              <Field className="sm:col-span-3" label="Colonia" required value={address.neighborhood} onChange={(v) => setAddress({ ...address, neighborhood: v })} />
              <Field className="sm:col-span-3" label="Municipio / Alcaldía" required autoComplete="address-level2" value={address.city} onChange={(v) => setAddress({ ...address, city: v })} />
              <div className="sm:col-span-4">
                <label className="label" htmlFor="state">Estado</label>
                <select id="state" required className="field" value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value })}>
                  <option value="">Selecciona…</option>
                  {MX_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <Field className="sm:col-span-2" label="Código postal" required inputMode="numeric" autoComplete="postal-code" pattern="\d{5}" title="5 dígitos" maxLength={5} value={address.postalCode} onChange={(v) => setAddress({ ...address, postalCode: v.replace(/\D/g, "") })} />
              <div className="sm:col-span-6">
                <label className="label" htmlFor="refs">Referencias (opcional)</label>
                <textarea id="refs" rows={2} maxLength={300} className="field" placeholder="Entre calles, color de fachada…" value={address.references} onChange={(e) => setAddress({ ...address, references: e.target.value })} />
              </div>
            </div>
            <StepActions onBack={() => setStep(1)} />
          </form>
        )}

        {step === 3 && (
          <form onSubmit={next} className="surface space-y-5 p-5 sm:p-7">
            <StepTitle n={3} title="Método de envío" />
            <div className="space-y-3" role="radiogroup">
              {shippingMethods.map((m) => {
                const cost = computeTotals(items, m.id).shipping;
                return (
                  <OptionCard key={m.id} selected={shippingId === m.id} onSelect={() => setShippingId(m.id)} Icon={Truck} title={m.label} description={m.description}>
                    <span className={cn("font-display font-semibold", cost === 0 ? "text-success" : "text-white")}>{cost === 0 ? "Gratis" : formatPrice(cost)}</span>
                  </OptionCard>
                );
              })}
            </div>
            <StepActions onBack={() => setStep(2)} />
          </form>
        )}

        {step === 4 && (
          <div className="surface space-y-5 p-5 sm:p-7">
            <StepTitle n={4} title="Método de pago" />
            <div className="space-y-3" role="radiogroup">
              {paymentMethods.map((m) => (
                <OptionCard key={m.id} selected={payment === m.id} onSelect={() => setPayment(m.id)} Icon={PAYMENT_ICONS[m.id]} title={m.label} description={m.description} />
              ))}
            </div>

            <div className="rounded-xl bg-white/4 p-4 text-sm text-ink-muted">
              <p className="font-medium text-white">Enviar a</p>
              <p className="mt-1">
                {customer.firstName} {customer.lastName} · {customer.phone}
                <br />
                {address.street} {address.number}, {address.neighborhood}, {address.city}, {address.state}, CP {address.postalCode}
              </p>
            </div>

            <label className="flex items-center gap-3 text-sm text-ink-muted">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="size-4 accent-[#8b3dff]" />
              Guardar mis datos en este dispositivo para la próxima compra
            </label>

            {error && <p className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">{error}</p>}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button type="button" className="btn btn-ghost" onClick={() => setStep(3)}>
                <ArrowLeft className="size-4" /> Atrás
              </button>
              <button type="button" className="btn btn-primary btn-lg" disabled={submitting} onClick={placeOrder}>
                {submitting ? <Loader2 className="size-5 animate-spin" /> : <Lock className="size-4" />}
                Confirmar pedido · {formatPrice(totals.total)}
              </button>
            </div>
            <p className="text-center text-xs text-ink-faint sm:text-right">
              Al confirmar aceptas los <Link href="/terminos" className="underline">términos y condiciones</Link> y el <Link href="/privacidad" className="underline">aviso de privacidad</Link>.
            </p>
          </div>
        )}
      </div>

      {/* Resumen */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="surface p-5 sm:p-6">
          <h2 className="font-display text-lg font-semibold">Resumen del pedido</h2>
          <ul className="mt-4 max-h-80 space-y-4 overflow-y-auto pr-1">
            {items.map((i) => (
              <li key={i.key} className="flex gap-3">
                <span className="bg-space-800 relative aspect-[4/5] w-14 shrink-0 overflow-hidden rounded-lg">
                  {i.image && <ProductImage src={i.image} alt="" fill sizes="56px" className="object-cover" />}
                  <span className="bg-nova-gradient absolute -top-0 -right-0 grid min-w-5 place-items-center rounded-bl-lg px-1 text-[10px] font-bold">{i.quantity}</span>
                </span>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="truncate font-medium text-white">{i.name}</p>
                  <p className="text-xs text-ink-faint">Talla {i.size} · {i.color}</p>
                </div>
                <p className="text-sm font-semibold">{formatPrice(i.unitPrice * i.quantity)}</p>
              </li>
            ))}
          </ul>
          <Link href="/catalogo" className="mt-3 inline-block text-xs text-nova-cyan hover:underline">Seguir comprando</Link>

          <div className="mt-5 border-t border-white/10 pt-5">
            <label htmlFor="coupon" className="label">Cupón de descuento</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Tag className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint" />
                <input id="coupon" value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} className="field min-h-11 pl-9 text-sm uppercase" placeholder="CÓDIGO" />
              </div>
              <button type="button" className="btn btn-secondary btn-sm min-h-11" disabled={!coupon.trim()} onClick={applyCoupon}>
                Aplicar
              </button>
            </div>
            {couponMsg && <p className={cn("mt-2 text-xs", appliedCoupon ? "text-success" : "text-danger")}>{couponMsg}</p>}
          </div>

          <dl className="mt-5 space-y-2 border-t border-white/10 pt-5 text-sm">
            <Row label="Subtotal" value={formatPrice(totals.subtotal + totals.savings)} />
            {totals.savings > 0 && <Row label="Descuento en productos" value={`−${formatPrice(totals.savings)}`} accent />}
            {totals.discount > 0 && <Row label={`Cupón ${appliedCoupon?.code}`} value={`−${formatPrice(totals.discount)}`} accent />}
            <Row label={`Envío${totals.shippingMethod ? ` · ${totals.shippingMethod.label}` : ""}`} value={totals.shipping === 0 ? "Gratis" : formatPrice(totals.shipping)} />
            <div className="flex items-baseline justify-between border-t border-white/10 pt-3">
              <dt className="font-display font-semibold text-white">Total</dt>
              <dd className="font-display text-2xl font-bold text-white">{formatPrice(totals.total)}</dd>
            </div>
          </dl>
          <p className="mt-4 flex items-center gap-2 text-xs text-ink-faint">
            <Lock className="size-3.5" /> Precios e inventario se confirman al crear tu pedido.
          </p>
        </div>
      </aside>
    </div>
  );
}

function StepTitle({ n, title }: { n: number; title: string }) {
  return (
    <h2 className="flex items-center gap-3 font-display text-xl font-semibold">
      <span className="text-nova-gradient text-sm font-bold tracking-widest">0{n}</span> {title}
    </h2>
  );
}

function StepActions({ onBack }: { onBack?: () => void }) {
  return (
    <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
      {onBack ? (
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          <ArrowLeft className="size-4" /> Atrás
        </button>
      ) : (
        <span />
      )}
      <button type="submit" className="btn btn-primary">
        Continuar <Rocket className="rocket-icon size-4" />
      </button>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  className,
  ...rest
}: { label: string; value: string; onChange: (v: string) => void; className?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="label">{label}</label>
      <input id={id} className="field" value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
    </div>
  );
}

function OptionCard({
  selected,
  onSelect,
  Icon,
  title,
  description,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  Icon: typeof Truck;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition",
        selected ? "border-nova-cyan/60 bg-nova-cyan/5 shadow-[0_0_24px_-10px_rgba(31,209,255,.8)]" : "border-white/10 hover:border-white/25",
      )}
    >
      <span className={cn("grid size-5 shrink-0 place-items-center rounded-full border-2", selected ? "border-nova-cyan" : "border-white/25")}>
        {selected && <span className="size-2.5 rounded-full bg-nova-cyan" />}
      </span>
      <Icon className="size-5 shrink-0 text-ink-muted" />
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-white">{title}</span>
        <span className="block text-xs text-ink-muted">{description}</span>
      </span>
      {children}
    </button>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-4", accent ? "text-nova-magenta" : "text-ink-muted")}>
      <dt>{label}</dt>
      <dd className="shrink-0">{value}</dd>
    </div>
  );
}
