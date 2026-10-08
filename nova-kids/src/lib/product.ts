import { store } from "@/config/store";
import type { Category, Product } from "./types";

export const stockKey = (size: string, color: string) => `${size}|${color}`;

export function variantStock(product: Product, size: string, color: string): number {
  return Math.max(0, product.stock[stockKey(size, color)] ?? 0);
}

export function totalStock(product: Product): number {
  return Object.values(product.stock).reduce((sum, n) => sum + Math.max(0, n), 0);
}

export function sizeStock(product: Product, size: string): number {
  return product.colors.reduce((sum, c) => sum + variantStock(product, size, c.name), 0);
}

export function isOnSale(product: Product): boolean {
  return product.compareAtPrice !== null && product.compareAtPrice > product.price;
}

export function discountPercent(product: Product): number {
  if (!isOnSale(product) || !product.compareAtPrice) return 0;
  return Math.round((1 - product.price / product.compareAtPrice) * 100);
}

export function isNewProduct(product: Product, now = Date.now()): boolean {
  if (product.isNew) return true;
  const ageDays = (now - new Date(product.createdAt).getTime()) / 86_400_000;
  return ageDays <= store.newProductDays;
}

export function sortSizes(sizes: string[]): string[] {
  const order: readonly string[] = store.sizeOrder;
  return [...sizes].sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b, "es", { numeric: true });
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

export function mainImage(product: Product): string | null {
  return product.images[0]?.url ?? null;
}

/** ¿El producto pertenece a esta categoría (incluidas colecciones dinámicas)? */
export function productInCategory(product: Product, category: Category): boolean {
  switch (category.kind) {
    case "garment":
      return product.categoryId === category.id;
    case "gender":
      return product.gender === category.gender || product.gender === "unisex";
    case "new":
      return isNewProduct(product);
    case "sale":
      return isOnSale(product);
  }
}

/** Versión de producto apta para enviar al navegador (sin campos internos). */
export type PublicProduct = Product;
