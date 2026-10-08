import { NextResponse } from "next/server";
import { markOrderPaid } from "@/lib/payments";
import { verifyStripeSignature } from "@/lib/payments/stripe";

// Configura en Stripe un webhook a /api/webhooks/stripe con el evento checkout.session.completed.
export async function POST(req: Request) {
  const payload = await req.text();
  if (!verifyStripeSignature(payload, req.headers.get("stripe-signature"))) {
    return NextResponse.json({ error: "Firma inválida" }, { status: 400 });
  }
  const event = JSON.parse(payload) as {
    type: string;
    data: { object: { id: string; payment_status?: string; amount_total?: number; metadata?: { order_id?: string } } };
  };
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object;
    const orderId = session.metadata?.order_id;
    if (orderId && session.payment_status === "paid") {
      await markOrderPaid(orderId, (session.amount_total ?? 0) / 100, `stripe:${session.id}`);
    }
  }
  return NextResponse.json({ received: true });
}
