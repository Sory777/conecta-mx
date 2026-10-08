import { cn } from "@/lib/format";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/types";

const STYLES: Record<OrderStatus, string> = {
  pendiente: "bg-warning/15 text-warning ring-warning/30",
  pagado: "bg-nova-cyan/15 text-nova-cyan ring-nova-cyan/30",
  preparando: "bg-nova-purple/20 text-[#c4a5ff] ring-nova-purple/40",
  enviado: "bg-nova-blue/20 text-[#8fb0ff] ring-nova-blue/40",
  entregado: "bg-success/15 text-success ring-success/30",
  cancelado: "bg-danger/15 text-danger ring-danger/30",
};

export function OrderStatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1", STYLES[status], className)}>
      {ORDER_STATUSES.find((s) => s.id === status)?.label ?? status}
    </span>
  );
}

/** Línea de progreso del pedido para el cliente. */
export function OrderProgress({ status }: { status: OrderStatus }) {
  if (status === "cancelado") return <OrderStatusBadge status="cancelado" />;
  const flow: OrderStatus[] = ["pendiente", "pagado", "preparando", "enviado", "entregado"];
  const current = flow.indexOf(status);
  return (
    <ol className="grid grid-cols-5 gap-1.5">
      {flow.map((s, i) => (
        <li key={s} className="flex flex-col gap-2">
          <span className={cn("h-1.5 rounded-full", i <= current ? "bg-nova-gradient" : "bg-white/10")} />
          <span className={cn("text-[11px] sm:text-xs", i <= current ? "text-white" : "text-ink-faint")}>
            {ORDER_STATUSES.find((x) => x.id === s)?.label}
          </span>
        </li>
      ))}
    </ol>
  );
}
