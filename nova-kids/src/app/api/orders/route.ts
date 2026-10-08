import { NextResponse } from "next/server";
import { repo } from "@/lib/data";
import { CheckoutError, placeOrder } from "@/lib/order-service";
import { getPaymentProvider } from "@/lib/payments";
import { siteUrl } from "@/lib/site-url";
import { orderRequestSchema } from "@/lib/validation";

export async function POST(req: Request) {
  const parsed = orderRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json({ error: `Revisa tus datos: ${first?.path.join(".")} — ${first?.message}` }, { status: 400 });
  }
  const provider = getPaymentProvider(parsed.data.paymentMethod);
  if (!provider) return NextResponse.json({ error: "Ese método de pago no está disponible." }, { status: 400 });

  let order;
  try {
    order = await placeOrder(parsed.data);
  } catch (err) {
    if (err instanceof CheckoutError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[orders] create", err);
    return NextResponse.json({ error: "No pudimos crear tu pedido. Intenta de nuevo." }, { status: 500 });
  }

  try {
    const payment = await provider.start(order, { baseUrl: siteUrl(req) });
    if (payment.type === "redirect") {
      if (payment.reference) await repo().setPaymentReference(order.id, payment.reference);
      return NextResponse.json({ orderId: order.id, number: order.number, redirectUrl: payment.url });
    }
    return NextResponse.json({ orderId: order.id, number: order.number });
  } catch (err) {
    console.error("[orders] payment start", err);
    // Libera el inventario apartado si el pago ni siquiera pudo iniciar.
    await repo().updateOrderStatus(order.id, "cancelado", "No se pudo iniciar el pago").catch(() => undefined);
    return NextResponse.json({ error: "No se pudo conectar con el método de pago. Prueba otro método." }, { status: 502 });
  }
}
