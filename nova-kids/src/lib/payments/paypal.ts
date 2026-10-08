import "server-only";
import type { PaymentProvider } from "./types";

// PayPal Orders v2 vía API REST. Requiere PAYPAL_CLIENT_ID y PAYPAL_CLIENT_SECRET.

function apiBase() {
  return process.env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

async function accessToken(): Promise<string> {
  const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(`${apiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  const data = (await res.json()) as { access_token?: string };
  if (!res.ok || !data.access_token) throw new Error("No se pudo autenticar con PayPal.");
  return data.access_token;
}

export const paypal: PaymentProvider = {
  id: "paypal",
  label: "PayPal",
  description: "Paga con tu cuenta PayPal o tarjeta.",
  enabled: () => Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET),
  async start(order, { baseUrl }) {
    const res = await fetch(`${apiBase()}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await accessToken()}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": `order-${order.id}`,
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: order.number,
            custom_id: order.id,
            description: `Pedido ${order.number} · NOVA KIDS`,
            amount: { currency_code: "MXN", value: order.total.toFixed(2) },
          },
        ],
        payment_source: {
          paypal: {
            experience_context: {
              brand_name: "NOVA KIDS",
              user_action: "PAY_NOW",
              shipping_preference: "NO_SHIPPING",
              return_url: `${baseUrl}/api/payments/paypal/return?order=${order.id}`,
              cancel_url: `${baseUrl}/pedido/${order.id}?pago=cancelado`,
            },
          },
        },
      }),
    });
    const data = (await res.json()) as { id?: string; links?: { rel: string; href: string }[]; message?: string };
    const link = data.links?.find((l) => l.rel === "payer-action" || l.rel === "approve");
    if (!res.ok || !link) throw new Error(data.message ?? "No se pudo iniciar el pago con PayPal.");
    return { type: "redirect", url: link.href, reference: data.id };
  },
};

/** Captura la orden aprobada por el comprador. Devuelve el monto capturado si se completó. */
export async function capturePayPalOrder(paypalOrderId: string): Promise<{ customId: string; amount: number } | null> {
  const res = await fetch(`${apiBase()}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
  const data = (await res.json()) as {
    status?: string;
    purchase_units?: { payments?: { captures?: { custom_id?: string; amount?: { value: string } }[] } }[];
  };
  const capture = data.purchase_units?.[0]?.payments?.captures?.[0];
  if (data.status !== "COMPLETED" || !capture?.custom_id || !capture.amount) return null;
  return { customId: capture.custom_id, amount: Number(capture.amount.value) };
}
