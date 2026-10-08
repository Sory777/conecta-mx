import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { enabledPaymentMethods } from "@/lib/payments";
import { shippingMethods } from "@/config/store";

export const metadata: Metadata = { title: "Finalizar compra", robots: { index: false } };

export default function CheckoutPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6 lg:pt-10">
      <h1 className="mb-8 font-display text-3xl font-bold sm:text-4xl">Finalizar compra</h1>
      <CheckoutForm shippingMethods={shippingMethods} paymentMethods={enabledPaymentMethods()} />
    </div>
  );
}
