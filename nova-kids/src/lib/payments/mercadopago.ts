import "server-only";
import type { PaymentProvider } from "./types";

// Mercado Pago Checkout Pro vía API REST. Requiere MERCADOPAGO_ACCESS_TOKEN.

const API = "https://api.mercadopago.com";

export const mercadopago: PaymentProvider = {
  id: "mercadopago",
  label: "Mercado Pago",
  description: "Tarjetas, OXXO, saldo Mercado Pago y meses sin intereses.",
  enabled: () => Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN),
  async start(order, { baseUrl }) {
    const isPublic = baseUrl.startsWith("https://");
    const res = await fetch(`${API}/checkout/preferences`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": `pref-${order.id}`,
      },
      body: JSON.stringify({
        items: [
          {
            id: order.number,
            title: `Pedido ${order.number} · NOVA KIDS`,
            quantity: 1,
            unit_price: order.total,
            currency_id: "MXN",
          },
        ],
        payer: { name: order.customer.firstName, surname: order.customer.lastName, email: order.customer.email },
        external_reference: order.id,
        back_urls: {
          success: `${baseUrl}/pedido/${order.id}?pago=exito`,
          pending: `${baseUrl}/pedido/${order.id}?pago=pendiente`,
          failure: `${baseUrl}/pedido/${order.id}?pago=cancelado`,
        },
        ...(isPublic ? { auto_return: "approved", notification_url: `${baseUrl}/api/webhooks/mercadopago` } : {}),
      }),
    });
    const data = (await res.json()) as { id?: string; init_point?: string; message?: string };
    if (!res.ok || !data.init_point) throw new Error(data.message ?? "No se pudo iniciar el pago con Mercado Pago.");
    return { type: "redirect", url: data.init_point, reference: data.id };
  },
};

export interface MercadoPagoPayment {
  id: number;
  status: string;
  external_reference: string | null;
  transaction_amount: number;
}

/** Consulta el pago directamente a Mercado Pago (no se confía en el cuerpo del webhook). */
export async function fetchMercadoPagoPayment(id: string): Promise<MercadoPagoPayment | null> {
  const res = await fetch(`${API}/v1/payments/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}` },
    cache: "no-store",
  });
  return res.ok ? ((await res.json()) as MercadoPagoPayment) : null;
}
