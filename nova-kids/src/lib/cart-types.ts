import type { ProductColor } from "./types";

export interface CartItem {
  /** `${productId}|${size}|${color}` */
  key: string;
  productId: string;
  slug: string;
  name: string;
  sku: string;
  image: string | null;
  size: string;
  color: string;
  quantity: number;
  unitPrice: number;
  compareAtPrice: number | null;
  /** Instantánea de variantes para poder cambiar talla/color desde el carrito. */
  sizes: string[];
  colors: ProductColor[];
  stock: Record<string, number>;
}

export const cartKey = (productId: string, size: string, color: string) => `${productId}|${size}|${color}`;
