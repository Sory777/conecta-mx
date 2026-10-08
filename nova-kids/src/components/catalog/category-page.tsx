import { Suspense } from "react";
import { CatalogView } from "./catalog-view";
import { PageHeader } from "@/components/ui/page-header";
import { productInCategory } from "@/lib/product";
import type { Category, Product } from "@/lib/types";

export function CategoryPage({ category, products, categories }: { category: Category; products: Product[]; categories: Category[] }) {
  const items = products.filter((p) => productInCategory(p, category));
  return (
    <>
      <PageHeader
        eyebrow="Explora NOVA KIDS"
        title={category.name}
        description={category.description}
        crumbs={[{ href: "/catalogo", label: "Catálogo" }, { href: `/categoria/${category.slug}`, label: category.name }]}
      />
      <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6">
        <Suspense>
          <CatalogView products={items} categories={categories} lockedCategory={category} />
        </Suspense>
      </div>
    </>
  );
}
