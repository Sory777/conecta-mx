import "server-only";
import { repo, OutOfStockError } from "./data";
import { applyCoupon } from "./coupons";
import { computeTotals, getShippingMethod } from "./pricing";
import { mainImage, stockKey } from "./product";
import type { OrderItem, Product } from "./types";
import type { OrderRequest } from "./validation";

export class CheckoutError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

/** Recalcula el pedido con precios e inventario actuales del servidor (nunca confía en el navegador). */
export async function buildOrder(req: OrderRequest) {
  const products = await repo().listProducts();
  const byId = new Map(products.map((p) => [p.id, p]));

  // Agrupa líneas repetidas de la misma variante.
  const merged = new Map<string, OrderRequest["items"][number]>();
  for (const line of req.items) {
    const key = `${line.productId}|${line.size}|${line.color}`;
    const prev = merged.get(key);
    merged.set(key, prev ? { ...prev, quantity: prev.quantity + line.quantity } : line);
  }

  const items: OrderItem[] = [];
  const lines: { unitPrice: number; compareAtPrice: number | null; quantity: number }[] = [];
  for (const line of merged.values()) {
    const product: Product | undefined = byId.get(line.productId);
    if (!product) throw new CheckoutError("Un producto de tu carrito ya no está disponible.", 409);
    if (!product.sizes.includes(line.size) || !product.colors.some((c) => c.name === line.color)) {
      throw new CheckoutError(`La variante seleccionada de ${product.name} ya no existe.`, 409);
    }
    const stock = product.stock[stockKey(line.size, line.color)] ?? 0;
    if (stock < line.quantity) {
      throw new CheckoutError(
        stock === 0
          ? `${product.name} (talla ${line.size}, ${line.color}) se agotó.`
          : `Solo quedan ${stock} piezas de ${product.name} (talla ${line.size}, ${line.color}).`,
        409,
      );
    }
    items.push({
      productId: product.id,
      name: product.name,
      sku: product.sku,
      slug: product.slug,
      image: mainImage(product),
      size: line.size,
      color: line.color,
      quantity: line.quantity,
      unitPrice: product.price,
    });
    lines.push({ unitPrice: product.price, compareAtPrice: product.compareAtPrice, quantity: line.quantity });
  }

  const shipping = getShippingMethod(req.shippingMethodId);
  if (!shipping) throw new CheckoutError("Selecciona un método de envío válido.");

  let discount = 0;
  let couponCode: string | null = null;
  if (req.couponCode) {
    const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
    const result = applyCoupon(req.couponCode, subtotal);
    if (!result.ok) throw new CheckoutError(result.error);
    discount = result.discount;
    couponCode = result.code;
  }

  const totals = computeTotals(lines, shipping.id, discount);
  return { items, totals, shipping, couponCode };
}

export async function placeOrder(req: OrderRequest) {
  const { items, totals, shipping, couponCode } = await buildOrder(req);
  try {
    return await repo().createOrder(
      {
        customer: req.customer,
        address: { ...req.address, references: req.address.references ?? "" },
        items,
        shippingMethodId: shipping.id,
        shippingLabel: shipping.label,
        paymentMethod: req.paymentMethod,
        paymentReference: null,
        couponCode,
        subtotal: totals.subtotal,
        discount: totals.discount,
        shipping: totals.shipping,
        total: totals.total,
      },
      items.map((i) => ({ productId: i.productId, size: i.size, color: i.color, quantity: i.quantity })),
    );
  } catch (err) {
    if (err instanceof OutOfStockError) {
      throw new CheckoutError("Alguien acaba de comprar las últimas piezas de un producto de tu carrito. Revisa tu carrito.", 409);
    }
    throw err;
  }
}
