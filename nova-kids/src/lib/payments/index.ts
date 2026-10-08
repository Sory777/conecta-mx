import "server-only";
import { repo } from "../data";
import type { PaymentMethodId } from "../types";
import { mercadopago } from "./mercadopago";
import { paypal } from "./paypal";
import { stripe } from "./stripe";
import { transfer } from "./transfer";
import type { PaymentMethodInfo, PaymentProvider } from "./types";

const providers: PaymentProvider[] = [mercadopago, stripe, paypal, transfer];

export function getPaymentProvider(id: PaymentMethodId): PaymentProvider | null {
  const p = providers.find((x) => x.id === id);
  return p && p.enabled() ? p : null;
}

export function enabledPaymentMethods(): PaymentMethodInfo[] {
  return providers.filter((p) => p.enabled()).map(({ id, label, description }) => ({ id, label, description }));
}

/** Marca el pedido como pagado si sigue pendiente y el monto cubre el total. */
export async function markOrderPaid(orderId: string, amount: number, reference: string): Promise<boolean> {
  const order = await repo().getOrder(orderId);
  if (!order) return false;
  if (order.status !== "pendiente") return order.status !== "cancelado";
  if (amount + 0.01 < order.total) return false;
  await repo().setPaymentReference(orderId, reference);
  await repo().updateOrderStatus(orderId, "pagado", `Pago confirmado (${reference})`);
  return true;
}

export type { PaymentMethodInfo } from "./types";
