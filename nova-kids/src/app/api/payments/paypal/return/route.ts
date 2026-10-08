import { NextResponse } from "next/server";
import { markOrderPaid } from "@/lib/payments";
import { capturePayPalOrder } from "@/lib/payments/paypal";
import { siteUrl } from "@/lib/site-url";

// PayPal regresa aquí con ?token=<id de orden PayPal>; capturamos el pago y mostramos el pedido.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const orderId = url.searchParams.get("order") ?? "";
  const token = url.searchParams.get("token");
  const base = siteUrl(req);
  if (!/^[0-9a-f-]{36}$/i.test(orderId) || !token) return NextResponse.redirect(`${base}/`);
  try {
    const capture = await capturePayPalOrder(token);
    if (capture && capture.customId === orderId) {
      await markOrderPaid(orderId, capture.amount, `paypal:${token}`);
      return NextResponse.redirect(`${base}/pedido/${orderId}?pago=exito`);
    }
  } catch (err) {
    console.error("[paypal] capture", err);
  }
  return NextResponse.redirect(`${base}/pedido/${orderId}?pago=pendiente`);
}
