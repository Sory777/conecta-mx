import "server-only";
import { cache } from "react";
import { repo } from "./data";

/** Lecturas memorizadas por petición para páginas públicas. */
export const getStorefront = cache(async () => {
  const [products, categories] = await Promise.all([repo().listProducts(), repo().listCategories()]);
  return { products, categories };
});

export const getProduct = cache((slug: string) => repo().getProductBySlug(slug));
