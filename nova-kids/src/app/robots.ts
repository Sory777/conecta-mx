import type { MetadataRoute } from "next";
import { store } from "@/config/store";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/checkout", "/cuenta", "/pedido", "/favoritos"] }],
    sitemap: `${store.siteUrl.replace(/\/$/, "")}/sitemap.xml`,
  };
}
