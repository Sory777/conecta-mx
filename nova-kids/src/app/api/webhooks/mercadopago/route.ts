import { NextResponse } from "next/server";
import { markOrderPaid } from "@/lib/payments";
import { fetchMercadoPagoPayment } from "@/lib/payments/mercadopago";

// Mercado Pago avisa con el id del pago; lo consultamos directamente a su API antes de marcar el pedido.
export async function POST(req: Request) {
  if (!process.env.MERCADOPAGO_ACCESS_TOKEN) return NextResponse.json({ ok: false }, { status: 404 });
  const url = new URL(req.url);
  const body = (await req.json().catch(() => ({}))) as { type?: string; topic?: string; data?: { id?: string | number } };
  const type = body.type ?? body.topic ?? url.searchParams.get("type") ?? url.searchParams.get("topic");
  const id = body.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id");
  if (type === "payment" && id) {
    const payment = await fetchMercadoPagoPayment(String(id));
    if (payment?.status === "approved" && payment.external_reference) {
      await markOrderPaid(payment.external_reference, payment.transaction_amount, `mercadopago:${payment.id}`);
    }
  }
  return NextResponse.json({ ok: true });
}
