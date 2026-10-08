import { AdminHeader } from "@/components/admin/admin-header";
import { CategoryManager } from "@/components/admin/category-manager";
import { repo } from "@/lib/data";
import { productInCategory } from "@/lib/product";

export const metadata = { title: "Categorías" };

export default async function CategoriesPage() {
  const [categories, products] = await Promise.all([repo().listCategories({ includeHidden: true }), repo().listProducts({ includeInactive: true })]);
  const counts = Object.fromEntries(categories.map((c) => [c.id, products.filter((p) => productInCategory(p, c)).length]));
  return (
    <>
      <AdminHeader title="Categorías" description="Organiza el catálogo. Las categorías de tipo prenda se asignan a cada producto; las colecciones se llenan solas." />
      <CategoryManager initial={categories} counts={counts} />
    </>
  );
}
