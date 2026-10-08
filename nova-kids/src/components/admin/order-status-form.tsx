"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "@/components/ui/toaster";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/types";

export function OrderStatusForm({ orderId, current }: { orderId: string; current: OrderStatus }) {
  const router = useRouter();
  const [status, setStatus] = useState(current);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (status === "cancelado" && current !== "cancelado" && !confirm("¿Cancelar el pedido? Las piezas regresarán al inventario.")) return;
    setSaving(true);
    const res = await fetch(`/api/admin/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, note: note || undefined }),
    });
    setSaving(false);
    if (!res.ok) return toast((await res.json()).error, "error");
    setNote("");
    toast("Estado actualizado");
    router.refresh();
  }

  return (
    <form onSubmit={save} className="surface space-y-3 p-5">
      <h2 className="font-display font-semibold">Estado del pedido</h2>
      <select className="field" value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)} aria-label="Estado">
        {ORDER_STATUSES.map((s) => (
          <option key={s.id} value={s.id}>{s.label}</option>
        ))}
      </select>
      <input className="field text-sm" placeholder="Nota (ej. número de guía)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
      <button type="submit" disabled={saving || (status === current && !note)} className="btn btn-primary w-full">
        {saving && <Loader2 className="size-4 animate-spin" />} Actualizar estado
      </button>
    </form>
  );
}
