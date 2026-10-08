import { shippingMethods, type ShippingMethod } from "@/config/store";

export interface PricedLine {
  unitPrice: number;
  compareAtPrice: number | null;
  quantity: number;
}

export interface Totals {
  subtotal: number;
  /** Ahorro informativo frente al precio anterior (ya incluido en el subtotal). */
  savings: number;
  discount: number;
  shipping: number;
  total: number;
  shippingMethod: ShippingMethod | null;
  freeShippingRemaining: number | null;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

export function shippingCost(method: ShippingMethod | null, subtotal: number): number {
  if (!method) return 0;
  if (method.freeFrom !== null && subtotal >= method.freeFrom) return 0;
  return method.price;
}

export function getShippingMethod(id: string | null | undefined): ShippingMethod | null {
  return shippingMethods.find((m) => m.id === id) ?? null;
}

/** Cálculo compartido por carrito (cliente) y creación de pedidos (servidor). */
export function computeTotals(lines: PricedLine[], shippingMethodId: string | null, discount = 0): Totals {
  const subtotal = round2(lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0));
  const savings = round2(
    lines.reduce(
      (sum, l) => sum + (l.compareAtPrice && l.compareAtPrice > l.unitPrice ? (l.compareAtPrice - l.unitPrice) * l.quantity : 0),
      0,
    ),
  );
  const method = getShippingMethod(shippingMethodId);
  const appliedDiscount = Math.min(round2(discount), subtotal);
  const shipping = lines.length ? shippingCost(method, subtotal) : 0;
  const standard = shippingMethods.find((m) => m.freeFrom !== null);
  const freeShippingRemaining =
    standard?.freeFrom != null && subtotal < standard.freeFrom ? round2(standard.freeFrom - subtotal) : null;
  return {
    subtotal,
    savings,
    discount: appliedDiscount,
    shipping,
    total: round2(subtotal - appliedDiscount + shipping),
    shippingMethod: method,
    freeShippingRemaining,
  };
}
