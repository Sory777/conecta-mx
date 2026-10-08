import type { MetadataRoute } from "next";
import { repo } from "@/lib/data";
import { store } from "@/config/store";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = store.siteUrl.replace(/\/$/, "");
  const [products, categories] = await Promise.all([repo().listProducts(), repo().listCategories()]);
  const pages = ["", "/catalogo", "/novedades", "/ofertas", "/nosotros", "/contacto", "/preguntas-frecuentes", "/envios", "/devoluciones", "/privacidad", "/terminos"];
  return [
    ...pages.map((p) => ({ url: `${base}${p}`, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.6 })),
    ...categories.map((c) => ({ url: `${base}/categoria/${c.slug}`, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...products.map((p) => ({ url: `${base}/producto/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.8 })),
  ];
}
