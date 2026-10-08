import Link from "next/link";
import { AlertTriangle, DollarSign, Package, Plus, ShoppingCart } from "lucide-react";
import { AdminHeader } from "@/components/admin/admin-header";
import { OrderStatusBadge } from "@/components/ui/order-status";
import { repo, dataProvider } from "@/lib/data";
import { formatDate, formatPrice } from "@/lib/format";
import { store } from "@/config/store";
import { stockKey } from "@/lib/product";

export const metadata = { title: "Resumen" };

export default async function AdminDashboard() {
  const [products, orders] = await Promise.all([repo().listProducts({ includeInactive: true }), repo().listOrders()]);
  const valid = orders.filter((o) => o.status !== "cancelado" && o.status !== "pendiente");
  const revenue = valid.reduce((s, o) => s + o.total, 0);
  const pending = orders.filter((o) => o.status === "pendiente").length;
  const toShip = orders.filter((o) => o.status === "pagado" || o.status === "preparando").length;
  const lowStock = products
    .filter((p) => p.status === "active")
    .flatMap((p) =>
      p.sizes.flatMap((s) =>
        p.colors
          .map((c) => ({ product: p, size: s, color: c.name, stock: p.stock[stockKey(s, c.name)] ?? 0 }))
          .filter((v) => v.stock <= store.lowStockThreshold),
      ),
    )
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 8);

  const stats = [
    { label: "Ventas confirmadas", value: formatPrice(revenue), Icon: DollarSign },
    { label: "Pedidos por pagar", value: pending, Icon: ShoppingCart },
    { label: "Por preparar / enviar", value: toShip, Icon: Package },
    { label: "Productos activos", value: products.filter((p) => p.status === "active").length, Icon: Package },
  ];

  return (
    <>
      <AdminHeader
        title="Resumen"
        description={`Datos: ${dataProvider() === "supabase" ? "Supabase" : "almacenamiento local (.data)"}`}
        actions={
          <Link href="/admin/productos/nuevo" className="btn btn-primary btn-sm">
            <Plus className="size-4" /> Agregar producto
          </Link>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(({ label, value, Icon }) => (
          <div key={label} className="surface p-5">
            <Icon className="size-5 text-nova-cyan" />
            <p className="mt-3 font-display text-2xl font-bold">{value}</p>
            <p className="text-xs text-ink-muted">{label}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="surface p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display font-semibold">Pedidos recientes</h2>
            <Link href="/admin/pedidos" className="text-xs text-nova-cyan hover:underline">Ver todos</Link>
          </div>
          {orders.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-muted">Aún no hay pedidos.</p>
          ) : (
            <ul className="divide-y divide-white/8">
              {orders.slice(0, 6).map((o) => (
                <li key={o.id}>
                  <Link href={`/admin/pedidos/${o.id}`} className="flex items-center gap-3 py-3 text-sm hover:text-white">
                    <span className="font-mono text-xs text-ink-muted">{o.number}</span>
                    <span className="min-w-0 flex-1 truncate">{o.customer.firstName} {o.customer.lastName}</span>
                    <OrderStatusBadge status={o.status} />
                    <span className="hidden w-24 text-right font-semibold sm:block">{formatPrice(o.total)}</span>
                  </Link>
                  <p className="-mt-2 pb-2 text-[11px] text-ink-faint">{formatDate(o.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="surface p-5">
          <h2 className="mb-4 flex items-center gap-2 font-display font-semibold">
            <AlertTriangle className="size-4 text-warning" /> Inventario bajo
          </h2>
          {lowStock.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-muted">Todo el inventario está en buen nivel.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {lowStock.map((v) => (
                <li key={`${v.product.id}-${v.size}-${v.color}`}>
                  <Link href={`/admin/productos/${v.product.id}`} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-white/5">
                    <span className="min-w-0 truncate">
                      {v.product.name} <span className="text-ink-faint">· {v.size} · {v.color}</span>
                    </span>
                    <span className={v.stock === 0 ? "text-danger" : "text-warning"}>{v.stock}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
