import type { Metadata } from "next";
import { CategoryPage } from "@/components/catalog/category-page";
import { getStorefront } from "@/lib/queries";
import type { Category } from "@/lib/types";

export const metadata: Metadata = {
  title: "Ofertas",
  description: "Ofertas NOVA KIDS: moda infantil con descuento por tiempo limitado.",
  alternates: { canonical: "/ofertas" },
};

export default async function Page() {
  const { products, categories } = await getStorefront();
  // Usa la categoría configurada en el panel; si se ocultó, se crea una colección equivalente.
  const category: Category = categories.find((c) => c.kind === "sale") ?? {
    id: "ofertas",
    slug: "ofertas",
    name: "Ofertas",
    description: "",
    image: null,
    kind: "sale",
    gender: null,
    sortOrder: 0,
    visible: true,
  };
  return <CategoryPage category={category} products={products} categories={categories} />;
}
