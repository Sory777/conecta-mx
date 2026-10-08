import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Phone } from "lucide-react";
import { ProductImage } from "@/components/product/product-image";
import { OrderStatusBadge } from "@/components/ui/order-status";
import { OrderStatusForm } from "@/components/admin/order-status-form";
import { repo } from "@/lib/data";
import { formatDate, formatPrice } from "@/lib/format";
import { ORDER_STATUSES } from "@/lib/types";

export const metadata = { title: "Pedido" };

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await repo().getOrder(id);
  if (!order) notFound();
  const a = order.address;

  return (
    <div className="space-y-6">
      <Link href="/admin/pedidos" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-white">
        <ArrowLeft className="size-4" /> Pedidos
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-2xl font-bold sm:text-3xl">{order.number}</h1>
        <OrderStatusBadge status={order.status} />
      </div>
      <p className="-mt-4 text-sm text-ink-muted">{formatDate(order.createdAt)}</p>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <section className="surface p-5">
            <h2 className="mb-3 font-display font-semibold">Productos comprados</h2>
            <ul className="divide-y divide-white/8">
              {order.items.map((i) => (
                <li key={`${i.productId}-${i.size}-${i.color}`} className="flex items-center gap-3 py-3">
                  <span className="bg-space-800 relative aspect-[4/5] w-12 shrink-0 overflow-hidden rounded-lg">
                    {i.image && <ProductImage src={i.image} alt="" fill sizes="48px" className="object-cover" />}
                  </span>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-medium">{i.name}</p>
                    <p className="text-xs text-ink-faint">SKU {i.sku} · Talla {i.size} · {i.color}</p>
                  </div>
                  <p className="text-right text-sm">
                    {i.quantity} × {formatPrice(i.unitPrice)}
                    <br />
                    <strong>{formatPrice(i.quantity * i.unitPrice)}</strong>
                  </p>
                </li>
              ))}
            </ul>
            <dl className="mt-3 space-y-1.5 border-t border-white/10 pt-3 text-sm text-ink-muted">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatPrice(order.subtotal)}</dd></div>
              {order.discount > 0 && <div className="flex justify-between"><dt>Descuento ({order.couponCode})</dt><dd>−{formatPrice(order.discount)}</dd></div>}
              <div className="flex justify-between"><dt>Envío · {order.shippingLabel}</dt><dd>{formatPrice(order.shipping)}</dd></div>
              <div className="flex justify-between pt-1 text-base font-bold text-white"><dt>Total</dt><dd>{formatPrice(order.total)}</dd></div>
            </dl>
          </section>

          <section className="surface p-5">
            <h2 className="mb-3 font-display font-semibold">Historial</h2>
            <ol className="space-y-3 text-sm">
              {[...order.history].reverse().map((h, i) => (
                <li key={i} className="flex gap-3">
                  <span className="bg-nova-gradient mt-1.5 size-2 shrink-0 rounded-full" />
                  <div>
                    <p className="font-medium">{ORDER_STATUSES.find((s) => s.id === h.status)?.label}</p>
                    <p className="text-xs text-ink-faint">{formatDate(h.at)}{h.note ? ` · ${h.note}` : ""}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="space-y-6">
          <OrderStatusForm orderId={order.id} current={order.status} />
          <section className="surface space-y-3 p-5 text-sm">
            <h2 className="font-display font-semibold">Cliente</h2>
            <p className="text-white">{order.customer.firstName} {order.customer.lastName}</p>
            <a href={`mailto:${order.customer.email}`} className="flex items-center gap-2 text-ink-muted hover:text-white"><Mail className="size-4" /> {order.customer.email}</a>
            <a href={`tel:${order.customer.phone}`} className="flex items-center gap-2 text-ink-muted hover:text-white"><Phone className="size-4" /> {order.customer.phone}</a>
          </section>
          <section className="surface space-y-1 p-5 text-sm text-ink-muted">
            <h2 className="mb-2 font-display font-semibold text-white">Dirección de envío</h2>
            <p>{a.street} {a.number}</p>
            <p>Col. {a.neighborhood}</p>
            <p>{a.city}, {a.state}</p>
            <p>CP {a.postalCode}</p>
            {a.references && <p className="pt-2 text-xs">Referencias: {a.references}</p>}
          </section>
          <section className="surface space-y-1 p-5 text-sm text-ink-muted">
            <h2 className="mb-2 font-display font-semibold text-white">Pago</h2>
            <p>Método: <span className="text-white">{order.paymentMethod}</span></p>
            {order.paymentReference && <p className="break-all">Referencia: {order.paymentReference}</p>}
            <Link href={`/pedido/${order.id}`} target="_blank" className="mt-2 inline-block text-xs text-nova-cyan hover:underline">Ver página del cliente</Link>
          </section>
        </div>
      </div>
    </div>
  );
}
