import type { Metadata } from "next";
import { CategoryPage } from "@/components/catalog/category-page";
import { getStorefront } from "@/lib/queries";
import type { Category } from "@/lib/types";

export const metadata: Metadata = {
  title: "Novedades",
  description: "Lo más reciente de NOVA KIDS: nuevas prendas infantiles con espíritu explorador.",
  alternates: { canonical: "/novedades" },
};

export default async function Page() {
  const { products, categories } = await getStorefront();
  // Usa la categoría configurada en el panel; si se ocultó, se crea una colección equivalente.
  const category: Category = categories.find((c) => c.kind === "new") ?? {
    id: "novedades",
    slug: "novedades",
    name: "Novedades",
    description: "",
    image: null,
    kind: "new",
    gender: null,
    sortOrder: 0,
    visible: true,
  };
  return <CategoryPage category={category} products={products} categories={categories} />;
}
