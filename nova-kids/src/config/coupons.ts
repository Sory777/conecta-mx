import "server-only";

// Los cupones viven solo en el servidor para que no se puedan leer desde el navegador.

export interface Coupon {
  code: string;
  /** "percent": porcentaje sobre el subtotal. "fixed": pesos de descuento. */
  type: "percent" | "fixed";
  value: number;
  minSubtotal?: number;
  active: boolean;
}

/**
 * Cupones válidos. Se validan siempre en el servidor al crear el pedido.
 * Ejemplo: { code: "BIENVENIDA10", type: "percent", value: 10, active: true }
 */
export const coupons: Coupon[] = [];
