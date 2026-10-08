import type { Metadata } from "next";
import { Suspense } from "react";
import { CatalogView } from "@/components/catalog/catalog-view";
import { PageHeader } from "@/components/ui/page-header";
import { getStorefront } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Catálogo",
  description: "Explora todo el catálogo NOVA KIDS: conjuntos, playeras, shorts y sudaderas para niñas y niños.",
  alternates: { canonical: "/catalogo" },
};

export default async function CatalogPage() {
  const { products, categories } = await getStorefront();
  return (
    <>
      <PageHeader eyebrow="Colección completa" title="Catálogo NOVA KIDS" description="Moda infantil que impulsa su imaginación. Filtra por talla, color o precio y encuentra su próxima prenda favorita." />
      <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6">
        <Suspense>
          <CatalogView products={products} categories={categories} />
        </Suspense>
      </div>
    </>
  );
}
