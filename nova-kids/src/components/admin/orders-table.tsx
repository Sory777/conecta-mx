"use client";

import Link from "next/link";
import { useState } from "react";
import { Search } from "lucide-react";
import { OrderStatusBadge } from "@/components/ui/order-status";
import { cn, formatDate, formatPrice, normalizeText } from "@/lib/format";
import { ORDER_STATUSES, type Order, type OrderStatus } from "@/lib/types";

export function OrdersTable({ orders }: { orders: Order[] }) {
  const [status, setStatus] = useState<"all" | OrderStatus>("all");
  const [query, setQuery] = useState("");
  const list = orders
    .filter((o) => status === "all" || o.status === status)
    .filter((o) => !query || normalizeText(`${o.number} ${o.customer.firstName} ${o.customer.lastName} ${o.customer.email} ${o.customer.phone}`).includes(normalizeText(query)));

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por número, cliente, correo o teléfono" className="field min-h-11 pl-9 text-sm" />
        </div>
        <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4">
          {[{ id: "all" as const, label: "Todos" }, ...ORDER_STATUSES].map((s) => {
            const count = s.id === "all" ? orders.length : orders.filter((o) => o.status === s.id).length;
            return (
              <button key={s.id} type="button" onClick={() => setStatus(s.id)} className={cn("chip shrink-0 gap-1.5", status === s.id && "is-active")}>
                {s.label} <span className="text-ink-faint">{count}</span>
              </button>
            );
          })}
        </div>
      </div>
      {list.length === 0 ? (
        <p className="surface py-12 text-center text-sm text-ink-muted">No hay pedidos{status !== "all" ? " con este estado" : ""}.</p>
      ) : (
        <ul className="surface divide-y divide-white/8">
          {list.map((o) => (
            <li key={o.id}>
              <Link href={`/admin/pedidos/${o.id}`} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 p-4 transition hover:bg-white/3 sm:grid-cols-[110px_1fr_auto_110px]">
                <span className="font-mono text-sm text-white">{o.number}</span>
                <span className="order-3 col-span-2 min-w-0 text-sm sm:order-none sm:col-span-1">
                  <span className="block truncate">{o.customer.firstName} {o.customer.lastName}</span>
                  <span className="block truncate text-xs text-ink-faint">{formatDate(o.createdAt)} · {o.items.reduce((n, i) => n + i.quantity, 0)} piezas · {o.paymentMethod}</span>
                </span>
                <OrderStatusBadge status={o.status} className="justify-self-end" />
                <span className="order-4 hidden text-right font-semibold sm:order-none sm:block">{formatPrice(o.total)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
