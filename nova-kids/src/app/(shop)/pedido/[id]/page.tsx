import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock, Landmark, Rocket, XCircle } from "lucide-react";
import { repo } from "@/lib/data";
import { bankDetails } from "@/lib/payments/transfer";
import { ProductImage } from "@/components/product/product-image";
import { OrderProgress } from "@/components/ui/order-status";
import { formatDate, formatPrice } from "@/lib/format";
import { store } from "@/config/store";

export const metadata: Metadata = { title: "Tu pedido", robots: { index: false } };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ pago?: string; nuevo?: string }> };

export default async function OrderPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { pago, nuevo } = await searchParams;
  // El identificador del pedido es un UUID aleatorio: funciona como enlace privado.
  const order = /^[0-9a-f-]{36}$/i.test(id) ? await repo().getOrder(id) : null;
  if (!order) notFound();
  const bank = order.paymentMethod === "transferencia" ? bankDetails() : null;
  const paid = order.status !== "pendiente" && order.status !== "cancelado";

  return (
    <div className="mx-auto max-w-3xl px-4 pt-8 sm:px-6 lg:pt-12">
      <div className="surface relative overflow-hidden p-6 text-center sm:p-10">
        <div className="starfield opacity-50" aria-hidden />
        <div className="relative">
          {pago === "cancelado" && order.status === "pendiente" ? (
            <XCircle className="mx-auto size-14 text-danger" />
          ) : paid ? (
            <CheckCircle2 className="mx-auto size-14 text-success" />
          ) : (
            <span className="bg-nova-gradient mx-auto grid size-14 place-items-center rounded-full shadow-[0_0_40px_-6px_rgba(139,61,255,.9)]">
              <Rocket className="size-7 text-white" />
            </span>
          )}
          <h1 className="mt-5 font-display text-3xl font-bold">
            {pago === "cancelado" && order.status === "pendiente"
              ? "El pago no se completó"
              : paid
                ? "¡Pago confirmado!"
                : nuevo || pago
                  ? "¡Pedido recibido!"
                  : "Detalle de tu pedido"}
          </h1>
          <p className="mt-2 text-ink-muted">
            Pedido <strong className="text-white">{order.number}</strong> · {formatDate(order.createdAt)}
          </p>
          {pago === "pendiente" && <p className="mt-2 text-sm text-warning">Tu pago está en proceso. Te avisaremos cuando se acredite.</p>}
          {pago === "cancelado" && order.status === "pendiente" && (
            <p className="mt-2 text-sm text-ink-muted">Puedes intentar de nuevo o escribirnos a {store.contact.email} para ayudarte.</p>
          )}
          <p className="mt-2 text-sm text-ink-faint">Guarda esta página: aquí puedes consultar el estado de tu pedido.</p>
        </div>
      </div>

      <div className="surface mt-6 p-6">
        <h2 className="mb-4 font-display font-semibold">Estado</h2>
        <OrderProgress status={order.status} />
      </div>

      {order.paymentMethod === "transferencia" && order.status === "pendiente" && (
        <div className="surface mt-6 border-nova-cyan/30 p-6">
          <h2 className="flex items-center gap-2 font-display font-semibold">
            <Landmark className="size-5 text-nova-cyan" /> Datos para transferencia
          </h2>
          {bank ? (
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              {bank.bank && (<><dt className="text-ink-faint">Banco</dt><dd>{bank.bank}</dd></>)}
              {bank.holder && (<><dt className="text-ink-faint">Titular</dt><dd>{bank.holder}</dd></>)}
              <dt className="text-ink-faint">CLABE</dt>
              <dd className="font-mono tracking-wider">{bank.clabe}</dd>
              <dt className="text-ink-faint">Monto</dt>
              <dd className="font-semibold">{formatPrice(order.total)}</dd>
              <dt className="text-ink-faint">Concepto</dt>
              <dd className="font-mono">{order.number}</dd>
            </dl>
          ) : (
            <p className="mt-3 flex gap-2 text-sm text-ink-muted">
              <Clock className="size-4 shrink-0 text-nova-cyan" />
              Te enviaremos los datos de pago a {order.customer.email} o por teléfono en breve.
            </p>
          )}
          <p className="mt-4 text-xs text-ink-faint">Envía tu comprobante a {store.contact.email} indicando tu número de pedido.</p>
        </div>
      )}

      <div className="surface mt-6 p-6">
        <h2 className="font-display font-semibold">Productos</h2>
        <ul className="mt-4 divide-y divide-white/8">
          {order.items.map((i) => (
            <li key={`${i.productId}-${i.size}-${i.color}`} className="flex items-center gap-4 py-3">
              <span className="bg-space-800 relative aspect-[4/5] w-14 shrink-0 overflow-hidden rounded-lg">
                {i.image && <ProductImage src={i.image} alt="" fill sizes="56px" className="object-cover" />}
              </span>
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium text-white">{i.name}</p>
                <p className="text-xs text-ink-faint">Talla {i.size} · {i.color} · Cantidad {i.quantity}</p>
              </div>
              <p className="text-sm font-semibold">{formatPrice(i.unitPrice * i.quantity)}</p>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-2 border-t border-white/10 pt-4 text-sm text-ink-muted">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatPrice(order.subtotal)}</dd></div>
          {order.discount > 0 && <div className="flex justify-between text-nova-magenta"><dt>Descuento {order.couponCode}</dt><dd>−{formatPrice(order.discount)}</dd></div>}
          <div className="flex justify-between"><dt>Envío · {order.shippingLabel}</dt><dd>{order.shipping === 0 ? "Gratis" : formatPrice(order.shipping)}</dd></div>
          <div className="flex justify-between pt-2 font-display text-lg font-bold text-white"><dt>Total</dt><dd>{formatPrice(order.total)}</dd></div>
        </dl>
      </div>

      <div className="surface mt-6 grid gap-6 p-6 text-sm sm:grid-cols-2">
        <div>
          <h3 className="font-display font-semibold text-white">Cliente</h3>
          <p className="mt-2 text-ink-muted">{order.customer.firstName} {order.customer.lastName}<br />{order.customer.email}<br />{order.customer.phone}</p>
        </div>
        <div>
          <h3 className="font-display font-semibold text-white">Envío a</h3>
          <p className="mt-2 text-ink-muted">
            {order.address.street} {order.address.number}, {order.address.neighborhood}
            <br />
            {order.address.city}, {order.address.state} · CP {order.address.postalCode}
          </p>
        </div>
      </div>

      <div className="mt-8 text-center">
        <Link href="/catalogo" className="btn btn-primary">
          <Rocket className="rocket-icon size-4" /> Seguir explorando
        </Link>
      </div>
    </div>
  );
}
