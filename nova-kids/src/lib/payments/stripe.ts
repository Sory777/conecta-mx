import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import type { PaymentProvider } from "./types";

// Stripe Checkout vía API REST. Requiere STRIPE_SECRET_KEY (y STRIPE_WEBHOOK_SECRET para confirmar pagos).

export const stripe: PaymentProvider = {
  id: "stripe",
  label: "Tarjeta de crédito o débito",
  description: "Pago seguro con Stripe (Visa, Mastercard, AMEX).",
  enabled: () => Boolean(process.env.STRIPE_SECRET_KEY),
  async start(order, { baseUrl }) {
    const body = new URLSearchParams({
      mode: "payment",
      success_url: `${baseUrl}/pedido/${order.id}?pago=exito`,
      cancel_url: `${baseUrl}/pedido/${order.id}?pago=cancelado`,
      client_reference_id: order.id,
      customer_email: order.customer.email,
      "metadata[order_id]": order.id,
      "metadata[order_number]": order.number,
      "payment_intent_data[metadata][order_id]": order.id,
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "mxn",
      "line_items[0][price_data][unit_amount]": String(Math.round(order.total * 100)),
      "line_items[0][price_data][product_data][name]": `Pedido ${order.number} · NOVA KIDS`,
    });
    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": `checkout-${order.id}`,
      },
      body,
    });
    const data = (await res.json()) as { id?: string; url?: string; error?: { message: string } };
    if (!res.ok || !data.url) throw new Error(data.error?.message ?? "No se pudo iniciar el pago con Stripe.");
    return { type: "redirect", url: data.url, reference: data.id };
  },
};

/** Verifica la cabecera Stripe-Signature (esquema v1, tolerancia de 5 minutos). */
export function verifyStripeSignature(payload: string, header: string | null): boolean {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = parts.t;
  const signatures = header
    .split(",")
    .filter((p) => p.startsWith("v1="))
    .map((p) => p.slice(3));
  if (!t || !signatures.length || Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  return signatures.some((sig) => sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected)));
}
